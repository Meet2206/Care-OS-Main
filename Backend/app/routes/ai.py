from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status

from app.schemas.ai import PatientPriorityRequest, PatientPriorityResponse, WaitTimeRequest, WaitTimeResponse
from app.schemas.auth import UserResponse
from app.services.ai_service import AIModelLoadError, predict_priority, predict_wait_time
from app.database.mongodb import db
from app.utils.security import require_patient_ownership, require_roles

router = APIRouter(prefix="/ai", tags=["AI Support"])
AIUser = Annotated[UserResponse, Depends(require_roles("doctor", "receptionist", "patient"))]


def _check_patient_access(user: UserResponse, patient_id: str | None) -> None:
    if user.role.value == "patient":
        if not patient_id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Patient ownership is required.")
        require_patient_ownership(user, patient_id)
    if user.role.value == "doctor" and patient_id:
        linked = db.appointments.find_one({"doctor_id": user.doctor_id, "patient_id": patient_id, "is_deleted": {"$ne": True}})
        linked = linked or db.medical_records.find_one({"doctor_id": user.doctor_id, "patient_id": patient_id, "is_deleted": {"$ne": True}})
        if linked is None:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Doctor is not authorized for this patient.")


@router.post("/patient-priority", response_model=PatientPriorityResponse)
def patient_priority(request: PatientPriorityRequest, current_user: AIUser) -> PatientPriorityResponse:
    _check_patient_access(current_user, request.patient_id)
    try:
        return predict_priority(request.model_dump())
    except AIModelLoadError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except (ValueError, TypeError) as exc:
        raise HTTPException(status_code=422, detail="The supplied AI input is invalid.") from exc


@router.post("/wait-time", response_model=WaitTimeResponse)
def wait_time(request: WaitTimeRequest, current_user: AIUser) -> WaitTimeResponse:
    _check_patient_access(current_user, request.patient_id)
    try:
        return predict_wait_time(request.model_dump())
    except AIModelLoadError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except (ValueError, TypeError) as exc:
        raise HTTPException(status_code=422, detail="The supplied AI input is invalid.") from exc
