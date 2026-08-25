import logging
import re
from datetime import date, datetime, time, timezone

from pymongo import ReturnDocument
from pymongo.errors import DuplicateKeyError

from app.database.mongodb import db
from app.models.patient import (
    COUNTERS_COLLECTION,
    PATIENT_COUNTER_KEY,
    PATIENTS_COLLECTION,
    patient_document_to_response,
)
from app.schemas.patient import PatientCreate, PatientListResponse, PatientResponse, PatientUpdate

logger = logging.getLogger(__name__)


class PatientNotFoundError(Exception):
    pass


class PatientConflictError(Exception):
    pass


def _patients_collection():
    return db[PATIENTS_COLLECTION]


def ensure_patient_indexes() -> None:
    """Create the indexes needed by patient lookups and soft deletion."""
    _patients_collection().create_index("patient_id", unique=True, name="unique_patient_id")
    _patients_collection().create_index(
        "email",
        unique=True,
        partialFilterExpression={"email": {"$type": "string"}},
        name="unique_patient_email",
    )
    _patients_collection().create_index("phone", name="patient_phone")
    _patients_collection().create_index([("full_name", "text")], name="patient_full_name_text")
    _patients_collection().create_index("is_deleted", name="patient_is_deleted")


def _next_patient_id() -> str:
    counter = db[COUNTERS_COLLECTION].find_one_and_update(
        {"_id": PATIENT_COUNTER_KEY},
        {"$inc": {"sequence_value": 1}},
        upsert=True,
        return_document=ReturnDocument.AFTER,
    )
    return f"PAT{counter['sequence_value']:06d}"


def _serialize_date_of_birth(patient_data: dict) -> None:
    """Convert Pydantic's date value to a MongoDB-compatible UTC datetime."""
    date_of_birth = patient_data.get("date_of_birth")
    if isinstance(date_of_birth, date) and not isinstance(date_of_birth, datetime):
        patient_data["date_of_birth"] = datetime.combine(
            date_of_birth,
            time.min,
            tzinfo=timezone.utc,
        )


def create_patient(request: PatientCreate) -> PatientResponse:
    ensure_patient_indexes()
    now = datetime.now(timezone.utc)
    patient = request.model_dump(mode="python")
    _serialize_date_of_birth(patient)
    patient.update(
        patient_id=_next_patient_id(),
        created_at=now,
        updated_at=now,
        is_deleted=False,
        deleted_at=None,
    )

    try:
        _patients_collection().insert_one(patient)
    except DuplicateKeyError as exc:
        logger.warning("Patient creation rejected due to a duplicate patient identifier")
        raise PatientConflictError from exc

    logger.info("Patient created", extra={"patient_id": patient["patient_id"]})
    return patient_document_to_response(patient)


def get_patient(patient_id: str) -> PatientResponse:
    patient = _patients_collection().find_one(
        {"patient_id": patient_id, "is_deleted": {"$ne": True}}
    )
    if patient is None:
        raise PatientNotFoundError
    return patient_document_to_response(patient)


def list_patients(page: int, limit: int, search: str | None, allowed_patient_ids: set[str] | None = None) -> PatientListResponse:
    query: dict = {"is_deleted": {"$ne": True}}
    if allowed_patient_ids is not None:
        query["patient_id"] = {"$in": list(allowed_patient_ids)}
    if search:
        search_pattern = re.escape(search.strip())
        query["$or"] = [
            {"patient_id": {"$regex": search_pattern, "$options": "i"}},
            {"full_name": {"$regex": search_pattern, "$options": "i"}},
            {"phone": {"$regex": search_pattern, "$options": "i"}},
            {"email": {"$regex": search_pattern, "$options": "i"}},
        ]

    collection = _patients_collection()
    total = collection.count_documents(query)
    patients = list(
        collection.find(query)
        .sort("created_at", -1)
        .skip((page - 1) * limit)
        .limit(limit)
    )
    return PatientListResponse(
        total=total,
        page=page,
        limit=limit,
        total_pages=(total + limit - 1) // limit,
        has_next=page < ((total + limit - 1) // limit),
        has_previous=page > 1,
        data=[patient_document_to_response(patient) for patient in patients],
    )


def update_patient(patient_id: str, request: PatientUpdate) -> PatientResponse:
    update_data = request.model_dump(exclude_unset=True, mode="python")
    if not update_data:
        return get_patient(patient_id)

    _serialize_date_of_birth(update_data)
    update_data["updated_at"] = datetime.now(timezone.utc)
    patient = _patients_collection().find_one_and_update(
        {"patient_id": patient_id, "is_deleted": {"$ne": True}},
        {"$set": update_data},
        return_document=ReturnDocument.AFTER,
    )
    if patient is None:
        raise PatientNotFoundError

    logger.info("Patient updated", extra={"patient_id": patient_id})
    return patient_document_to_response(patient)


def delete_patient(patient_id: str) -> None:
    patient = _patients_collection().find_one_and_update(
        {"patient_id": patient_id, "is_deleted": {"$ne": True}},
        {
            "$set": {
                "is_deleted": True,
                "deleted_at": datetime.now(timezone.utc),
                "updated_at": datetime.now(timezone.utc),
            }
        },
        return_document=ReturnDocument.AFTER,
    )
    if patient is None:
        raise PatientNotFoundError
    logger.info("Patient soft deleted", extra={"patient_id": patient_id})
