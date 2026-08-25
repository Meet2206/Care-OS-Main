import logging
import re
from datetime import date, datetime, time, timezone

from pymongo import ReturnDocument
from pymongo.errors import DuplicateKeyError

from app.database.mongodb import db
from app.models.appointment import APPOINTMENTS_COLLECTION
from app.models.doctor import DOCTORS_COLLECTION
from app.models.medical_record import (
    COUNTERS_COLLECTION,
    MEDICAL_RECORD_COUNTER_KEY,
    MEDICAL_RECORDS_COLLECTION,
    medical_record_document_to_response,
)
from app.models.patient import PATIENTS_COLLECTION
from app.schemas.medical_record import (
    MedicalRecordCreate,
    MedicalRecordListResponse,
    MedicalRecordResponse,
    MedicalRecordUpdate,
)

logger = logging.getLogger(__name__)


class MedicalRecordNotFoundError(Exception):
    pass


class MedicalRecordAppointmentNotFoundError(Exception):
    pass


class MedicalRecordPatientNotFoundError(Exception):
    pass


class MedicalRecordDoctorNotFoundError(Exception):
    pass


class MedicalRecordAppointmentConflictError(Exception):
    pass


def _records_collection():
    return db[MEDICAL_RECORDS_COLLECTION]


def ensure_medical_record_indexes() -> None:
    """Create indexes for medical-record lookup and integrity constraints."""
    collection = _records_collection()
    collection.create_index("record_id", unique=True, name="unique_medical_record_id")
    collection.create_index("appointment_id", unique=True, name="unique_medical_record_appointment")
    collection.create_index("patient_id", name="medical_record_patient_id")
    collection.create_index("doctor_id", name="medical_record_doctor_id")
    collection.create_index("diagnosis", name="medical_record_diagnosis")
    collection.create_index("is_deleted", name="medical_record_is_deleted")


def _next_record_id() -> str:
    counter = db[COUNTERS_COLLECTION].find_one_and_update(
        {"_id": MEDICAL_RECORD_COUNTER_KEY},
        {"$inc": {"sequence_value": 1}},
        upsert=True,
        return_document=ReturnDocument.AFTER,
    )
    return f"MR{counter['sequence_value']:06d}"


def _serialize_follow_up_date(record_data: dict) -> None:
    follow_up_date = record_data.get("follow_up_date")
    if isinstance(follow_up_date, date) and not isinstance(follow_up_date, datetime):
        record_data["follow_up_date"] = datetime.combine(follow_up_date, time.min, tzinfo=timezone.utc)


def _active_document_exists(collection_name: str, identifier_field: str, identifier: str) -> bool:
    return db[collection_name].find_one(
        {identifier_field: identifier, "is_deleted": {"$ne": True}}
    ) is not None


def _validate_relationships(appointment_id: str, patient_id: str, doctor_id: str) -> None:
    if not _active_document_exists(APPOINTMENTS_COLLECTION, "appointment_id", appointment_id):
        raise MedicalRecordAppointmentNotFoundError
    if not _active_document_exists(PATIENTS_COLLECTION, "patient_id", patient_id):
        raise MedicalRecordPatientNotFoundError
    if not _active_document_exists(DOCTORS_COLLECTION, "doctor_id", doctor_id):
        raise MedicalRecordDoctorNotFoundError


def _ensure_appointment_has_no_record(appointment_id: str, exclude_record_id: str | None = None) -> None:
    query: dict = {"appointment_id": appointment_id, "is_deleted": {"$ne": True}}
    if exclude_record_id:
        query["record_id"] = {"$ne": exclude_record_id}
    if _records_collection().find_one(query) is not None:
        raise MedicalRecordAppointmentConflictError


def create_medical_record(request: MedicalRecordCreate) -> MedicalRecordResponse:
    ensure_medical_record_indexes()
    record = request.model_dump(mode="python")
    _validate_relationships(record["appointment_id"], record["patient_id"], record["doctor_id"])
    _ensure_appointment_has_no_record(record["appointment_id"])
    _serialize_follow_up_date(record)
    now = datetime.now(timezone.utc)
    record.update(
        record_id=_next_record_id(),
        is_deleted=False,
        deleted_at=None,
        created_at=now,
        updated_at=now,
    )
    try:
        _records_collection().insert_one(record)
    except DuplicateKeyError as exc:
        raise MedicalRecordAppointmentConflictError from exc
    logger.info("Medical record created", extra={"record_id": record["record_id"]})
    return medical_record_document_to_response(record)


def get_medical_record(record_id: str) -> MedicalRecordResponse:
    record = _records_collection().find_one({"record_id": record_id, "is_deleted": {"$ne": True}})
    if record is None:
        raise MedicalRecordNotFoundError
    return medical_record_document_to_response(record)


def list_medical_records(
    page: int,
    limit: int,
    search: str | None,
    appointment_id: str | None,
    patient_id: str | None,
    doctor_id: str | None,
) -> MedicalRecordListResponse:
    query: dict = {"is_deleted": {"$ne": True}}
    if appointment_id:
        query["appointment_id"] = appointment_id
    if patient_id:
        query["patient_id"] = patient_id
    if doctor_id:
        query["doctor_id"] = doctor_id
    if search:
        pattern = re.escape(search.strip())
        query["$or"] = [
            {"record_id": {"$regex": pattern, "$options": "i"}},
            {"appointment_id": {"$regex": pattern, "$options": "i"}},
            {"patient_id": {"$regex": pattern, "$options": "i"}},
            {"doctor_id": {"$regex": pattern, "$options": "i"}},
            {"diagnosis": {"$regex": pattern, "$options": "i"}},
        ]

    collection = _records_collection()
    total = collection.count_documents(query)
    records = list(collection.find(query).sort("created_at", -1).skip((page - 1) * limit).limit(limit))
    total_pages = (total + limit - 1) // limit
    return MedicalRecordListResponse(
        total=total,
        page=page,
        limit=limit,
        total_pages=total_pages,
        has_next=page < total_pages,
        has_previous=page > 1,
        data=[medical_record_document_to_response(record) for record in records],
    )


def update_medical_record(record_id: str, request: MedicalRecordUpdate) -> MedicalRecordResponse:
    existing = _records_collection().find_one({"record_id": record_id, "is_deleted": {"$ne": True}})
    if existing is None:
        raise MedicalRecordNotFoundError
    update_data = request.model_dump(exclude_unset=True, mode="python")
    if not update_data:
        return medical_record_document_to_response(existing)
    candidate = {**existing, **update_data}
    _validate_relationships(candidate["appointment_id"], candidate["patient_id"], candidate["doctor_id"])
    _ensure_appointment_has_no_record(candidate["appointment_id"], exclude_record_id=record_id)
    _serialize_follow_up_date(update_data)
    update_data["updated_at"] = datetime.now(timezone.utc)
    record = _records_collection().find_one_and_update(
        {"record_id": record_id, "is_deleted": {"$ne": True}},
        {"$set": update_data},
        return_document=ReturnDocument.AFTER,
    )
    if record is None:
        raise MedicalRecordNotFoundError
    logger.info("Medical record updated", extra={"record_id": record_id})
    return medical_record_document_to_response(record)


def delete_medical_record(record_id: str) -> None:
    now = datetime.now(timezone.utc)
    record = _records_collection().find_one_and_update(
        {"record_id": record_id, "is_deleted": {"$ne": True}},
        {"$set": {"is_deleted": True, "deleted_at": now, "updated_at": now}},
        return_document=ReturnDocument.AFTER,
    )
    if record is None:
        raise MedicalRecordNotFoundError
    logger.info("Medical record soft deleted", extra={"record_id": record_id})
