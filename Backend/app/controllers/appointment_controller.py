from datetime import date

from fastapi import HTTPException, status

from app.schemas.appointment import (
    AppointmentCreate,
    AppointmentListResponse,
    AppointmentResponse,
    AppointmentStatus,
    AppointmentUpdate,
)
from app.services import appointment_service


def _not_found_error(exc: Exception) -> HTTPException:
    if isinstance(exc, appointment_service.AppointmentPatientNotFoundError):
        detail = "Patient not found."
    elif isinstance(exc, appointment_service.AppointmentDoctorNotFoundError):
        detail = "Doctor not found."
    else:
        detail = "Appointment not found."
    return HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=detail)


def create(request: AppointmentCreate) -> AppointmentResponse:
    try:
        return appointment_service.create_appointment(request)
    except (
        appointment_service.AppointmentPatientNotFoundError,
        appointment_service.AppointmentDoctorNotFoundError,
    ) as exc:
        raise _not_found_error(exc) from exc
    except appointment_service.DoctorScheduleConflictError as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Doctor already has an appointment at this time.",
        ) from exc


def list_all(
    page: int,
    limit: int,
    search: str | None,
    doctor_id: str | None,
    patient_id: str | None,
    appointment_status: AppointmentStatus | None,
    appointment_date: date | None,
) -> AppointmentListResponse:
    return appointment_service.list_appointments(
        page, limit, search, doctor_id, patient_id, appointment_status, appointment_date
    )


def get_one(appointment_id: str) -> AppointmentResponse:
    try:
        return appointment_service.get_appointment(appointment_id)
    except appointment_service.AppointmentNotFoundError as exc:
        raise _not_found_error(exc) from exc


def update(appointment_id: str, request: AppointmentUpdate) -> AppointmentResponse:
    try:
        return appointment_service.update_appointment(appointment_id, request)
    except (
        appointment_service.AppointmentNotFoundError,
        appointment_service.AppointmentPatientNotFoundError,
        appointment_service.AppointmentDoctorNotFoundError,
    ) as exc:
        raise _not_found_error(exc) from exc
    except appointment_service.DoctorScheduleConflictError as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Doctor already has an appointment at this time.",
        ) from exc


def delete(appointment_id: str) -> None:
    try:
        appointment_service.delete_appointment(appointment_id)
    except appointment_service.AppointmentNotFoundError as exc:
        raise _not_found_error(exc) from exc
