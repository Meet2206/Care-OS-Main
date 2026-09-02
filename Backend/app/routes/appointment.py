from __future__ import annotations
from datetime import date
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status

from app.controllers import appointment_controller
from app.schemas.appointment import (
    APPOINTMENT_ERROR_RESPONSES,
    AppointmentCreate,
    AppointmentListResponse,
    AppointmentResponse,
    AppointmentStatus,
    AppointmentUpdate,
)
from app.schemas.auth import UserResponse, UserRole
from app.utils.security import (
    require_doctor_patient_access,
    require_patient_ownership,
    require_roles,
)

router = APIRouter(prefix="/appointments", tags=["Appointments"])
# Pharmacy is excluded outright: dispensing never requires appointment access.
CurrentUser = Annotated[
    UserResponse,
    Depends(require_roles(UserRole.doctor, UserRole.patient, UserRole.receptionist, UserRole.admin)),
]
_EMPTY_PAGE = dict(total=0, total_pages=0, has_next=False, has_previous=False, data=[])


def _authorize(current_user: UserResponse, appointment: AppointmentResponse) -> None:
    require_patient_ownership(current_user, appointment.patient_id)
    if current_user.role == UserRole.doctor and appointment.doctor_id != current_user.doctor_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Doctors may access only their own appointments.",
        )


@router.post(
    "",
    response_model=AppointmentResponse,
    status_code=status.HTTP_201_CREATED,
    responses=APPOINTMENT_ERROR_RESPONSES,
    summary="Create an appointment",
)
def create_appointment(
    request: AppointmentCreate, current_user: CurrentUser
) -> AppointmentResponse:
    if current_user.role == UserRole.patient:
        if not current_user.patient_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="This account is not linked to a patient record.",
            )
        # A patient books only for themselves; the submitted ID is ignored.
        request = request.model_copy(update={"patient_id": current_user.patient_id})
    elif current_user.role == UserRole.doctor:
        if request.doctor_id != current_user.doctor_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Doctors may create appointments only for themselves.",
            )
        require_doctor_patient_access(current_user, request.patient_id)
    return appointment_controller.create(request)


@router.get(
    "",
    response_model=AppointmentListResponse,
    responses=APPOINTMENT_ERROR_RESPONSES,
    summary="List and filter appointments",
)
def list_appointments(
    current_user: CurrentUser,
    page: int = Query(default=1, ge=1),
    limit: int = Query(default=10, ge=1, le=100),
    search: str | None = Query(default=None, min_length=1, max_length=120),
    doctor_id: str | None = Query(default=None),
    patient_id: str | None = Query(default=None),
    appointment_status: AppointmentStatus | None = Query(default=None, alias="status"),
    appointment_date: date | None = Query(default=None),
) -> AppointmentListResponse:
    if current_user.role == UserRole.patient:
        if not current_user.patient_id:
            return AppointmentListResponse(page=page, limit=limit, **_EMPTY_PAGE)
        patient_id = current_user.patient_id
    elif current_user.role == UserRole.doctor:
        if not current_user.doctor_id:
            return AppointmentListResponse(page=page, limit=limit, **_EMPTY_PAGE)
        doctor_id = current_user.doctor_id
    return appointment_controller.list_all(
        page, limit, search, doctor_id, patient_id, appointment_status, appointment_date
    )


@router.get(
    "/{appointment_id}",
    response_model=AppointmentResponse,
    responses=APPOINTMENT_ERROR_RESPONSES,
    summary="Get an appointment by ID",
)
def get_appointment(appointment_id: str, current_user: CurrentUser) -> AppointmentResponse:
    appointment = appointment_controller.get_one(appointment_id)
    _authorize(current_user, appointment)
    return appointment


@router.put(
    "/{appointment_id}",
    response_model=AppointmentResponse,
    responses=APPOINTMENT_ERROR_RESPONSES,
    summary="Update an appointment",
)
def update_appointment(
    appointment_id: str, request: AppointmentUpdate, current_user: CurrentUser
) -> AppointmentResponse:
    appointment = appointment_controller.get_one(appointment_id)
    _authorize(current_user, appointment)
    return appointment_controller.update(appointment_id, request)


@router.delete(
    "/{appointment_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    responses=APPOINTMENT_ERROR_RESPONSES,
    summary="Soft delete an appointment",
)
def delete_appointment(appointment_id: str, current_user: CurrentUser) -> Response:
    appointment = appointment_controller.get_one(appointment_id)
    _authorize(current_user, appointment)
    appointment_controller.delete(appointment_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
