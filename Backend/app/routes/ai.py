from __future__ import annotations
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status

from app.schemas.ai import (
    AIInputSchemaResponse,
    PatientPriorityRequest,
    PatientPriorityResponse,
    WaitTimeRequest,
    WaitTimeResponse,
)
from app.schemas.auth import UserResponse, UserRole
from app.services.ai_service import (
    AIInputError,
    AIModelLoadError,
    input_schema,
    predict_priority,
    predict_wait_time,
)
from app.utils.security import require_doctor_patient_access, require_patient_ownership, require_roles

router = APIRouter(prefix="/ai", tags=["AI Support"])
AIUser = Annotated[
    UserResponse, Depends(require_roles(UserRole.doctor, UserRole.receptionist, UserRole.patient))
]


def _check_patient_access(user: UserResponse, patient_id: str) -> None:
    """Every prediction is tied to a patient the caller is entitled to see.

    `patient_id` is mandatory on both request models, so there is no unscoped
    path through this check.
    """
    require_patient_ownership(user, patient_id)
    require_doctor_patient_access(user, patient_id)


def _run(callable_, payload: dict):
    try:
        return callable_(payload)
    except AIModelLoadError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="CareAI is temporarily unavailable.",
        ) from exc
    except AIInputError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(exc)
        ) from exc
    except (ValueError, TypeError) as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="The supplied AI input is invalid.",
        ) from exc


@router.get(
    "/schema",
    response_model=AIInputSchemaResponse,
    summary="Get the input domain both CareAI models were trained on",
)
def get_ai_schema(_: AIUser) -> AIInputSchemaResponse:
    try:
        return AIInputSchemaResponse(**input_schema())
    except AIModelLoadError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="CareAI is temporarily unavailable.",
        ) from exc


@router.post("/patient-priority", response_model=PatientPriorityResponse)
def patient_priority(
    request: PatientPriorityRequest, current_user: AIUser
) -> PatientPriorityResponse:
    _check_patient_access(current_user, request.patient_id)
    return _run(predict_priority, request.model_dump())


@router.post("/wait-time", response_model=WaitTimeResponse)
def wait_time(request: WaitTimeRequest, current_user: AIUser) -> WaitTimeResponse:
    _check_patient_access(current_user, request.patient_id)
    return _run(predict_wait_time, request.model_dump())
