from fastapi import HTTPException, status

from app.schemas.patient import PatientCreate, PatientListResponse, PatientResponse, PatientUpdate
from app.services import patient_service


def _not_found_error(exc: Exception) -> HTTPException:
    return HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Patient not found.")


def create(request: PatientCreate) -> PatientResponse:
    try:
        return patient_service.create_patient(request)
    except patient_service.PatientConflictError as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="A patient with this identifier already exists.",
        ) from exc


def list_all(page: int, limit: int, search: str | None, allowed_patient_ids: set[str] | None = None) -> PatientListResponse:
    return patient_service.list_patients(page=page, limit=limit, search=search, allowed_patient_ids=allowed_patient_ids)


def get_one(patient_id: str) -> PatientResponse:
    try:
        return patient_service.get_patient(patient_id)
    except patient_service.PatientNotFoundError as exc:
        raise _not_found_error(exc) from exc


def update(patient_id: str, request: PatientUpdate) -> PatientResponse:
    try:
        return patient_service.update_patient(patient_id, request)
    except patient_service.PatientNotFoundError as exc:
        raise _not_found_error(exc) from exc


def delete(patient_id: str) -> None:
    try:
        patient_service.delete_patient(patient_id)
    except patient_service.PatientNotFoundError as exc:
        raise _not_found_error(exc) from exc
