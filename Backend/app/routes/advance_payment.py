from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status

from app.database.mongodb import db
from app.schemas.advance_payment import AdvancePaymentCreate, AdvancePaymentResponse
from app.schemas.auth import UserResponse, UserRole
from app.services import advance_payment_service
from app.utils.security import require_roles

router = APIRouter(prefix="/appointments", tags=["Advance Payments"])
PatientUser = Annotated[UserResponse, Depends(require_roles(UserRole.patient))]


@router.post(
    "/{appointment_id}/advance-payment",
    response_model=AdvancePaymentResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Capture a simulated 25% appointment advance",
)
def pay_advance(
    appointment_id: str,
    request: AdvancePaymentCreate,
    current_user: PatientUser,
) -> AdvancePaymentResponse:
    try:
        appointment = db["appointments"].find_one({
            "appointment_id": appointment_id,
            "is_deleted": {"$ne": True},
        })
        if appointment is None or appointment.get("patient_id") != current_user.patient_id:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Appointment not found.")
        return advance_payment_service.pay_advance(appointment_id, request)
    except advance_payment_service.AdvancePaymentInvalidError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    except advance_payment_service.AdvancePaymentNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Appointment or doctor not found.") from exc
    except advance_payment_service.AdvancePaymentConflictError as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="This appointment already has a payment.") from exc
