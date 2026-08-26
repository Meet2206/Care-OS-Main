from __future__ import annotations
from fastapi import HTTPException, status

from app.schemas.medical_record import (
    MedicalRecordCreate,
    MedicalRecordListResponse,
    MedicalRecordResponse,
    MedicalRecordUpdate,
)
from app.services import medical_record_service


def _not_found_error(exc: Exception) -> HTTPException:
    if isinstance(exc, medical_record_service.MedicalRecordAppointmentNotFoundError):
        detail = "Appointment not found."
    elif isinstance(exc, medical_record_service.MedicalRecordPatientNotFoundError):
        detail = "Patient not found."
    elif isinstance(exc, medical_record_service.MedicalRecordDoctorNotFoundError):
        detail = "Doctor not found."
    else:
        detail = "Medical record not found."
    return HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=detail)


def create(request: MedicalRecordCreate) -> MedicalRecordResponse:
    try:
        return medical_record_service.create_medical_record(request)
    except (
        medical_record_service.MedicalRecordAppointmentNotFoundError,
        medical_record_service.MedicalRecordPatientNotFoundError,
        medical_record_service.MedicalRecordDoctorNotFoundError,
    ) as exc:
        raise _not_found_error(exc) from exc
    except medical_record_service.MedicalRecordAppointmentConflictError as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Medical record already exists for this appointment.",
        ) from exc


def list_all(
    page: int,
    limit: int,
    search: str | None,
    appointment_id: str | None,
    patient_id: str | None,
    doctor_id: str | None,
) -> MedicalRecordListResponse:
    return medical_record_service.list_medical_records(
        page, limit, search, appointment_id, patient_id, doctor_id
    )


def get_one(record_id: str) -> MedicalRecordResponse:
    try:
        return medical_record_service.get_medical_record(record_id)
    except medical_record_service.MedicalRecordNotFoundError as exc:
        raise _not_found_error(exc) from exc


def update(record_id: str, request: MedicalRecordUpdate) -> MedicalRecordResponse:
    try:
        return medical_record_service.update_medical_record(record_id, request)
    except (
        medical_record_service.MedicalRecordNotFoundError,
        medical_record_service.MedicalRecordAppointmentNotFoundError,
        medical_record_service.MedicalRecordPatientNotFoundError,
        medical_record_service.MedicalRecordDoctorNotFoundError,
    ) as exc:
        raise _not_found_error(exc) from exc
    except medical_record_service.MedicalRecordAppointmentConflictError as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Medical record already exists for this appointment.",
        ) from exc


def delete(record_id: str) -> None:
    try:
        medical_record_service.delete_medical_record(record_id)
    except medical_record_service.MedicalRecordNotFoundError as exc:
        raise _not_found_error(exc) from exc
