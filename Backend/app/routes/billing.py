from __future__ import annotations
from typing import Annotated

from fastapi import APIRouter, Depends, Query, Response, status

from app.controllers import billing_controller
from app.schemas.auth import UserResponse, UserRole
from app.schemas.billing import (
    BillCreate,
    BillListResponse,
    BillResponse,
    BillUpdate,
    PaymentMethod,
    PaymentStatus,
)
from app.utils.security import require_patient_ownership, require_roles

router = APIRouter(prefix="/bills", tags=["Billing & Payments"])
# Reading a bill is broad; issuing or amending one is a finance action.
ReadUser = Annotated[
    UserResponse,
    Depends(require_roles(UserRole.doctor, UserRole.patient, UserRole.receptionist, UserRole.admin)),
]
BillingStaff = Annotated[
    UserResponse, Depends(require_roles(UserRole.admin, UserRole.receptionist))
]
AdminUser = Annotated[UserResponse, Depends(require_roles(UserRole.admin))]


@router.post(
    "",
    response_model=BillResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Issue a bill (billing staff only)",
)
def create_bill(request: BillCreate, _: BillingStaff) -> BillResponse:
    return billing_controller.create(request)


@router.get("", response_model=BillListResponse, summary="List and filter bills")
def list_bills(
    current_user: ReadUser,
    page: int = Query(1, ge=1),
    limit: int = Query(10, ge=1, le=100),
    search: str | None = None,
    patient_id: str | None = None,
    doctor_id: str | None = None,
    appointment_id: str | None = None,
    payment_status: PaymentStatus | None = Query(None, alias="payment_status"),
    payment_method: PaymentMethod | None = Query(None, alias="payment_method"),
) -> BillListResponse:
    if current_user.role == UserRole.patient:
        if not current_user.patient_id:
            return BillListResponse(
                total=0, page=page, limit=limit, total_pages=0,
                has_next=False, has_previous=False, data=[],
            )
        patient_id = current_user.patient_id
    elif current_user.role == UserRole.doctor:
        if not current_user.doctor_id:
            return BillListResponse(
                total=0, page=page, limit=limit, total_pages=0,
                has_next=False, has_previous=False, data=[],
            )
        doctor_id = current_user.doctor_id
    return billing_controller.list_all(
        page, limit, search, patient_id, doctor_id, appointment_id, payment_status, payment_method
    )


@router.get("/{bill_id}", response_model=BillResponse, summary="Get a bill by ID")
def get_bill(bill_id: str, current_user: ReadUser) -> BillResponse:
    bill = billing_controller.get_one(bill_id)
    require_patient_ownership(current_user, bill.patient_id)
    return bill


@router.put(
    "/{bill_id}",
    response_model=BillResponse,
    summary="Amend a bill (billing staff only)",
)
def update_bill(bill_id: str, request: BillUpdate, _: BillingStaff) -> BillResponse:
    # Patients and clinicians must not be able to alter charges or settle an
    # invoice; payment capture belongs to the billing desk or a gateway callback.
    billing_controller.get_one(bill_id)
    return billing_controller.update(bill_id, request)


@router.delete(
    "/{bill_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Void a bill (administrators only)",
)
def delete_bill(bill_id: str, _: AdminUser) -> Response:
    billing_controller.get_one(bill_id)
    billing_controller.delete(bill_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
