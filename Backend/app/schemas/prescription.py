from __future__ import annotations
from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, Field


class Medicine(BaseModel):
    medicine_id: str = Field(min_length=1, max_length=40)
    medicine_name: str = Field(min_length=1, max_length=150)
    dosage: str = Field(min_length=1, max_length=100)
    frequency: str = Field(min_length=1, max_length=100)
    duration: str = Field(min_length=1, max_length=100)
    instructions: str | None = Field(default=None, max_length=500)


class PrescriptionBase(BaseModel):
    medical_record_id: str = Field(min_length=1, max_length=30)
    appointment_id: str = Field(min_length=1, max_length=30)
    patient_id: str = Field(min_length=1, max_length=30)
    doctor_id: str = Field(min_length=1, max_length=30)
    medicines: list[Medicine] = Field(min_length=1, max_length=25)


class PrescriptionCreate(PrescriptionBase):
    model_config = ConfigDict(
        json_schema_extra={
            "examples": [
                {
                    "medical_record_id": "MR000001",
                    "appointment_id": "APT000001",
                    "patient_id": "PAT000001",
                    "doctor_id": "DOC000001",
                    "medicines": [
                        {
                            "medicine_name": "Paracetamol",
                            "dosage": "650 mg",
                            "frequency": "3 times daily",
                            "duration": "5 days",
                            "instructions": "After meals",
                        }
                    ],
                }
            ]
        }
    )


class PrescriptionUpdate(BaseModel):
    medical_record_id: str | None = Field(default=None, min_length=1, max_length=30)
    appointment_id: str | None = Field(default=None, min_length=1, max_length=30)
    patient_id: str | None = Field(default=None, min_length=1, max_length=30)
    doctor_id: str | None = Field(default=None, min_length=1, max_length=30)
    medicines: list[Medicine] | None = Field(default=None, min_length=1, max_length=25)


class PrescriptionResponse(PrescriptionBase):
    model_config = ConfigDict(
        json_schema_extra={
            "examples": [
                {
                    "prescription_id": "PR000001",
                    "medical_record_id": "MR000001",
                    "appointment_id": "APT000001",
                    "patient_id": "PAT000001",
                    "doctor_id": "DOC000001",
                    "medicines": [
                        {
                            "medicine_name": "Paracetamol",
                            "dosage": "650 mg",
                            "frequency": "3 times daily",
                            "duration": "5 days",
                            "instructions": "After meals",
                        }
                    ],
                    "created_at": "2026-08-05T10:30:00Z",
                    "updated_at": "2026-08-05T10:30:00Z",
                }
            ]
        }
    )

    prescription_id: str
    created_at: datetime
    updated_at: datetime


class PrescriptionListResponse(BaseModel):
    total: int
    page: int
    limit: int
    total_pages: int
    has_next: bool
    has_previous: bool
    data: list[PrescriptionResponse]


class PrescriptionErrorResponse(BaseModel):
    detail: str


class PrescriptionValidationErrorResponse(PrescriptionErrorResponse):
    errors: list[dict[str, Any]] | None = None


PRESCRIPTION_ERROR_RESPONSES = {
    400: {"model": PrescriptionErrorResponse, "description": "Bad request."},
    401: {"model": PrescriptionErrorResponse, "description": "Authentication is required."},
    403: {"model": PrescriptionErrorResponse, "description": "The authenticated user lacks permission."},
    404: {"model": PrescriptionErrorResponse, "description": "Prescription or a related resource was not found."},
    409: {"model": PrescriptionErrorResponse, "description": "A prescription already exists for this medical record."},
    422: {"model": PrescriptionValidationErrorResponse, "description": "Request validation failed."},
}
