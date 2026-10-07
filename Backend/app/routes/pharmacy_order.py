from __future__ import annotations
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status

from app.schemas.auth import UserResponse, UserRole
from app.schemas.pharmacy_order import (
    PharmacyCollectRequest,
    PharmacyFulfillmentRequest,
    PharmacyOrderListResponse,
    PharmacyOrderResponse,
    PharmacyOrderStatus,
    PharmacyPaymentRequest,
    PharmacyOrderStatusUpdate,
)
from app.services.pharmacy_order_service import (
    collect_order,
    confirm_cash_payment,
    get_order,
    list_orders,
    pay_order,
    select_fulfillment,
    update_status,
    send_receipt_notification,
)
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
PatientUser = Annotated[UserResponse, Depends(require_roles(UserRole.patient))]


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


@router.post("/{order_id}/fulfillment", response_model=PharmacyOrderResponse)
def choose_fulfillment(order_id: str, request: PharmacyFulfillmentRequest, current_user: PatientUser) -> PharmacyOrderResponse:
    order = get_order(order_id)
    require_patient_ownership(current_user, order.patient_id)
    return select_fulfillment(order_id, request)


@router.post("/{order_id}/payment", response_model=PharmacyOrderResponse)
def pay_pharmacy_order(order_id: str, request: PharmacyPaymentRequest, current_user: PatientUser) -> PharmacyOrderResponse:
    order = get_order(order_id)
    require_patient_ownership(current_user, order.patient_id)
    return pay_order(order_id, request)


@router.post("/{order_id}/confirm-cash", response_model=PharmacyOrderResponse)
def confirm_order_cash(order_id: str, current_user: PharmacyUser) -> PharmacyOrderResponse:
    return confirm_cash_payment(order_id, current_user.user_id)


@router.post("/{order_id}/receipt", status_code=status.HTTP_204_NO_CONTENT)
def send_receipt(order_id: str, current_user: PharmacyUser):
    send_receipt_notification(order_id, current_user.user_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/{order_id}/collect", response_model=PharmacyOrderResponse)
def collect_pharmacy_order(order_id: str, request: PharmacyCollectRequest, current_user: PharmacyUser) -> PharmacyOrderResponse:
    return collect_order(order_id, request.pickup_token, current_user.user_id)


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
