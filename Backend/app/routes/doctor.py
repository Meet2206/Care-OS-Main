from __future__ import annotations
from typing import Annotated

from fastapi import APIRouter, Depends, Query, Response, status

from app.controllers import doctor_controller
from app.schemas.auth import UserResponse
from app.schemas.doctor import (
    DOCTOR_ERROR_RESPONSES,
    DoctorCreate,
    DoctorListResponse,
    DoctorResponse,
    DoctorUpdate,
)
from app.utils.security import get_current_user, require_admin

router = APIRouter(prefix="/doctors", tags=["Doctors"])
# Reading the directory is needed by every portal (booking, assignment, lookup).
CurrentUser = Annotated[UserResponse, Depends(get_current_user)]
# Creating, amending, or retiring a clinician is an administrative action.
AdminUser = Annotated[UserResponse, Depends(require_admin)]


@router.post(
    "",
    response_model=DoctorResponse,
    status_code=status.HTTP_201_CREATED,
    responses=DOCTOR_ERROR_RESPONSES,
    summary="Create a doctor (administrators only)",
)
def create_doctor(request: DoctorCreate, _: AdminUser) -> DoctorResponse:
    return doctor_controller.create(request)


@router.get(
    "",
    response_model=DoctorListResponse,
    responses=DOCTOR_ERROR_RESPONSES,
    summary="List and search doctors",
)
def list_doctors(
    _: CurrentUser,
    page: int = Query(default=1, ge=1),
    limit: int = Query(default=10, ge=1, le=100),
    search: str | None = Query(default=None, min_length=1, max_length=120),
) -> DoctorListResponse:
    return doctor_controller.list_all(page=page, limit=limit, search=search)


@router.get(
    "/{doctor_id}",
    response_model=DoctorResponse,
    responses=DOCTOR_ERROR_RESPONSES,
    summary="Get a doctor by doctor ID",
)
def get_doctor(doctor_id: str, _: CurrentUser) -> DoctorResponse:
    return doctor_controller.get_one(doctor_id)


@router.put(
    "/{doctor_id}",
    response_model=DoctorResponse,
    responses=DOCTOR_ERROR_RESPONSES,
    summary="Update a doctor (administrators only)",
)
def update_doctor(doctor_id: str, request: DoctorUpdate, _: AdminUser) -> DoctorResponse:
    return doctor_controller.update(doctor_id, request)


@router.delete(
    "/{doctor_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    responses=DOCTOR_ERROR_RESPONSES,
    summary="Soft delete a doctor (administrators only)",
)
def delete_doctor(doctor_id: str, _: AdminUser) -> Response:
    doctor_controller.delete(doctor_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
