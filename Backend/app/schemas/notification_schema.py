from __future__ import annotations
from datetime import datetime
from enum import Enum

from pydantic import BaseModel, ConfigDict, Field


class NotificationType(str, Enum):
    appointment_reminder = "Appointment Reminder"
    follow_up_reminder = "Follow-up Reminder"
    payment_reminder = "Payment Reminder"
    general = "General"


class NotificationStatus(str, Enum):
    pending = "Pending"
    sent = "Sent"
    failed = "Failed"


class NotificationBase(BaseModel):
    user_id: str = Field(min_length=1, max_length=30)
    patient_id: str | None = Field(default=None, min_length=1, max_length=30)
    appointment_id: str | None = Field(default=None, min_length=1, max_length=30)
    title: str = Field(min_length=1, max_length=200)
    message: str = Field(min_length=1, max_length=2000)
    type: NotificationType
    status: NotificationStatus = NotificationStatus.pending
    scheduled_at: datetime | None = None
    sent_at: datetime | None = None


class NotificationCreate(NotificationBase):
    model_config = ConfigDict(json_schema_extra={"examples": [{"user_id": "USR000001", "patient_id": "PAT000001", "appointment_id": "APT000001", "title": "Appointment Reminder", "message": "Your appointment is scheduled tomorrow.", "type": "Appointment Reminder", "scheduled_at": "2026-08-01T09:00:00Z"}]})


class NotificationUpdate(BaseModel):
    user_id: str | None = Field(default=None, min_length=1, max_length=30)
    patient_id: str | None = Field(default=None, min_length=1, max_length=30)
    appointment_id: str | None = Field(default=None, min_length=1, max_length=30)
    title: str | None = Field(default=None, min_length=1, max_length=200)
    message: str | None = Field(default=None, min_length=1, max_length=2000)
    type: NotificationType | None = None
    status: NotificationStatus | None = None
    scheduled_at: datetime | None = None
    sent_at: datetime | None = None


class NotificationResponse(NotificationBase):
    notification_id: str
    created_at: datetime
    updated_at: datetime


class NotificationListResponse(BaseModel):
    total: int
    page: int
    limit: int
    total_pages: int
    has_next: bool
    has_previous: bool
    data: list[NotificationResponse]
