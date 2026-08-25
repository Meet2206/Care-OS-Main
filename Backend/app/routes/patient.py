from typing import Annotated

from fastapi import APIRouter, Depends, Query, Response, status

from app.controllers import patient_controller
from app.database.mongodb import db
from app.schemas.auth import UserResponse, UserRole
from app.schemas.patient import (
    PATIENT_ERROR_RESPONSES,
    PatientCreate,
    PatientListResponse,
    PatientResponse,
    PatientUpdate,
)
from app.utils.security import require_admin, require_patient_ownership, require_roles

router = APIRouter(prefix="/patients", tags=["Patients"])
PatientStaff = Annotated[
    UserResponse,
    Depends(require_roles(UserRole.admin, UserRole.receptionist)),
]
PatientAccess = Annotated[
    UserResponse,
    Depends(require_roles(UserRole.admin, UserRole.doctor, UserRole.receptionist, UserRole.patient)),
]


def _doctor_can_access_patient(current_user: UserResponse, patient_id: str) -> bool:
    if current_user.role.value != "doctor":
        return True
    if not current_user.doctor_id:
        return False
    return db.appointments.find_one({"doctor_id": current_user.doctor_id, "patient_id": patient_id, "is_deleted": {"$ne": True}}) is not None or db.medical_records.find_one({"doctor_id": current_user.doctor_id, "patient_id": patient_id, "is_deleted": {"$ne": True}}) is not None


@router.post(
    "",
    response_model=PatientResponse,
    status_code=status.HTTP_201_CREATED,
    responses=PATIENT_ERROR_RESPONSES,
    summary="Create a patient",
)
def create_patient(request: PatientCreate, _: PatientStaff) -> PatientResponse:
    return patient_controller.create(request)


@router.get(
    "",
    response_model=PatientListResponse,
    responses=PATIENT_ERROR_RESPONSES,
    summary="List and search patients",
)
def list_patients(
    current_user: Annotated[UserResponse, Depends(require_roles(UserRole.admin, UserRole.receptionist, UserRole.doctor))],
    page: int = Query(default=1, ge=1),
    limit: int = Query(default=10, ge=1, le=100),
    search: str | None = Query(default=None, min_length=1, max_length=120),
) -> PatientListResponse:
    if current_user.role.value == "doctor":
        if not current_user.doctor_id:
            return patient_controller.list_all(page=page, limit=limit, search=search, allowed_patient_ids=set())
        patient_ids = {item["patient_id"] for item in db.appointments.find({"doctor_id": current_user.doctor_id, "is_deleted": {"$ne": True}}, {"patient_id": 1})}
        patient_ids.update(item["patient_id"] for item in db.medical_records.find({"doctor_id": current_user.doctor_id, "is_deleted": {"$ne": True}}, {"patient_id": 1}))
        if not patient_ids:
            return patient_controller.list_all(page=page, limit=limit, search=search, allowed_patient_ids=set())
        return patient_controller.list_all(page=page, limit=limit, search=search, allowed_patient_ids=patient_ids)
    return patient_controller.list_all(page=page, limit=limit, search=search)


@router.get(
    "/{patient_id}",
    response_model=PatientResponse,
    responses=PATIENT_ERROR_RESPONSES,
    summary="Get a patient by patient ID",
)
def get_patient(patient_id: str, current_user: PatientAccess) -> PatientResponse:
    if not _doctor_can_access_patient(current_user, patient_id):
        raise HTTPException(status_code=403, detail="Doctor is not assigned to this patient.")
    patient = patient_controller.get_one(patient_id)
    require_patient_ownership(current_user, patient.patient_id)
    return patient


@router.put(
    "/{patient_id}",
    response_model=PatientResponse,
    responses=PATIENT_ERROR_RESPONSES,
    summary="Update a patient",
)
def update_patient(patient_id: str, request: PatientUpdate, current_user: PatientAccess) -> PatientResponse:
    if not _doctor_can_access_patient(current_user, patient_id):
        raise HTTPException(status_code=403, detail="Doctor is not assigned to this patient.")
    require_patient_ownership(current_user, patient_id)
    return patient_controller.update(patient_id, request)


@router.delete(
    "/{patient_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    responses=PATIENT_ERROR_RESPONSES,
    summary="Delete a patient",
)
def delete_patient(patient_id: str, _: Annotated[UserResponse, Depends(require_admin)]) -> Response:
    patient_controller.delete(patient_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
