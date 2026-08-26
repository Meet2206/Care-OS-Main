from __future__ import annotations
from fastapi import HTTPException, status

from app.schemas.doctor import DoctorCreate, DoctorListResponse, DoctorResponse, DoctorUpdate
from app.services import doctor_service


def _not_found_error(exc: Exception) -> HTTPException:
    return HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Doctor not found.")


def _conflict_error(exc: Exception) -> HTTPException:
    if isinstance(exc, doctor_service.DuplicateDoctorLicenseError):
        detail = "A doctor with this license number already exists."
    else:
        detail = "A doctor with this email already exists."
    return HTTPException(status_code=status.HTTP_409_CONFLICT, detail=detail)


def create(request: DoctorCreate) -> DoctorResponse:
    try:
        return doctor_service.create_doctor(request)
    except (doctor_service.DuplicateDoctorEmailError, doctor_service.DuplicateDoctorLicenseError) as exc:
        raise _conflict_error(exc) from exc


def list_all(page: int, limit: int, search: str | None) -> DoctorListResponse:
    return doctor_service.list_doctors(page=page, limit=limit, search=search)


def get_one(doctor_id: str) -> DoctorResponse:
    try:
        return doctor_service.get_doctor(doctor_id)
    except doctor_service.DoctorNotFoundError as exc:
        raise _not_found_error(exc) from exc


def update(doctor_id: str, request: DoctorUpdate) -> DoctorResponse:
    try:
        return doctor_service.update_doctor(doctor_id, request)
    except (doctor_service.DuplicateDoctorEmailError, doctor_service.DuplicateDoctorLicenseError) as exc:
        raise _conflict_error(exc) from exc
    except doctor_service.DoctorNotFoundError as exc:
        raise _not_found_error(exc) from exc


def delete(doctor_id: str) -> None:
    try:
        doctor_service.delete_doctor(doctor_id)
    except doctor_service.DoctorNotFoundError as exc:
        raise _not_found_error(exc) from exc
