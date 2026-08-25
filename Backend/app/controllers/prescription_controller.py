from fastapi import HTTPException, status

from app.schemas.prescription import (
    PrescriptionCreate,
    PrescriptionListResponse,
    PrescriptionResponse,
    PrescriptionUpdate,
)
from app.services import prescription_service


def _not_found_error(exc: Exception) -> HTTPException:
    details = {
        prescription_service.PrescriptionMedicalRecordNotFoundError: "Medical record not found.",
        prescription_service.PrescriptionAppointmentNotFoundError: "Appointment not found.",
        prescription_service.PrescriptionPatientNotFoundError: "Patient not found.",
        prescription_service.PrescriptionDoctorNotFoundError: "Doctor not found.",
    }
    return HTTPException(
        status_code=status.HTTP_404_NOT_FOUND,
        detail=details.get(type(exc), "Prescription not found."),
    )


def create(request: PrescriptionCreate) -> PrescriptionResponse:
    try:
        return prescription_service.create_prescription(request)
    except (
        prescription_service.PrescriptionMedicalRecordNotFoundError,
        prescription_service.PrescriptionAppointmentNotFoundError,
        prescription_service.PrescriptionPatientNotFoundError,
        prescription_service.PrescriptionDoctorNotFoundError,
    ) as exc:
        raise _not_found_error(exc) from exc
    except prescription_service.PrescriptionMedicalRecordConflictError as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Prescription already exists for this medical record.") from exc


def list_all(
    page: int, limit: int, search: str | None, patient_id: str | None, doctor_id: str | None,
    appointment_id: str | None, medical_record_id: str | None,
) -> PrescriptionListResponse:
    return prescription_service.list_prescriptions(
        page, limit, search, patient_id, doctor_id, appointment_id, medical_record_id
    )


def get_one(prescription_id: str) -> PrescriptionResponse:
    try:
        return prescription_service.get_prescription(prescription_id)
    except prescription_service.PrescriptionNotFoundError as exc:
        raise _not_found_error(exc) from exc


def update(prescription_id: str, request: PrescriptionUpdate) -> PrescriptionResponse:
    try:
        return prescription_service.update_prescription(prescription_id, request)
    except (
        prescription_service.PrescriptionNotFoundError,
        prescription_service.PrescriptionMedicalRecordNotFoundError,
        prescription_service.PrescriptionAppointmentNotFoundError,
        prescription_service.PrescriptionPatientNotFoundError,
        prescription_service.PrescriptionDoctorNotFoundError,
    ) as exc:
        raise _not_found_error(exc) from exc
    except prescription_service.PrescriptionMedicalRecordConflictError as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Prescription already exists for this medical record.") from exc


def delete(prescription_id: str) -> None:
    try:
        prescription_service.delete_prescription(prescription_id)
    except prescription_service.PrescriptionNotFoundError as exc:
        raise _not_found_error(exc) from exc
