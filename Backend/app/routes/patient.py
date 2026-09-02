from __future__ import annotations
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status

from app.controllers import patient_controller
from app.schemas.auth import UserResponse, UserRole
from app.schemas.patient import (
    PATIENT_ERROR_RESPONSES,
    PatientCreate,
    PatientCreatedResponse,
    PatientListResponse,
    PatientResponse,
    PatientSelfUpdate,
    PatientUpdate,
)
from app.utils.security import (
    doctor_patient_ids,
    require_admin,
    require_doctor_patient_access,
    require_patient_ownership,
    require_roles,
)

router = APIRouter(prefix="/patients", tags=["Patients"])
PatientStaff = Annotated[
    UserResponse,
    Depends(require_roles(UserRole.admin, UserRole.receptionist)),
]
PatientAccess = Annotated[
    UserResponse,
    Depends(require_roles(UserRole.admin, UserRole.doctor, UserRole.receptionist, UserRole.patient)),
]


@router.post(
    "",
    response_model=PatientCreatedResponse,
    status_code=status.HTTP_201_CREATED,
    responses=PATIENT_ERROR_RESPONSES,
    summary="Create a patient",
)
def create_patient(request: PatientCreate, _: PatientStaff) -> PatientCreatedResponse:
    return patient_controller.create(request)


@router.get(
    "",
    response_model=PatientListResponse,
    responses=PATIENT_ERROR_RESPONSES,
    summary="List and search patients",
)
def list_patients(
    current_user: PatientAccess,
    page: int = Query(default=1, ge=1),
    limit: int = Query(default=10, ge=1, le=100),
    search: str | None = Query(default=None, min_length=1, max_length=120),
) -> PatientListResponse:
    if current_user.role == UserRole.patient:
        # A patient's "list" is their own record. Scoping here keeps the patient
        # portal working without exposing the staff-wide directory.
        allowed = {current_user.patient_id} if current_user.patient_id else set()
        return patient_controller.list_all(
            page=page, limit=limit, search=search, allowed_patient_ids=allowed
        )
    if current_user.role == UserRole.doctor:
        return patient_controller.list_all(
            page=page,
            limit=limit,
            search=search,
            allowed_patient_ids=doctor_patient_ids(current_user.doctor_id),
        )
    return patient_controller.list_all(page=page, limit=limit, search=search)


@router.get(
    "/{patient_id}",
    response_model=PatientResponse,
    responses=PATIENT_ERROR_RESPONSES,
    summary="Get a patient by patient ID",
)
def get_patient(patient_id: str, current_user: PatientAccess) -> PatientResponse:
    require_patient_ownership(current_user, patient_id)
    require_doctor_patient_access(current_user, patient_id)
    return patient_controller.get_one(patient_id)


@router.put(
    "/{patient_id}",
    response_model=PatientResponse,
    responses=PATIENT_ERROR_RESPONSES,
    summary="Update a patient",
)
def update_patient(
    patient_id: str, request: PatientUpdate, current_user: PatientAccess
) -> PatientResponse:
    require_patient_ownership(current_user, patient_id)
    require_doctor_patient_access(current_user, patient_id)
    if current_user.role == UserRole.patient:
        # Patients maintain their own contact details only. Clinical fields such
        # as blood group, allergies, and history are clinician-owned.
        supplied = request.model_dump(exclude_unset=True)
        allowed = set(PatientSelfUpdate.model_fields)
        rejected = sorted(set(supplied) - allowed)
        if rejected:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=(
                    "Patients may update only contact details. "
                    f"Ask your care team to change: {', '.join(rejected)}."
                ),
            )
        request = PatientUpdate(**supplied)
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
