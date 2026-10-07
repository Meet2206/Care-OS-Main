from __future__ import annotations
import logging
import re
from datetime import date, datetime, time, timedelta, timezone

from pymongo import ReturnDocument
from pymongo.errors import DuplicateKeyError

from app.database.mongodb import db
from app.utils.serialization import serialize_documents
from app.models.appointment import (
    APPOINTMENT_COUNTER_KEY,
    APPOINTMENTS_COLLECTION,
    COUNTERS_COLLECTION,
    appointment_document_to_response,
    APPOINTMENT_SLOTS_COLLECTION,
)
from app.models.doctor import DOCTORS_COLLECTION
from app.models.patient import PATIENTS_COLLECTION
from app.schemas.appointment import (
    AppointmentCreate,
    AppointmentListResponse,
    AppointmentResponse,
    AppointmentStatus,
    AppointmentUpdate,
)

logger = logging.getLogger(__name__)
SLOT_CAPACITY = 3
ACTIVE_SLOT_STATUSES = {"Scheduled", "Payment Pending", "ON GOING", "Completed"}


class AppointmentNotFoundError(Exception):
    pass


class AppointmentPatientNotFoundError(Exception):
    pass


class AppointmentDoctorNotFoundError(Exception):
    pass


class DoctorScheduleConflictError(Exception):
    pass


class AppointmentScheduleClosedError(Exception):
    pass


class AppointmentStatusTransitionError(Exception):
    pass


def _appointments_collection():
    return db[APPOINTMENTS_COLLECTION]


def _appointment_slots_collection():
    return db[APPOINTMENT_SLOTS_COLLECTION]


def ensure_appointment_indexes() -> None:
    """Create the indexes required for appointment lookups and conflict checks."""
    collection = _appointments_collection()
    collection.create_index("appointment_id", unique=True, name="unique_appointment_id")
    collection.create_index("patient_id", name="appointment_patient_id")
    collection.create_index("doctor_id", name="appointment_doctor_id")
    collection.create_index("appointment_date", name="appointment_date")
    collection.create_index("status", name="appointment_status")
    collection.create_index("is_deleted", name="appointment_is_deleted")
    collection.create_index(
        [("doctor_id", 1), ("appointment_date", 1), ("appointment_time", 1), ("status", 1)],
        name="appointment_slot_lookup",
    )
    index_name = "unique_active_doctor_appointment_slot"
    existing_slot_index = getattr(collection, "index_information", lambda: {})().get(index_name)
    if existing_slot_index and hasattr(collection, "drop_index"):
        collection.drop_index(index_name)
    slots = _appointment_slots_collection()
    slots.create_index(
        [("doctor_id", 1), ("appointment_date", 1), ("appointment_time", 1)],
        unique=True,
        name="unique_appointment_slot",
    )
    slots.create_index("reservations", name="appointment_slot_reservations")


def _next_appointment_id() -> str:
    counter = db[COUNTERS_COLLECTION].find_one_and_update(
        {"_id": APPOINTMENT_COUNTER_KEY},
        {"$inc": {"sequence_value": 1}},
        upsert=True,
        return_document=ReturnDocument.AFTER,
    )
    return f"APT{counter['sequence_value']:06d}"


def _serialize_schedule(appointment_data: dict) -> None:
    appointment_date = appointment_data.get("appointment_date")
    if isinstance(appointment_date, date) and not isinstance(appointment_date, datetime):
        appointment_data["appointment_date"] = datetime.combine(
            appointment_date,
            time.min,
            tzinfo=timezone.utc,
        )
    appointment_time = appointment_data.get("appointment_time")
    if isinstance(appointment_time, time):
        appointment_data["appointment_time"] = appointment_time.isoformat()


def _validate_schedule_hours(appointment_data: dict) -> None:
    appointment_date = appointment_data["appointment_date"]
    if isinstance(appointment_date, datetime):
        appointment_date = appointment_date.date()
    if appointment_date.weekday() == 6:
        raise AppointmentScheduleClosedError("Sundays are holidays. Choose another appointment date.")

    appointment_time = appointment_data["appointment_time"]
    if isinstance(appointment_time, str):
        appointment_time = time.fromisoformat(appointment_time)
    if appointment_date.weekday() == 5 and not (time(11, 0) <= appointment_time < time(14, 0)):
        raise AppointmentScheduleClosedError("Saturday appointments are available only from 11:00 AM to 2:00 PM.")


def _active_patient_exists(patient_id: str) -> bool:
    return db[PATIENTS_COLLECTION].find_one(
        {"patient_id": patient_id, "status": "Active", "is_deleted": {"$ne": True}}
    ) is not None


def _active_doctor_exists(doctor_id: str) -> bool:
    return db[DOCTORS_COLLECTION].find_one(
        {"doctor_id": doctor_id, "is_deleted": {"$ne": True}}
    ) is not None


def _validate_relationships(patient_id: str, doctor_id: str) -> None:
    if not _active_patient_exists(patient_id):
        raise AppointmentPatientNotFoundError
    if not _active_doctor_exists(doctor_id):
        raise AppointmentDoctorNotFoundError


def _slot_key(appointment_data: dict) -> dict:
    return {
        "doctor_id": appointment_data["doctor_id"],
        "appointment_date": appointment_data["appointment_date"],
        "appointment_time": appointment_data["appointment_time"],
    }


def _active_slot_appointment_ids(slot: dict) -> list[str]:
    query = {**_slot_key(slot), "is_deleted": {"$ne": True}}
    return [
        item["appointment_id"]
        for item in _appointments_collection().find(query)
        if item.get("status") in ACTIVE_SLOT_STATUSES
    ]


def _ensure_slot_document(appointment_data: dict) -> None:
    slots = _appointment_slots_collection()
    existing = slots.find_one(_slot_key(appointment_data))
    if existing is not None:
        return
    existing_ids = _active_slot_appointment_ids(appointment_data)
    try:
        slots.insert_one({
            **_slot_key(appointment_data),
            "capacity": SLOT_CAPACITY,
            "booked_count": len(existing_ids),
            "reservations": existing_ids,
        })
    except DuplicateKeyError:
        # Another request initialized the same slot first. Its atomic state is
        # authoritative, so continue to the reservation update.
        pass


def _reserve_slot(appointment_data: dict, appointment_id: str) -> None:
    _ensure_slot_document(appointment_data)
    reserved = _appointment_slots_collection().find_one_and_update(
        {
            **_slot_key(appointment_data),
            "$expr": {"$lt": ["$booked_count", "$capacity"]},
            "reservations": {"$ne": appointment_id},
        },
        {"$inc": {"booked_count": 1}, "$addToSet": {"reservations": appointment_id}},
        return_document=ReturnDocument.AFTER,
    )
    if reserved is None:
        raise DoctorScheduleConflictError


def _release_slot(appointment_data: dict, appointment_id: str) -> None:
    _appointment_slots_collection().find_one_and_update(
        {**_slot_key(appointment_data), "reservations": appointment_id, "booked_count": {"$gt": 0}},
        {"$inc": {"booked_count": -1}, "$pull": {"reservations": appointment_id}},
        return_document=ReturnDocument.AFTER,
    )


def _slot_booked_count(doctor_id: str, appointment_date, appointment_time: str, exclude: str | None = None) -> int:
    slot = _appointment_slots_collection().find_one({"doctor_id": doctor_id, "appointment_date": appointment_date, "appointment_time": appointment_time})
    if slot is not None:
        return max(0, int(slot.get("booked_count", 0)) - (1 if exclude and exclude in slot.get("reservations", []) else 0))
    query = {"doctor_id": doctor_id, "appointment_date": appointment_date, "appointment_time": appointment_time, "is_deleted": {"$ne": True}}
    if exclude:
        query["appointment_id"] = {"$ne": exclude}
    return sum(1 for item in _appointments_collection().find(query) if item.get("status") in ACTIVE_SLOT_STATUSES)


def _with_slot_metadata(appointment: dict, exclude: str | None = None) -> AppointmentResponse:
    row = dict(appointment)
    row["slot_capacity"] = SLOT_CAPACITY
    row["slot_booked"] = _slot_booked_count(row["doctor_id"], row["appointment_date"], row["appointment_time"], exclude)
    return appointment_document_to_response(row)


def create_appointment(request: AppointmentCreate) -> AppointmentResponse:
    ensure_appointment_indexes()
    appointment = request.model_dump(mode="python")
    _validate_relationships(appointment["patient_id"], appointment["doctor_id"])
    _validate_schedule_hours(appointment)
    _serialize_schedule(appointment)
    now = datetime.now(timezone.utc)
    appointment.update(
        appointment_id=_next_appointment_id(),
        is_deleted=False,
        deleted_at=None,
        created_at=now,
        updated_at=now,
    )
    if appointment.get("status") in ACTIVE_SLOT_STATUSES:
        _reserve_slot(appointment, appointment["appointment_id"])
    try:
        _appointments_collection().insert_one(appointment)
    except DuplicateKeyError as exc:
        if appointment.get("status") in ACTIVE_SLOT_STATUSES:
            _release_slot(appointment, appointment["appointment_id"])
        raise DoctorScheduleConflictError from exc
    except Exception:
        if appointment.get("status") in ACTIVE_SLOT_STATUSES:
            _release_slot(appointment, appointment["appointment_id"])
        raise

    logger.info("Appointment created", extra={"appointment_id": appointment["appointment_id"]})
    return _with_slot_metadata(appointment)


def get_appointment(appointment_id: str) -> AppointmentResponse:
    appointment = _appointments_collection().find_one(
        {"appointment_id": appointment_id, "is_deleted": {"$ne": True}}
    )
    if appointment is None:
        raise AppointmentNotFoundError
    return _with_slot_metadata(appointment)


def list_appointments(
    page: int,
    limit: int,
    search: str | None,
    doctor_id: str | None,
    patient_id: str | None,
    status: AppointmentStatus | None,
    appointment_date: date | None,
) -> AppointmentListResponse:
    query: dict = {"is_deleted": {"$ne": True}}
    if doctor_id:
        query["doctor_id"] = doctor_id
    if patient_id:
        query["patient_id"] = patient_id
    if status:
        query["status"] = status.value
    if appointment_date:
        day_start = datetime.combine(appointment_date, time.min, tzinfo=timezone.utc)
        day_end = day_start + timedelta(days=1)
        query["appointment_date"] = {"$gte": day_start, "$lt": day_end}
    if search:
        pattern = re.escape(search.strip())
        query["$or"] = [
            {"appointment_id": {"$regex": pattern, "$options": "i"}},
            {"patient_id": {"$regex": pattern, "$options": "i"}},
            {"doctor_id": {"$regex": pattern, "$options": "i"}},
            {"reason": {"$regex": pattern, "$options": "i"}},
        ]

    collection = _appointments_collection()
    total = collection.count_documents(query)
    appointments = list(
        collection.find(query).sort("appointment_date", 1).skip((page - 1) * limit).limit(limit)
    )
    total_pages = (total + limit - 1) // limit
    return AppointmentListResponse(
        total=total,
        page=page,
        limit=limit,
        total_pages=total_pages,
        has_next=page < total_pages,
        has_previous=page > 1,
        data=[_with_slot_metadata(item) for item in appointments],
    )


def list_booked_times(doctor_id: str, appointment_date: date) -> list[dict]:
    day_start = datetime.combine(appointment_date, time.min, tzinfo=timezone.utc)
    day_end = day_start + timedelta(days=1)
    rows = _appointments_collection().find({
        "doctor_id": doctor_id,
        "appointment_date": {"$gte": day_start, "$lt": day_end},
        "is_deleted": {"$ne": True},
    })
    counts: dict[str, int] = {}
    for row in rows:
        if row.get("status") in {"Scheduled", "Payment Pending", "ON GOING", "Completed"}:
            key = str(row["appointment_time"])[:5]
            counts[key] = counts.get(key, 0) + 1
    return [{"time": key, "booked": value, "capacity": SLOT_CAPACITY, "available": value < SLOT_CAPACITY} for key, value in sorted(counts.items())]


def update_appointment(appointment_id: str, request: AppointmentUpdate) -> AppointmentResponse:
    existing = _appointments_collection().find_one(
        {"appointment_id": appointment_id, "is_deleted": {"$ne": True}}
    )
    if existing is None:
        raise AppointmentNotFoundError

    update_data = request.model_dump(exclude_unset=True, mode="python")
    if not update_data:
        return _with_slot_metadata(existing)
    if update_data.get("status") == "Completed":
        raise AppointmentStatusTransitionError("Appointments are completed when the doctor saves the consultation.")
    _serialize_schedule(update_data)
    candidate = {**existing, **update_data}
    _validate_relationships(candidate["patient_id"], candidate["doctor_id"])
    _validate_schedule_hours(candidate)
    old_slot = _slot_key(existing)
    new_slot = _slot_key(candidate)
    slot_changed = old_slot != new_slot
    old_active = existing.get("status") in ACTIVE_SLOT_STATUSES
    new_active = candidate.get("status") in ACTIVE_SLOT_STATUSES
    if new_active and (slot_changed or not old_active):
        _reserve_slot(candidate, appointment_id)
    update_data["updated_at"] = datetime.now(timezone.utc)
    try:
        appointment = _appointments_collection().find_one_and_update(
            {"appointment_id": appointment_id, "is_deleted": {"$ne": True}},
            {"$set": update_data},
            return_document=ReturnDocument.AFTER,
        )
    except Exception:
        if new_active and (slot_changed or not old_active):
            _release_slot(candidate, appointment_id)
        raise
    if appointment is None:
        if new_active and (slot_changed or not old_active):
            _release_slot(candidate, appointment_id)
        raise AppointmentNotFoundError
    if old_active and (slot_changed or not new_active):
        _release_slot(existing, appointment_id)
    logger.info("Appointment updated", extra={"appointment_id": appointment_id})
    return _with_slot_metadata(appointment)


def delete_appointment(appointment_id: str) -> None:
    now = datetime.now(timezone.utc)
    appointment = _appointments_collection().find_one_and_update(
        {"appointment_id": appointment_id, "is_deleted": {"$ne": True}},
        {"$set": {"is_deleted": True, "deleted_at": now, "updated_at": now}},
        return_document=ReturnDocument.AFTER,
    )
    if appointment is None:
        raise AppointmentNotFoundError
    _release_slot(appointment, appointment_id)
    logger.info("Appointment soft deleted", extra={"appointment_id": appointment_id})
