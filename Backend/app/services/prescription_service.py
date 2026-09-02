from __future__ import annotations
import logging
import re
from datetime import datetime, timezone

from pymongo import ReturnDocument
from pymongo.errors import DuplicateKeyError

from app.database.mongodb import db
from app.utils.serialization import serialize_documents
from app.models.appointment import APPOINTMENTS_COLLECTION
from app.models.doctor import DOCTORS_COLLECTION
from app.models.medical_record import MEDICAL_RECORDS_COLLECTION
from app.models.patient import PATIENTS_COLLECTION
from app.models.prescription import (
    COUNTERS_COLLECTION,
    PRESCRIPTION_COUNTER_KEY,
    PRESCRIPTIONS_COLLECTION,
    prescription_document_to_response,
)
from app.schemas.prescription import (
    PrescriptionCreate,
    PrescriptionListResponse,
    PrescriptionResponse,
    PrescriptionUpdate,
)
from app.services.pharmacy_order_service import create_for_prescription

logger = logging.getLogger(__name__)


class PrescriptionNotFoundError(Exception):
    pass


class PrescriptionMedicalRecordNotFoundError(Exception):
    pass


class PrescriptionAppointmentNotFoundError(Exception):
    pass


class PrescriptionPatientNotFoundError(Exception):
    pass


class PrescriptionDoctorNotFoundError(Exception):
    pass


class PrescriptionMedicalRecordConflictError(Exception):
    pass


def _prescriptions_collection():
    return db[PRESCRIPTIONS_COLLECTION]


def ensure_prescription_indexes() -> None:
    """Create indexes for prescription lookups and one-per-record integrity."""
    collection = _prescriptions_collection()
    collection.create_index("prescription_id", unique=True, name="unique_prescription_id")
    collection.create_index("medical_record_id", unique=True, name="unique_prescription_medical_record")
    collection.create_index("appointment_id", name="prescription_appointment_id")
    collection.create_index("patient_id", name="prescription_patient_id")
    collection.create_index("doctor_id", name="prescription_doctor_id")
    collection.create_index("medicines.medicine_name", name="prescription_medicine_name")
    collection.create_index("is_deleted", name="prescription_is_deleted")


def _next_prescription_id() -> str:
    counter = db[COUNTERS_COLLECTION].find_one_and_update(
        {"_id": PRESCRIPTION_COUNTER_KEY},
        {"$inc": {"sequence_value": 1}},
        upsert=True,
        return_document=ReturnDocument.AFTER,
    )
    return f"PR{counter['sequence_value']:06d}"


def _active_document_exists(collection_name: str, identifier_field: str, identifier: str) -> bool:
    return db[collection_name].find_one(
        {identifier_field: identifier, "is_deleted": {"$ne": True}}
    ) is not None


def _validate_relationships(data: dict) -> None:
    record = db[MEDICAL_RECORDS_COLLECTION].find_one({"record_id": data["medical_record_id"], "is_deleted": {"$ne": True}})
    appointment = db[APPOINTMENTS_COLLECTION].find_one({"appointment_id": data["appointment_id"], "is_deleted": {"$ne": True}})
    if record is None:
        raise PrescriptionMedicalRecordNotFoundError
    if appointment is None:
        raise PrescriptionAppointmentNotFoundError
    if not _active_document_exists(PATIENTS_COLLECTION, "patient_id", data["patient_id"]):
        raise PrescriptionPatientNotFoundError
    if not _active_document_exists(DOCTORS_COLLECTION, "doctor_id", data["doctor_id"]):
        raise PrescriptionDoctorNotFoundError
    if record["appointment_id"] != data["appointment_id"] or record["patient_id"] != data["patient_id"] or record["doctor_id"] != data["doctor_id"]:
        raise PrescriptionMedicalRecordNotFoundError
    if appointment["patient_id"] != data["patient_id"] or appointment["doctor_id"] != data["doctor_id"]:
        raise PrescriptionAppointmentNotFoundError


def _ensure_record_has_no_prescription(record_id: str, exclude_prescription_id: str | None = None) -> None:
    query: dict = {"medical_record_id": record_id, "is_deleted": {"$ne": True}}
    if exclude_prescription_id:
        query["prescription_id"] = {"$ne": exclude_prescription_id}
    if _prescriptions_collection().find_one(query) is not None:
        raise PrescriptionMedicalRecordConflictError


def create_prescription(request: PrescriptionCreate) -> PrescriptionResponse:
    ensure_prescription_indexes()
    prescription = request.model_dump(mode="python")
    _validate_relationships(prescription)
    _ensure_record_has_no_prescription(prescription["medical_record_id"])
    now = datetime.now(timezone.utc)
    prescription.update(
        prescription_id=_next_prescription_id(),
        is_deleted=False,
        deleted_at=None,
        created_at=now,
        updated_at=now,
    )
    try:
        _prescriptions_collection().insert_one(prescription)
    except DuplicateKeyError as exc:
        raise PrescriptionMedicalRecordConflictError from exc
    logger.info("Prescription created", extra={"prescription_id": prescription["prescription_id"]})
    create_for_prescription(prescription)
    return prescription_document_to_response(prescription)


def get_prescription(prescription_id: str) -> PrescriptionResponse:
    prescription = _prescriptions_collection().find_one(
        {"prescription_id": prescription_id, "is_deleted": {"$ne": True}}
    )
    if prescription is None:
        raise PrescriptionNotFoundError
    return prescription_document_to_response(prescription)


def list_prescriptions(
    page: int,
    limit: int,
    search: str | None,
    patient_id: str | None,
    doctor_id: str | None,
    appointment_id: str | None,
    medical_record_id: str | None,
) -> PrescriptionListResponse:
    query: dict = {"is_deleted": {"$ne": True}}
    for field, value in {
        "patient_id": patient_id,
        "doctor_id": doctor_id,
        "appointment_id": appointment_id,
        "medical_record_id": medical_record_id,
    }.items():
        if value:
            query[field] = value
    if search:
        pattern = re.escape(search.strip())
        query["$or"] = [
            {"prescription_id": {"$regex": pattern, "$options": "i"}},
            {"medical_record_id": {"$regex": pattern, "$options": "i"}},
            {"appointment_id": {"$regex": pattern, "$options": "i"}},
            {"patient_id": {"$regex": pattern, "$options": "i"}},
            {"doctor_id": {"$regex": pattern, "$options": "i"}},
            {"medicines.medicine_name": {"$regex": pattern, "$options": "i"}},
        ]
    collection = _prescriptions_collection()
    total = collection.count_documents(query)
    prescriptions = list(collection.find(query).sort("created_at", -1).skip((page - 1) * limit).limit(limit))
    total_pages = (total + limit - 1) // limit
    return PrescriptionListResponse(
        total=total,
        page=page,
        limit=limit,
        total_pages=total_pages,
        has_next=page < total_pages,
        has_previous=page > 1,
        data=serialize_documents(prescriptions, prescription_document_to_response, identifier_field="prescription_id"),
    )


def update_prescription(prescription_id: str, request: PrescriptionUpdate) -> PrescriptionResponse:
    existing = _prescriptions_collection().find_one(
        {"prescription_id": prescription_id, "is_deleted": {"$ne": True}}
    )
    if existing is None:
        raise PrescriptionNotFoundError
    update_data = request.model_dump(exclude_unset=True, mode="python")
    if not update_data:
        return prescription_document_to_response(existing)
    candidate = {**existing, **update_data}
    _validate_relationships(candidate)
    _ensure_record_has_no_prescription(candidate["medical_record_id"], prescription_id)
    update_data["updated_at"] = datetime.now(timezone.utc)
    prescription = _prescriptions_collection().find_one_and_update(
        {"prescription_id": prescription_id, "is_deleted": {"$ne": True}},
        {"$set": update_data},
        return_document=ReturnDocument.AFTER,
    )
    if prescription is None:
        raise PrescriptionNotFoundError
    logger.info("Prescription updated", extra={"prescription_id": prescription_id})
    return prescription_document_to_response(prescription)


def delete_prescription(prescription_id: str) -> None:
    now = datetime.now(timezone.utc)
    prescription = _prescriptions_collection().find_one_and_update(
        {"prescription_id": prescription_id, "is_deleted": {"$ne": True}},
        {"$set": {"is_deleted": True, "deleted_at": now, "updated_at": now}},
        return_document=ReturnDocument.AFTER,
    )
    if prescription is None:
        raise PrescriptionNotFoundError
    logger.info("Prescription soft deleted", extra={"prescription_id": prescription_id})
