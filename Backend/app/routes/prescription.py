from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status

from app.controllers import prescription_controller
from app.schemas.auth import UserResponse
from app.schemas.prescription import (
    PRESCRIPTION_ERROR_RESPONSES,
    PrescriptionCreate,
    PrescriptionListResponse,
    PrescriptionResponse,
    PrescriptionUpdate,
)
from app.utils.security import require_patient_ownership, require_roles

router = APIRouter(prefix="/prescriptions", tags=["Prescriptions"])
ClinicalUser = Annotated[UserResponse, Depends(require_roles("doctor"))]
ReadUser = Annotated[UserResponse, Depends(require_roles("doctor", "pharmacy", "patient"))]


@router.post("", response_model=PrescriptionResponse, status_code=status.HTTP_201_CREATED, responses=PRESCRIPTION_ERROR_RESPONSES, summary="Create a prescription")
def create_prescription(request: PrescriptionCreate, current_user: ClinicalUser) -> PrescriptionResponse:
    if request.doctor_id != current_user.doctor_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Prescription doctor does not match the authenticated doctor.")
    return prescription_controller.create(request)


@router.get("", response_model=PrescriptionListResponse, responses=PRESCRIPTION_ERROR_RESPONSES, summary="List and search prescriptions")
def list_prescriptions(
    current_user: ReadUser,
    page: int = Query(default=1, ge=1),
    limit: int = Query(default=10, ge=1, le=100),
    search: str | None = Query(default=None, min_length=1, max_length=120),
    patient_id: str | None = Query(default=None),
    doctor_id: str | None = Query(default=None),
    appointment_id: str | None = Query(default=None),
    medical_record_id: str | None = Query(default=None),
) -> PrescriptionListResponse:
    if current_user.role.value == "patient":
        if not current_user.patient_id:
            return PrescriptionListResponse(total=0, page=page, limit=limit, total_pages=0, has_next=False, has_previous=False, data=[])
        patient_id = current_user.patient_id
    return prescription_controller.list_all(page, limit, search, patient_id, doctor_id, appointment_id, medical_record_id)


@router.get("/{prescription_id}", response_model=PrescriptionResponse, responses=PRESCRIPTION_ERROR_RESPONSES, summary="Get a prescription by ID")
def get_prescription(prescription_id: str, current_user: ReadUser) -> PrescriptionResponse:
    prescription = prescription_controller.get_one(prescription_id)
    require_patient_ownership(current_user, prescription.patient_id)
    return prescription


@router.put("/{prescription_id}", response_model=PrescriptionResponse, responses=PRESCRIPTION_ERROR_RESPONSES, summary="Update a prescription")
def update_prescription(prescription_id: str, request: PrescriptionUpdate, _: ClinicalUser) -> PrescriptionResponse:
    return prescription_controller.update(prescription_id, request)


@router.delete("/{prescription_id}", status_code=status.HTTP_204_NO_CONTENT, responses=PRESCRIPTION_ERROR_RESPONSES, summary="Soft delete a prescription")
def delete_prescription(prescription_id: str, _: ClinicalUser) -> Response:
    prescription_controller.delete(prescription_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
