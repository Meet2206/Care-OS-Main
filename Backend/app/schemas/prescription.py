from __future__ import annotations
from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

PRESCRIPTION_FREQUENCIES = {"Morning", "Afternoon", "Evening", "Night"}
PRESCRIPTION_DURATIONS = {"5 Days": 5, "10 Days": 10, "15 Days": 15, "20 Days": 20}


def validate_new_medicine_items(medicines: list["Medicine"] | None) -> None:
    for medicine in medicines or []:
        if not isinstance(medicine.frequency, list):
            continue
        if medicine.duration not in PRESCRIPTION_DURATIONS:
            raise ValueError("Please select a treatment duration.")
        doses_per_day = len(medicine.frequency)
        expected_quantity = PRESCRIPTION_DURATIONS[medicine.duration] * doses_per_day
        if medicine.number_of_doses != doses_per_day:
            raise ValueError("Number of doses must match the selected dosing times.")
        if medicine.prescribed_quantity != expected_quantity:
            raise ValueError("Quantity must equal treatment duration multiplied by doses per day.")


class Medicine(BaseModel):
    medicine_id: str = Field(min_length=1, max_length=40)
    medicine_name: str = Field(min_length=1, max_length=150)
    frequency: str | list[str] = Field(min_length=1)
    # Optional for new prescriptions; retained for reading historical records.
    dosage: str | None = Field(default=None, max_length=100)
    duration: str | None = Field(default=None, max_length=20)
    instructions: str | None = Field(default=None, max_length=500)
    number_of_doses: int | None = Field(default=None, ge=1, le=100)
    prescribed_quantity: int = Field(default=1, ge=1, le=10000)

    @field_validator("frequency")
    @classmethod
    def validate_frequency(cls, value):
        if isinstance(value, list):
            if not value or len(value) != len(set(value)) or any(item not in PRESCRIPTION_FREQUENCIES for item in value):
                raise ValueError("Frequency must contain unique Morning, Afternoon, Evening, or Night values.")
        elif not value.strip():
            raise ValueError("Frequency is required.")
        return value


class PrescriptionBase(BaseModel):
    medical_record_id: str = Field(min_length=1, max_length=30)
    appointment_id: str = Field(min_length=1, max_length=30)
    patient_id: str = Field(min_length=1, max_length=30)
    doctor_id: str = Field(min_length=1, max_length=30)
    medicines: list[Medicine] = Field(min_length=1, max_length=25)


class PrescriptionCreate(PrescriptionBase):
    @model_validator(mode="after")
    def validate_new_prescription_values(self):
        validate_new_medicine_items(self.medicines)
        return self

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
                            "medicine_id": "MED000001",
                            "medicine_name": "Paracetamol",
                            "frequency": ["Morning", "Evening"],
                            "duration": "5 Days",
                            "number_of_doses": 2,
                            "prescribed_quantity": 10,
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

    @model_validator(mode="after")
    def validate_new_prescription_values(self):
        validate_new_medicine_items(self.medicines)
        return self


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
                            "medicine_id": "MED000001",
                            "medicine_name": "Paracetamol",
                            "frequency": ["Morning", "Evening"],
                            "duration": "5 Days",
                            "number_of_doses": 2,
                            "prescribed_quantity": 10,
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
