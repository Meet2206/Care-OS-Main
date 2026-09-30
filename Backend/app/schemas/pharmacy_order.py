from __future__ import annotations
from datetime import datetime
from enum import Enum

from pydantic import BaseModel, Field


class PharmacyOrderStatus(str, Enum):
    PENDING = "PENDING"
    PENDING_PAYMENT = "PENDING_PAYMENT"
    PAID = "PAID"
    READY_FOR_PICKUP = "READY_FOR_PICKUP"
    COLLECTED = "COLLECTED"
    ACCEPTED = "ACCEPTED"
    PACKED = "PACKED"
    DISPENSED = "DISPENSED"
    CANCELLED = "CANCELLED"


class PharmacyOrderMedicine(BaseModel):
    medicine_id: str
    medicine_name: str
    frequency: str | list[str]
    composition_snapshot: str | None = None
    dosage: str | None = None
    duration: str | None = None
    instructions: str | None = None
    number_of_doses: int | None = Field(default=None, ge=1, le=100)
    prescribed_quantity: int = Field(default=1, ge=1)
    fulfillment_quantity: int | None = Field(default=None, ge=1)


class FulfillmentChoice(str, Enum):
    FULL = "FULL"
    HALF = "HALF"


class PharmacyPaymentMethod(str, Enum):
    UPI = "UPI"
    UPI_ID = "UPI ID"
    CREDIT_CARD = "Credit Card"
    DEBIT_CARD = "Debit Card"
    CASH = "Cash"
    ON_COUNTER = "On-Counter"


class PharmacyPaymentRequest(BaseModel):
    payment_method: PharmacyPaymentMethod
    upi_id: str | None = Field(default=None, max_length=120)
    card_last4: str | None = Field(default=None, min_length=4, max_length=4, pattern=r"^\d{4}$")


class PharmacyFulfillmentRequest(BaseModel):
    fulfillment_choice: FulfillmentChoice


class PharmacyCollectRequest(BaseModel):
    pickup_token: str = Field(min_length=20, max_length=200)


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
    fulfillment_choice: FulfillmentChoice | None = None
    payment_status: str = "Pending"
    payment_method: PharmacyPaymentMethod | None = None
    total_amount: float = Field(default=0, ge=0)
    paid_at: datetime | None = None
    pickup_status: str = "NOT_READY"
    pickup_token: str | None = None
    pickup_qr_payload: str | None = None


class PharmacyOrderListResponse(BaseModel):
    total: int
    page: int = 1
    limit: int = 20
    total_pages: int = 0
    has_next: bool = False
    has_previous: bool = False
    data: list[PharmacyOrderResponse]


class PharmacyOrderStatusUpdate(BaseModel):
    status: PharmacyOrderStatus
