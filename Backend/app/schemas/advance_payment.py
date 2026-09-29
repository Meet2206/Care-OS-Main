from datetime import datetime
from enum import Enum

from pydantic import BaseModel, Field, model_validator


class AdvancePaymentMethod(str, Enum):
    upi = "UPI"
    upi_id = "UPI ID"
    credit_card = "Credit Card"
    debit_card = "Debit Card"


class AdvancePaymentCreate(BaseModel):
    payment_method: AdvancePaymentMethod
    upi_id: str | None = Field(default=None, max_length=120)
    card_last4: str | None = Field(default=None, min_length=4, max_length=4, pattern=r"^\d{4}$")

    @model_validator(mode="after")
    def validate_method_details(self):
        if self.payment_method == AdvancePaymentMethod.upi_id and not self.upi_id:
            raise ValueError("UPI ID is required for this payment method.")
        if self.payment_method in {AdvancePaymentMethod.credit_card, AdvancePaymentMethod.debit_card} and not self.card_last4:
            raise ValueError("Card details are required for this payment method.")
        return self


class AdvancePaymentResponse(BaseModel):
    payment_id: str
    appointment_id: str
    patient_id: str
    doctor_id: str
    total_amount: float
    advance_amount: float
    remaining_amount: float
    advance_percentage: int
    payment_method: AdvancePaymentMethod
    payment_status: str
    transaction_reference: str
    simulated: bool
    created_at: datetime
    updated_at: datetime
