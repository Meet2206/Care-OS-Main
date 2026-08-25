from datetime import datetime
from enum import Enum

from pydantic import BaseModel, Field


class PharmacyOrderStatus(str, Enum):
    PENDING = "PENDING"
    ACCEPTED = "ACCEPTED"
    PACKED = "PACKED"
    DISPENSED = "DISPENSED"
    CANCELLED = "CANCELLED"


class PharmacyOrderMedicine(BaseModel):
    medicine_id: str
    medicine_name: str
    composition_snapshot: str | None = None
    dosage: str
    frequency: str
    duration: str
    instructions: str | None = None


class PharmacyOrderResponse(BaseModel):
    order_id: str
    prescription_id: str
    patient_id: str
    doctor_id: str
    pharmacy_id: str | None = None
    medicines: list[PharmacyOrderMedicine]
    status: PharmacyOrderStatus
    created_at: datetime
    updated_at: datetime
    accepted_at: datetime | None = None
    packed_at: datetime | None = None
    dispensed_at: datetime | None = None


class PharmacyOrderListResponse(BaseModel):
    total: int
    data: list[PharmacyOrderResponse]


class PharmacyOrderStatusUpdate(BaseModel):
    status: PharmacyOrderStatus
