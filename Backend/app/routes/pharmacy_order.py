from __future__ import annotations
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.schemas.auth import UserResponse, UserRole
from app.schemas.pharmacy_order import (
    PharmacyOrderListResponse,
    PharmacyOrderResponse,
    PharmacyOrderStatus,
    PharmacyOrderStatusUpdate,
)
from app.services.pharmacy_order_service import get_order, list_orders, update_status
from app.utils.security import require_patient_ownership, require_roles

router = APIRouter(prefix="/pharmacy-orders", tags=["Pharmacy Orders"])
ReadUser = Annotated[
    UserResponse,
    Depends(
        require_roles(
            UserRole.doctor, UserRole.pharmacy, UserRole.patient,
            UserRole.receptionist, UserRole.admin,
        )
    ),
]
PharmacyUser = Annotated[UserResponse, Depends(require_roles(UserRole.pharmacy))]


@router.get("", response_model=PharmacyOrderListResponse, summary="List pharmacy orders")
def list_pharmacy_orders(
    current_user: ReadUser,
    page: int = Query(default=1, ge=1),
    limit: int = Query(default=20, ge=1, le=100),
    order_status: PharmacyOrderStatus | None = Query(default=None, alias="status"),
) -> PharmacyOrderListResponse:
    patient_id = None
    doctor_id = None
    if current_user.role == UserRole.patient:
        if not current_user.patient_id:
            return PharmacyOrderListResponse(total=0, page=page, limit=limit, data=[])
        patient_id = current_user.patient_id
    elif current_user.role == UserRole.doctor:
        if not current_user.doctor_id:
            return PharmacyOrderListResponse(total=0, page=page, limit=limit, data=[])
        doctor_id = current_user.doctor_id
    return list_orders(
        patient_id=patient_id,
        doctor_id=doctor_id,
        order_status=order_status,
        page=page,
        limit=limit,
    )


@router.get("/{order_id}", response_model=PharmacyOrderResponse, summary="Get one pharmacy order")
def get_pharmacy_order(order_id: str, current_user: ReadUser) -> PharmacyOrderResponse:
    order = get_order(order_id)
    require_patient_ownership(current_user, order.patient_id)
    if current_user.role == UserRole.doctor and order.doctor_id != current_user.doctor_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Doctors may access only orders from their own prescriptions.",
        )
    return order


@router.patch(
    "/{order_id}/status",
    response_model=PharmacyOrderResponse,
    summary="Advance a pharmacy order through its lifecycle",
)
def patch_pharmacy_order_status(
    order_id: str, request: PharmacyOrderStatusUpdate, current_user: PharmacyUser
) -> PharmacyOrderResponse:
    return update_status(order_id, request.status, pharmacy_id=current_user.user_id)
