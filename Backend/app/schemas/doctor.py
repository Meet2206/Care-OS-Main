from __future__ import annotations
from datetime import date, datetime
from enum import Enum
from typing import Any

from pydantic import BaseModel, ConfigDict, EmailStr, Field


class DoctorGender(str, Enum):
    male = "Male"
    female = "Female"
    other = "Other"


class DoctorAvailability(str, Enum):
    available = "Available"
    busy = "Busy"
    on_leave = "On Leave"


class DoctorStatus(str, Enum):
    active = "Active"
    inactive = "Inactive"


class DoctorBase(BaseModel):
    first_name: str = Field(min_length=1, max_length=80)
    last_name: str = Field(min_length=1, max_length=80)
    gender: DoctorGender
    date_of_birth: date
    email: EmailStr
    phone: str = Field(min_length=1, max_length=20, pattern=r"^\d+$")
    address: str = Field(min_length=1, max_length=300)
    department: str = Field(min_length=1, max_length=100)
    specialization: str = Field(min_length=1, max_length=120)
    qualification: str = Field(min_length=1, max_length=150)
    experience_years: int = Field(ge=0, le=80)
    consultation_fee: float = Field(ge=0)
    license_number: str = Field(min_length=1, max_length=100)
    availability: DoctorAvailability = DoctorAvailability.available
    status: DoctorStatus = DoctorStatus.active


class DoctorCreate(DoctorBase):
    model_config = ConfigDict(
        json_schema_extra={
            "examples": [
                {
                    "first_name": "Ananya",
                    "last_name": "Rao",
                    "gender": "Female",
                    "date_of_birth": "1985-04-12",
                    "email": "ananya.rao@example.com",
                    "phone": "9876543210",
                    "address": "14 Lake View Road",
                    "department": "Cardiology",
                    "specialization": "Interventional Cardiology",
                    "qualification": "MBBS, MD, DM",
                    "experience_years": 12,
                    "consultation_fee": 800,
                    "license_number": "MED-CARD-001",
                    "availability": "Available",
                    "status": "Active",
                }
            ]
        }
    )


class DoctorUpdate(BaseModel):
    first_name: str | None = Field(default=None, min_length=1, max_length=80)
    last_name: str | None = Field(default=None, min_length=1, max_length=80)
    gender: DoctorGender | None = None
    date_of_birth: date | None = None
    email: EmailStr | None = None
    phone: str | None = Field(default=None, min_length=1, max_length=20, pattern=r"^\d+$")
    address: str | None = Field(default=None, min_length=1, max_length=300)
    department: str | None = Field(default=None, min_length=1, max_length=100)
    specialization: str | None = Field(default=None, min_length=1, max_length=120)
    qualification: str | None = Field(default=None, min_length=1, max_length=150)
    experience_years: int | None = Field(default=None, ge=0, le=80)
    consultation_fee: float | None = Field(default=None, ge=0)
    license_number: str | None = Field(default=None, min_length=1, max_length=100)
    availability: DoctorAvailability | None = None
    status: DoctorStatus | None = None


class DoctorResponse(DoctorBase):
    doctor_id: str
    created_at: datetime
    updated_at: datetime


class DoctorListResponse(BaseModel):
    total: int
    page: int
    limit: int
    total_pages: int
    has_next: bool
    has_previous: bool
    data: list[DoctorResponse]


class DoctorErrorResponse(BaseModel):
    detail: str


class DoctorValidationErrorResponse(DoctorErrorResponse):
    errors: list[dict[str, Any]] | None = None


DOCTOR_ERROR_RESPONSES = {
    400: {"model": DoctorErrorResponse, "description": "Bad request."},
    401: {"model": DoctorErrorResponse, "description": "Authentication is required."},
    403: {"model": DoctorErrorResponse, "description": "The authenticated user lacks permission."},
    404: {"model": DoctorErrorResponse, "description": "Doctor not found."},
    409: {"model": DoctorErrorResponse, "description": "Email or license number already exists."},
    422: {"model": DoctorValidationErrorResponse, "description": "Request validation failed."},
}
