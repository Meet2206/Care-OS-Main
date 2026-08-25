from datetime import date, datetime
from enum import Enum
from typing import Any

from pydantic import BaseModel, ConfigDict, EmailStr, Field


class Gender(str, Enum):
    male = "Male"
    female = "Female"
    other = "Other"


class BloodGroup(str, Enum):
    a_positive = "A+"
    a_negative = "A-"
    b_positive = "B+"
    b_negative = "B-"
    ab_positive = "AB+"
    ab_negative = "AB-"
    o_positive = "O+"
    o_negative = "O-"


class PatientBase(BaseModel):
    full_name: str = Field(min_length=1, max_length=120)
    gender: Gender
    date_of_birth: date
    phone: str = Field(min_length=1, max_length=20, pattern=r"^\d+$")
    email: EmailStr
    address: str = Field(min_length=1, max_length=300)
    blood_group: BloodGroup
    emergency_contact_name: str = Field(min_length=1, max_length=120)
    emergency_contact_phone: str = Field(min_length=1, max_length=20, pattern=r"^\d+$")
    allergies: list[str] = Field(default_factory=list)
    medical_history: list[str] = Field(default_factory=list)
    status: str = Field(default="Active", min_length=1, max_length=30)


class PatientCreate(PatientBase):
    pass


class PatientUpdate(BaseModel):
    full_name: str | None = Field(default=None, min_length=1, max_length=120)
    gender: Gender | None = None
    date_of_birth: date | None = None
    phone: str | None = Field(default=None, min_length=1, max_length=20, pattern=r"^\d+$")
    email: EmailStr | None = None
    address: str | None = Field(default=None, min_length=1, max_length=300)
    blood_group: BloodGroup | None = None
    emergency_contact_name: str | None = Field(default=None, min_length=1, max_length=120)
    emergency_contact_phone: str | None = Field(
        default=None, min_length=1, max_length=20, pattern=r"^\d+$"
    )
    allergies: list[str] | None = None
    medical_history: list[str] | None = None
    status: str | None = Field(default=None, min_length=1, max_length=30)


class PatientResponse(PatientBase):
    model_config = ConfigDict(from_attributes=True)

    patient_id: str
    created_at: datetime
    updated_at: datetime


class PatientListResponse(BaseModel):
    total: int
    page: int
    limit: int
    total_pages: int
    has_next: bool
    has_previous: bool
    data: list[PatientResponse]


class PatientErrorResponse(BaseModel):
    detail: str


class PatientValidationErrorResponse(PatientErrorResponse):
    errors: list[dict[str, Any]] | None = None


PATIENT_ERROR_RESPONSES = {
    400: {"model": PatientErrorResponse, "description": "Bad request."},
    401: {"model": PatientErrorResponse, "description": "Authentication is required."},
    403: {"model": PatientErrorResponse, "description": "The authenticated user lacks permission."},
    404: {"model": PatientErrorResponse, "description": "Patient not found."},
    409: {"model": PatientErrorResponse, "description": "A duplicate patient identifier exists."},
    422: {"model": PatientValidationErrorResponse, "description": "Request validation failed."},
}
