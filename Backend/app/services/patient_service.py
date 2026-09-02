from __future__ import annotations
import logging
import re
from datetime import date, datetime, time, timezone

from pymongo import ReturnDocument
from pymongo.errors import DuplicateKeyError

from app.database.mongodb import db
from app.utils.serialization import serialize_documents
from app.models.patient import (
    COUNTERS_COLLECTION,
    PATIENT_COUNTER_KEY,
    PATIENTS_COLLECTION,
    patient_document_to_response,
)
from app.schemas.patient import (
    PatientCreate,
    PatientCreatedResponse,
    PatientListResponse,
    PatientResponse,
    PatientUpdate,
)
from app.services.auth_service import ensure_user_indexes, generate_temporary_password, hash_password

logger = logging.getLogger(__name__)


class PatientNotFoundError(Exception):
    pass


class PatientDoctorNotFoundError(Exception):
    """Raised when a registration references a doctor that does not exist."""


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


def create_patient_account(patient: dict) -> tuple[str, str]:
    """Create the linked patient login and return (login_id, temporary_password).

    Split out of create_patient so the credential policy has one home and can be
    exercised on its own.
    """
    ensure_user_indexes()
    now = datetime.now(timezone.utc)
    name_token = re.sub(r"[^A-Za-z0-9]", "", patient["full_name"])
    name_token = name_token or "Patient"
    name_token = name_token[0].upper() + name_token[1:]
    base_login = f"{name_token}@CareOS"
    login_id = base_login
    suffix = 2
    while db.users.find_one({"login_id": login_id}):
        login_id = f"{name_token}{suffix}@CareOS"
        suffix += 1
    # Randomly generated, not derived from the patient's name or date of birth,
    # and flagged so the account must rotate it at first sign-in.
    temporary_password = generate_temporary_password()
    account = {
        "login_id": login_id,
        "full_name": patient["full_name"],
        "first_name": patient["full_name"].split(maxsplit=1)[0],
        "last_name": patient["full_name"].partition(" ")[2] or None,
        "user_id": f"PATIENT-{patient['patient_id']}",
        "password_hash": hash_password(temporary_password),
        "role": "patient",
        "patient_id": patient["patient_id"],
        "created_at": now,
        "updated_at": now,
        "status": "Active",
        "must_change_password": True,
        "is_deleted": False,
        "deleted_at": None,
    }
    try:
        db.users.insert_one(account)
    except DuplicateKeyError as exc:
        # Compensate for the patient row already written; there is no multi-document
        # transaction here because the deployment target is a standalone mongod.
        _patients_collection().delete_one({"patient_id": patient["patient_id"]})
        raise PatientConflictError from exc
    logger.info(
        "Patient created",
        extra={"patient_id": patient["patient_id"], "account_login_id": login_id},
    )
    return login_id, temporary_password


def create_patient(request: PatientCreate) -> PatientResponse:
    ensure_patient_indexes()
    now = datetime.now(timezone.utc)
    patient = request.model_dump(mode="python")
    if patient.get("assigned_doctor_id"):
        assigned = db.doctors.find_one(
            {"doctor_id": patient["assigned_doctor_id"], "is_deleted": {"$ne": True}}
        )
        if assigned is None:
            raise PatientDoctorNotFoundError(patient["assigned_doctor_id"])
    else:
        # Fallback for single-clinician deployments where the registration form
        # has no doctor to choose from. With two or more doctors the caller must
        # supply assigned_doctor_id explicitly.
        active_doctors = list(
            db.doctors.find({"is_deleted": {"$ne": True}}, {"doctor_id": 1}).limit(2)
        )
        if len(active_doctors) == 1:
            patient["assigned_doctor_id"] = active_doctors[0]["doctor_id"]
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

    login_id, temporary_password = create_patient_account(patient)
    response = patient_document_to_response(patient).model_dump()
    response["account_login_id"] = login_id
    response["temporary_password"] = temporary_password
    return PatientCreatedResponse.model_validate(response)


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
        data=serialize_documents(patients, patient_document_to_response, identifier_field="patient_id"),
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
