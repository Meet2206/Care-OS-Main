from __future__ import annotations
from datetime import datetime
from enum import Enum
from typing import Any

from pydantic import BaseModel, ConfigDict, EmailStr, Field, model_validator


class UserRole(str, Enum):
    doctor = "doctor"
    pharmacy = "pharmacy"
    patient = "patient"
    receptionist = "receptionist"
    admin = "admin"

    @classmethod
    def _missing_(cls, value):
        if isinstance(value, str):
            return cls._value2member_map_.get(value.strip().lower())


class UserStatus(str, Enum):
    active = "Active"
    inactive = "Inactive"


class RegisterRequest(BaseModel):
    full_name: str = Field(min_length=2, max_length=100)
    login_id: str | None = Field(default=None, min_length=3, max_length=120)
    email: EmailStr | None = None
    password: str = Field(min_length=8, max_length=72)
    role: UserRole = UserRole.receptionist

    @model_validator(mode="after")
    def set_login_id(self):
        if not self.login_id and self.email:
            self.login_id = str(self.email)
        if not self.login_id:
            raise ValueError("login_id is required")
        return self


class LoginRequest(BaseModel):
    login_id: str | None = Field(default=None, min_length=3, max_length=120)
    email: EmailStr | None = None
    password: str = Field(min_length=1, max_length=72)

    @model_validator(mode="after")
    def set_login_id(self):
        if not self.login_id and self.email:
            self.login_id = str(self.email)
        if not self.login_id:
            raise ValueError("login_id is required")
        return self


class UserResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    full_name: str
    login_id: str
    email: EmailStr | None = None
    role: UserRole
    created_at: datetime
    user_id: str | None = None
    first_name: str | None = None
    last_name: str | None = None
    patient_id: str | None = None
    doctor_id: str | None = None
    status: UserStatus = UserStatus.active


class RegisterResponse(BaseModel):
    message: str
    user: UserResponse


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse


class ErrorResponse(BaseModel):
    detail: str


class ValidationErrorResponse(ErrorResponse):
    errors: list[dict[str, Any]] | None = None


AUTH_ERROR_RESPONSES = {
    400: {"model": ErrorResponse, "description": "Bad request."},
    401: {"model": ErrorResponse, "description": "Authentication failed or token is invalid."},
    403: {"model": ErrorResponse, "description": "The authenticated user lacks the required role."},
    404: {"model": ErrorResponse, "description": "The requested resource was not found."},
    409: {"model": ErrorResponse, "description": "A user with this email already exists."},
    422: {"model": ValidationErrorResponse, "description": "Request validation failed."},
}
