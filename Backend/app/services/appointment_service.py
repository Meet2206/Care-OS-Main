from __future__ import annotations
import logging
import re
from datetime import date, datetime, time, timedelta, timezone

from pymongo import ReturnDocument
from pymongo.errors import DuplicateKeyError

from app.database.mongodb import db
from app.models.appointment import (
    APPOINTMENT_COUNTER_KEY,
    APPOINTMENTS_COLLECTION,
    COUNTERS_COLLECTION,
    appointment_document_to_response,
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


class AppointmentNotFoundError(Exception):
    pass


class AppointmentPatientNotFoundError(Exception):
    pass


class AppointmentDoctorNotFoundError(Exception):
    pass


class DoctorScheduleConflictError(Exception):
    pass


def _appointments_collection():
    return db[APPOINTMENTS_COLLECTION]


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
        [("doctor_id", 1), ("appointment_date", 1), ("appointment_time", 1)],
        unique=True,
        partialFilterExpression={"is_deleted": False},
        name="unique_active_doctor_appointment_slot",
    )


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


def _active_patient_exists(patient_id: str) -> bool:
    return db[PATIENTS_COLLECTION].find_one(
        {"patient_id": patient_id, "is_deleted": {"$ne": True}}
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


def _ensure_doctor_slot_available(appointment_data: dict, exclude_appointment_id: str | None = None) -> None:
    query: dict = {
        "doctor_id": appointment_data["doctor_id"],
        "appointment_date": appointment_data["appointment_date"],
        "appointment_time": appointment_data["appointment_time"],
        "is_deleted": {"$ne": True},
    }
    if exclude_appointment_id:
        query["appointment_id"] = {"$ne": exclude_appointment_id}
    if _appointments_collection().find_one(query) is not None:
        raise DoctorScheduleConflictError


def create_appointment(request: AppointmentCreate) -> AppointmentResponse:
    ensure_appointment_indexes()
    appointment = request.model_dump(mode="python")
    _validate_relationships(appointment["patient_id"], appointment["doctor_id"])
    _serialize_schedule(appointment)
    _ensure_doctor_slot_available(appointment)
    now = datetime.now(timezone.utc)
    appointment.update(
        appointment_id=_next_appointment_id(),
        is_deleted=False,
        deleted_at=None,
        created_at=now,
        updated_at=now,
    )
    try:
        _appointments_collection().insert_one(appointment)
    except DuplicateKeyError as exc:
        raise DoctorScheduleConflictError from exc

    logger.info("Appointment created", extra={"appointment_id": appointment["appointment_id"]})
    return appointment_document_to_response(appointment)


def get_appointment(appointment_id: str) -> AppointmentResponse:
    appointment = _appointments_collection().find_one(
        {"appointment_id": appointment_id, "is_deleted": {"$ne": True}}
    )
    if appointment is None:
        raise AppointmentNotFoundError
    return appointment_document_to_response(appointment)


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
        data=[appointment_document_to_response(appointment) for appointment in appointments],
    )


def update_appointment(appointment_id: str, request: AppointmentUpdate) -> AppointmentResponse:
    existing = _appointments_collection().find_one(
        {"appointment_id": appointment_id, "is_deleted": {"$ne": True}}
    )
    if existing is None:
        raise AppointmentNotFoundError

    update_data = request.model_dump(exclude_unset=True, mode="python")
    if not update_data:
        return appointment_document_to_response(existing)
    _serialize_schedule(update_data)
    candidate = {**existing, **update_data}
    _validate_relationships(candidate["patient_id"], candidate["doctor_id"])
    _ensure_doctor_slot_available(candidate, exclude_appointment_id=appointment_id)
    update_data["updated_at"] = datetime.now(timezone.utc)
    appointment = _appointments_collection().find_one_and_update(
        {"appointment_id": appointment_id, "is_deleted": {"$ne": True}},
        {"$set": update_data},
        return_document=ReturnDocument.AFTER,
    )
    if appointment is None:
        raise AppointmentNotFoundError
    logger.info("Appointment updated", extra={"appointment_id": appointment_id})
    return appointment_document_to_response(appointment)


def delete_appointment(appointment_id: str) -> None:
    now = datetime.now(timezone.utc)
    appointment = _appointments_collection().find_one_and_update(
        {"appointment_id": appointment_id, "is_deleted": {"$ne": True}},
        {"$set": {"is_deleted": True, "deleted_at": now, "updated_at": now}},
        return_document=ReturnDocument.AFTER,
    )
    if appointment is None:
        raise AppointmentNotFoundError
    logger.info("Appointment soft deleted", extra={"appointment_id": appointment_id})
