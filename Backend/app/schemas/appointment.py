from __future__ import annotations
from datetime import date, datetime, time
from enum import Enum
from typing import Any

from pydantic import BaseModel, ConfigDict, Field


class AppointmentType(str, Enum):
    general_consultation = "General Consultation"
    follow_up = "Follow-up"
    emergency = "Emergency"
    routine_checkup = "Routine Checkup"
    online_consultation = "Online Consultation"


class AppointmentStatus(str, Enum):
    scheduled = "Scheduled"
    completed = "Completed"
    cancelled = "Cancelled"
    no_show = "No Show"


class AppointmentBase(BaseModel):
    patient_id: str = Field(min_length=1, max_length=30)
    doctor_id: str = Field(min_length=1, max_length=30)
    appointment_date: date
    appointment_time: time
    appointment_type: AppointmentType
    reason: str = Field(min_length=1, max_length=500)
    notes: str | None = Field(default=None, max_length=2000)
    status: AppointmentStatus = AppointmentStatus.scheduled


class AppointmentCreate(AppointmentBase):
    model_config = ConfigDict(
        json_schema_extra={
            "examples": [
                {
                    "patient_id": "PAT000001",
                    "doctor_id": "DOC000001",
                    "appointment_date": "2026-08-05",
                    "appointment_time": "10:30:00",
                    "appointment_type": "General Consultation",
                    "reason": "Recurring chest discomfort",
                    "notes": "Patient requested an early appointment.",
                    "status": "Scheduled",
                }
            ]
        }
    )


class AppointmentUpdate(BaseModel):
    patient_id: str | None = Field(default=None, min_length=1, max_length=30)
    doctor_id: str | None = Field(default=None, min_length=1, max_length=30)
    appointment_date: date | None = None
    appointment_time: time | None = None
    appointment_type: AppointmentType | None = None
    reason: str | None = Field(default=None, min_length=1, max_length=500)
    notes: str | None = Field(default=None, max_length=2000)
    status: AppointmentStatus | None = None


class AppointmentResponse(AppointmentBase):
    model_config = ConfigDict(
        json_schema_extra={
            "examples": [
                {
                    "appointment_id": "APT000001",
                    "patient_id": "PAT000001",
                    "doctor_id": "DOC000001",
                    "appointment_date": "2026-08-05",
                    "appointment_time": "10:30:00",
                    "appointment_type": "General Consultation",
                    "reason": "Recurring chest discomfort",
                    "notes": "Patient requested an early appointment.",
                    "status": "Scheduled",
                    "created_at": "2026-08-01T08:00:00Z",
                    "updated_at": "2026-08-01T08:00:00Z",
                }
            ]
        }
    )

    appointment_id: str
    created_at: datetime
    updated_at: datetime


class AppointmentListResponse(BaseModel):
    total: int
    page: int
    limit: int
    total_pages: int
    has_next: bool
    has_previous: bool
    data: list[AppointmentResponse]


class AppointmentErrorResponse(BaseModel):
    detail: str


class AppointmentValidationErrorResponse(AppointmentErrorResponse):
    errors: list[dict[str, Any]] | None = None


APPOINTMENT_ERROR_RESPONSES = {
    400: {"model": AppointmentErrorResponse, "description": "Bad request."},
    401: {"model": AppointmentErrorResponse, "description": "Authentication is required."},
    403: {"model": AppointmentErrorResponse, "description": "The authenticated user lacks permission."},
    404: {"model": AppointmentErrorResponse, "description": "Appointment, patient, or doctor not found."},
    409: {"model": AppointmentErrorResponse, "description": "Doctor is already booked for the requested time."},
    422: {"model": AppointmentValidationErrorResponse, "description": "Request validation failed."},
}
