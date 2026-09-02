from __future__ import annotations
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status

from app.controllers import medical_record_controller
from app.schemas.auth import UserResponse, UserRole
from app.schemas.medical_record import (
    MEDICAL_RECORD_ERROR_RESPONSES,
    MedicalRecordCreate,
    MedicalRecordListResponse,
    MedicalRecordResponse,
    MedicalRecordUpdate,
)
from app.utils.security import (
    require_doctor_patient_access,
    require_owning_doctor,
    require_patient_ownership,
    require_roles,
)

router = APIRouter(prefix="/medical-records", tags=["Medical Records"])
ClinicalUser = Annotated[UserResponse, Depends(require_roles(UserRole.doctor))]
ReadUser = Annotated[UserResponse, Depends(require_roles(UserRole.doctor, UserRole.patient))]
_EMPTY_PAGE = dict(total=0, total_pages=0, has_next=False, has_previous=False, data=[])


@router.post(
    "",
    response_model=MedicalRecordResponse,
    status_code=status.HTTP_201_CREATED,
    responses=MEDICAL_RECORD_ERROR_RESPONSES,
    summary="Create a medical record",
)
def create_medical_record(
    request: MedicalRecordCreate, current_user: ClinicalUser
) -> MedicalRecordResponse:
    if request.doctor_id != current_user.doctor_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Medical record doctor does not match the authenticated doctor.",
        )
    require_doctor_patient_access(current_user, request.patient_id)
    return medical_record_controller.create(request)


@router.get(
    "",
    response_model=MedicalRecordListResponse,
    responses=MEDICAL_RECORD_ERROR_RESPONSES,
    summary="List and search medical records",
)
def list_medical_records(
    current_user: ReadUser,
    page: int = Query(default=1, ge=1),
    limit: int = Query(default=10, ge=1, le=100),
    search: str | None = Query(default=None, min_length=1, max_length=120),
    appointment_id: str | None = Query(default=None),
    patient_id: str | None = Query(default=None),
    doctor_id: str | None = Query(default=None),
) -> MedicalRecordListResponse:
    if current_user.role == UserRole.patient:
        if not current_user.patient_id:
            return MedicalRecordListResponse(page=page, limit=limit, **_EMPTY_PAGE)
        patient_id = current_user.patient_id
    else:
        # `doctor_id` is a scope, not a caller-supplied filter.
        if not current_user.doctor_id:
            return MedicalRecordListResponse(page=page, limit=limit, **_EMPTY_PAGE)
        doctor_id = current_user.doctor_id
    return medical_record_controller.list_all(
        page, limit, search, appointment_id, patient_id, doctor_id
    )


@router.get(
    "/{record_id}",
    response_model=MedicalRecordResponse,
    responses=MEDICAL_RECORD_ERROR_RESPONSES,
    summary="Get a medical record by ID",
)
def get_medical_record(record_id: str, current_user: ReadUser) -> MedicalRecordResponse:
    record = medical_record_controller.get_one(record_id)
    require_patient_ownership(current_user, record.patient_id)
    require_doctor_patient_access(current_user, record.patient_id)
    return record


@router.put(
    "/{record_id}",
    response_model=MedicalRecordResponse,
    responses=MEDICAL_RECORD_ERROR_RESPONSES,
    summary="Update a medical record",
)
def update_medical_record(
    record_id: str, request: MedicalRecordUpdate, current_user: ClinicalUser
) -> MedicalRecordResponse:
    record = medical_record_controller.get_one(record_id)
    require_owning_doctor(current_user, record.doctor_id)
    return medical_record_controller.update(record_id, request)


@router.delete(
    "/{record_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    responses=MEDICAL_RECORD_ERROR_RESPONSES,
    summary="Soft delete a medical record",
)
def delete_medical_record(record_id: str, current_user: ClinicalUser) -> Response:
    record = medical_record_controller.get_one(record_id)
    require_owning_doctor(current_user, record.doctor_id)
    medical_record_controller.delete(record_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
