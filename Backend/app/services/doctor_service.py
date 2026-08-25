import logging
import re
from datetime import date, datetime, time, timezone

from pymongo import ReturnDocument
from pymongo.errors import DuplicateKeyError

from app.database.mongodb import db
from app.models.doctor import (
    COUNTERS_COLLECTION,
    DOCTOR_COUNTER_KEY,
    DOCTORS_COLLECTION,
    doctor_document_to_response,
)
from app.schemas.doctor import DoctorCreate, DoctorListResponse, DoctorResponse, DoctorUpdate

logger = logging.getLogger(__name__)


class DoctorNotFoundError(Exception):
    pass


class DuplicateDoctorEmailError(Exception):
    pass


class DuplicateDoctorLicenseError(Exception):
    pass


def _doctors_collection():
    return db[DOCTORS_COLLECTION]


def ensure_doctor_indexes() -> None:
    """Create the indexes required for doctor integrity and search operations."""
    collection = _doctors_collection()
    collection.create_index("doctor_id", unique=True, name="unique_doctor_id")
    collection.create_index("email", unique=True, name="unique_doctor_email")
    collection.create_index("license_number", unique=True, name="unique_doctor_license_number")
    collection.create_index("phone", name="doctor_phone")
    collection.create_index("department", name="doctor_department")
    collection.create_index("specialization", name="doctor_specialization")
    collection.create_index("is_deleted", name="doctor_is_deleted")


def _next_doctor_id() -> str:
    counter = db[COUNTERS_COLLECTION].find_one_and_update(
        {"_id": DOCTOR_COUNTER_KEY},
        {"$inc": {"sequence_value": 1}},
        upsert=True,
        return_document=ReturnDocument.AFTER,
    )
    return f"DOC{counter['sequence_value']:06d}"


def _serialize_date_of_birth(doctor_data: dict) -> None:
    date_of_birth = doctor_data.get("date_of_birth")
    if isinstance(date_of_birth, date) and not isinstance(date_of_birth, datetime):
        doctor_data["date_of_birth"] = datetime.combine(date_of_birth, time.min, tzinfo=timezone.utc)


def _active_doctor_by(field: str, value: str, exclude_doctor_id: str | None = None) -> bool:
    query: dict = {field: value, "is_deleted": {"$ne": True}}
    if exclude_doctor_id:
        query["doctor_id"] = {"$ne": exclude_doctor_id}
    return _doctors_collection().find_one(query) is not None


def _validate_unique_fields(doctor_data: dict, exclude_doctor_id: str | None = None) -> None:
    if "email" in doctor_data and _active_doctor_by("email", str(doctor_data["email"]), exclude_doctor_id):
        raise DuplicateDoctorEmailError
    if "license_number" in doctor_data and _active_doctor_by(
        "license_number", doctor_data["license_number"], exclude_doctor_id
    ):
        raise DuplicateDoctorLicenseError


def _duplicate_error(error: DuplicateKeyError) -> Exception:
    message = str(error).lower()
    if "license" in message:
        return DuplicateDoctorLicenseError()
    return DuplicateDoctorEmailError()


def create_doctor(request: DoctorCreate) -> DoctorResponse:
    ensure_doctor_indexes()
    doctor = request.model_dump(mode="python")
    _validate_unique_fields(doctor)
    _serialize_date_of_birth(doctor)
    now = datetime.now(timezone.utc)
    doctor.update(
        doctor_id=_next_doctor_id(),
        is_deleted=False,
        deleted_at=None,
        created_at=now,
        updated_at=now,
    )
    try:
        _doctors_collection().insert_one(doctor)
    except DuplicateKeyError as exc:
        raise _duplicate_error(exc) from exc

    logger.info("Doctor created", extra={"doctor_id": doctor["doctor_id"]})
    return doctor_document_to_response(doctor)


def get_doctor(doctor_id: str) -> DoctorResponse:
    doctor = _doctors_collection().find_one({"doctor_id": doctor_id, "is_deleted": {"$ne": True}})
    if doctor is None:
        raise DoctorNotFoundError
    return doctor_document_to_response(doctor)


def list_doctors(page: int, limit: int, search: str | None) -> DoctorListResponse:
    query: dict = {"is_deleted": {"$ne": True}}
    if search:
        pattern = re.escape(search.strip())
        query["$or"] = [
            {"doctor_id": {"$regex": pattern, "$options": "i"}},
            {"first_name": {"$regex": pattern, "$options": "i"}},
            {"last_name": {"$regex": pattern, "$options": "i"}},
            {"specialization": {"$regex": pattern, "$options": "i"}},
            {"department": {"$regex": pattern, "$options": "i"}},
            {"phone": {"$regex": pattern, "$options": "i"}},
            {"email": {"$regex": pattern, "$options": "i"}},
        ]

    collection = _doctors_collection()
    total = collection.count_documents(query)
    doctors = list(collection.find(query).sort("created_at", -1).skip((page - 1) * limit).limit(limit))
    total_pages = (total + limit - 1) // limit
    return DoctorListResponse(
        total=total,
        page=page,
        limit=limit,
        total_pages=total_pages,
        has_next=page < total_pages,
        has_previous=page > 1,
        data=[doctor_document_to_response(doctor) for doctor in doctors],
    )


def update_doctor(doctor_id: str, request: DoctorUpdate) -> DoctorResponse:
    doctor_data = request.model_dump(exclude_unset=True, mode="python")
    if not doctor_data:
        return get_doctor(doctor_id)
    _validate_unique_fields(doctor_data, exclude_doctor_id=doctor_id)
    _serialize_date_of_birth(doctor_data)
    doctor_data["updated_at"] = datetime.now(timezone.utc)
    doctor = _doctors_collection().find_one_and_update(
        {"doctor_id": doctor_id, "is_deleted": {"$ne": True}},
        {"$set": doctor_data},
        return_document=ReturnDocument.AFTER,
    )
    if doctor is None:
        raise DoctorNotFoundError
    logger.info("Doctor updated", extra={"doctor_id": doctor_id})
    return doctor_document_to_response(doctor)


def delete_doctor(doctor_id: str) -> None:
    now = datetime.now(timezone.utc)
    doctor = _doctors_collection().find_one_and_update(
        {"doctor_id": doctor_id, "is_deleted": {"$ne": True}},
        {"$set": {"is_deleted": True, "deleted_at": now, "updated_at": now}},
        return_document=ReturnDocument.AFTER,
    )
    if doctor is None:
        raise DoctorNotFoundError
    logger.info("Doctor soft deleted", extra={"doctor_id": doctor_id})
