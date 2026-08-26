from __future__ import annotations
from datetime import datetime
from enum import Enum

from pydantic import BaseModel, ConfigDict, Field, IPvAnyAddress


class AuditAction(str, Enum):
    create = "CREATE"
    update = "UPDATE"
    delete = "DELETE"
    login = "LOGIN"
    logout = "LOGOUT"


class AuditModule(str, Enum):
    users = "Users"
    patients = "Patients"
    doctors = "Doctors"
    appointments = "Appointments"
    medical_records = "Medical Records"
    prescriptions = "Prescriptions"
    billing = "Billing"
    notifications = "Notifications"


class AuditLogCreate(BaseModel):
    user_id: str = Field(min_length=1, max_length=30)
    user_name: str = Field(min_length=1, max_length=150)
    role: str = Field(min_length=1, max_length=30)
    action: AuditAction
    module: AuditModule
    entity_id: str | None = Field(default=None, max_length=50)
    description: str = Field(min_length=1, max_length=2000)
    ip_address: IPvAnyAddress | None = None

    model_config = ConfigDict(
        json_schema_extra={
            "examples": [
                {
                    "user_id": "USR000001",
                    "user_name": "Ananya Rao",
                    "role": "Admin",
                    "action": "CREATE",
                    "module": "Patients",
                    "entity_id": "PAT000001",
                    "description": "Created a patient record.",
                    "ip_address": "127.0.0.1",
                }
            ]
        }
    )


class AuditLogResponse(AuditLogCreate):
    audit_id: str
    created_at: datetime


class AuditLogListResponse(BaseModel):
    """Paginated audit log records using the shared list response shape."""

    total: int
    page: int
    limit: int
    total_pages: int
    has_next: bool
    has_previous: bool
    data: list[AuditLogResponse]
