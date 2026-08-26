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
from app.utils.security import get_current_user

router = APIRouter(prefix="/doctors", tags=["Doctors"])
CurrentUser = Annotated[UserResponse, Depends(get_current_user)]


@router.post(
    "",
    response_model=DoctorResponse,
    status_code=status.HTTP_201_CREATED,
    responses=DOCTOR_ERROR_RESPONSES,
    summary="Create a doctor",
)
def create_doctor(request: DoctorCreate, _: CurrentUser) -> DoctorResponse:
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
    summary="Update a doctor",
)
def update_doctor(doctor_id: str, request: DoctorUpdate, _: CurrentUser) -> DoctorResponse:
    return doctor_controller.update(doctor_id, request)


@router.delete(
    "/{doctor_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    responses=DOCTOR_ERROR_RESPONSES,
    summary="Soft delete a doctor",
)
def delete_doctor(doctor_id: str, _: CurrentUser) -> Response:
    doctor_controller.delete(doctor_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
