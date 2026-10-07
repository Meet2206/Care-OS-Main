from __future__ import annotations
from datetime import date, datetime
from typing import Any

import re

from pydantic import BaseModel, ConfigDict, Field, StrictInt, field_validator


class VitalSigns(BaseModel):
    blood_pressure: str | None = Field(default=None, max_length=20)
    heart_rate: int | None = Field(default=None, ge=20, le=250)
    pulse: StrictInt | None = Field(default=None, ge=20, le=250)
    temperature: float | None = Field(default=None, ge=25, le=45)
    respiratory_rate: int | None = Field(default=None, ge=0)
    oxygen_saturation: float | None = Field(default=None, ge=0, le=100)
    weight: float | None = Field(default=None, ge=0)
    height: float | None = Field(default=None, ge=0)

    @field_validator("blood_pressure")
    @classmethod
    def validate_blood_pressure(cls, value: str | None) -> str | None:
        if value is None:
            return None
        if not re.fullmatch(r"\d+/\d+", value):
            raise ValueError("Please enter blood pressure in the format 120/80.")
        systolic, diastolic = (int(part) for part in value.split("/"))
        if not (50 <= systolic <= 300 and 30 <= diastolic <= 200 and systolic > diastolic):
            raise ValueError("Please enter a valid blood pressure in the format 120/80.")
        return value


class MedicalRecordBase(BaseModel):
    appointment_id: str = Field(min_length=1, max_length=30)
    patient_id: str = Field(min_length=1, max_length=30)
    doctor_id: str = Field(min_length=1, max_length=30)
    diagnosis: str = Field(min_length=1, max_length=500)
    symptoms: str | None = Field(default=None, max_length=2000)
    vital_signs: VitalSigns = Field(default_factory=VitalSigns)
    treatment: str | None = Field(default=None, max_length=3000)
    notes: str | None = Field(default=None, max_length=5000)
    follow_up_date: date | None = None


class MedicalRecordCreate(MedicalRecordBase):
    model_config = ConfigDict(
        json_schema_extra={
            "examples": [
                {
                    "appointment_id": "APT000001",
                    "patient_id": "PAT000001",
                    "doctor_id": "DOC000001",
                    "diagnosis": "Mild hypertension",
                    "symptoms": "Occasional headaches and dizziness",
                    "vital_signs": {
                        "blood_pressure": "140/90",
                        "pulse": 78,
                        "temperature": 37.0,
                        "respiratory_rate": 18,
                        "oxygen_saturation": 99,
                        "weight": 70,
                        "height": 175,
                    },
                    "treatment": "Lifestyle changes and antihypertensive medication",
                    "notes": "Review blood pressure log at next visit.",
                    "follow_up_date": "2026-08-19",
                }
            ]
        }
    )


class MedicalRecordUpdate(BaseModel):
    appointment_id: str | None = Field(default=None, min_length=1, max_length=30)
    patient_id: str | None = Field(default=None, min_length=1, max_length=30)
    doctor_id: str | None = Field(default=None, min_length=1, max_length=30)
    diagnosis: str | None = Field(default=None, min_length=1, max_length=500)
    symptoms: str | None = Field(default=None, max_length=2000)
    vital_signs: VitalSigns | None = None
    treatment: str | None = Field(default=None, max_length=3000)
    notes: str | None = Field(default=None, max_length=5000)
    follow_up_date: date | None = None


class MedicalRecordResponse(MedicalRecordBase):
    model_config = ConfigDict(
        json_schema_extra={
            "examples": [
                {
                    "record_id": "MR000001",
                    "appointment_id": "APT000001",
                    "patient_id": "PAT000001",
                    "doctor_id": "DOC000001",
                    "diagnosis": "Mild hypertension",
                    "symptoms": "Occasional headaches and dizziness",
                    "vital_signs": {"blood_pressure": "140/90", "pulse": 78, "temperature": 37.0},
                    "treatment": "Lifestyle changes and medication",
                    "notes": "Review blood pressure log at next visit.",
                    "follow_up_date": "2026-08-19",
                    "created_at": "2026-08-05T10:30:00Z",
                    "updated_at": "2026-08-05T10:30:00Z",
                }
            ]
        }
    )

    record_id: str
    created_at: datetime
    updated_at: datetime


class MedicalRecordListResponse(BaseModel):
    total: int
    page: int
    limit: int
    total_pages: int
    has_next: bool
    has_previous: bool
    data: list[MedicalRecordResponse]


class MedicalRecordErrorResponse(BaseModel):
    detail: str


class MedicalRecordValidationErrorResponse(MedicalRecordErrorResponse):
    errors: list[dict[str, Any]] | None = None


MEDICAL_RECORD_ERROR_RESPONSES = {
    400: {"model": MedicalRecordErrorResponse, "description": "Bad request."},
    401: {"model": MedicalRecordErrorResponse, "description": "Authentication is required."},
    403: {"model": MedicalRecordErrorResponse, "description": "The authenticated user lacks permission."},
    404: {"model": MedicalRecordErrorResponse, "description": "Medical record, appointment, patient, or doctor not found."},
    409: {"model": MedicalRecordErrorResponse, "description": "A medical record already exists for this appointment."},
    422: {"model": MedicalRecordValidationErrorResponse, "description": "Request validation failed."},
}
