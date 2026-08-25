from typing import Annotated

from fastapi import APIRouter, Depends

from app.schemas.auth import UserResponse
from app.schemas.pharmacy_order import PharmacyOrderListResponse, PharmacyOrderResponse, PharmacyOrderStatusUpdate
from app.services.pharmacy_order_service import get_order, list_orders, update_status
from app.utils.security import require_roles

router = APIRouter(prefix="/pharmacy-orders", tags=["Pharmacy Orders"])
ReadUser = Annotated[UserResponse, Depends(require_roles("doctor", "pharmacy", "patient", "receptionist", "admin"))]
PharmacyUser = Annotated[UserResponse, Depends(require_roles("pharmacy"))]


@router.get("", response_model=PharmacyOrderListResponse)
def list_pharmacy_orders(current_user: ReadUser) -> PharmacyOrderListResponse:
    return list_orders(current_user.patient_id if current_user.role.value == "patient" else None)


@router.get("/{order_id}", response_model=PharmacyOrderResponse)
def get_pharmacy_order(order_id: str, current_user: ReadUser) -> PharmacyOrderResponse:
    order = get_order(order_id)
    if current_user.role.value == "patient" and order.patient_id != current_user.patient_id:
        from fastapi import HTTPException, status
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Patients may access only their own pharmacy orders.")
    return order


@router.patch("/{order_id}/status", response_model=PharmacyOrderResponse)
def patch_pharmacy_order_status(order_id: str, request: PharmacyOrderStatusUpdate, _: PharmacyUser) -> PharmacyOrderResponse:
    return update_status(order_id, request.status)
