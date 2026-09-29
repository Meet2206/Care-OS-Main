from __future__ import annotations

import secrets
from datetime import datetime, timezone

from pymongo import ReturnDocument
from pymongo.errors import DuplicateKeyError

from app.database.mongodb import db
from app.models.advance_payment import (
    ADVANCE_PAYMENT_COUNTER_KEY,
    ADVANCE_PAYMENTS_COLLECTION,
    COUNTERS_COLLECTION,
    advance_payment_document_to_response,
)
from app.models.appointment import APPOINTMENTS_COLLECTION
from app.models.doctor import DOCTORS_COLLECTION
from app.schemas.advance_payment import AdvancePaymentCreate, AdvancePaymentResponse


class AdvancePaymentNotFoundError(Exception):
    pass


class AdvancePaymentConflictError(Exception):
    pass


class AdvancePaymentInvalidError(Exception):
    pass


def _payments():
    return db[ADVANCE_PAYMENTS_COLLECTION]


def ensure_advance_payment_indexes() -> None:
    collection = _payments()
    collection.create_index("payment_id", unique=True, name="unique_advance_payment_id")
    collection.create_index("appointment_id", unique=True, name="unique_advance_payment_appointment")
    collection.create_index("patient_id", name="advance_payment_patient_id")
    collection.create_index("payment_status", name="advance_payment_status")


def _next_payment_id() -> str:
    counter = db[COUNTERS_COLLECTION].find_one_and_update(
        {"_id": ADVANCE_PAYMENT_COUNTER_KEY},
        {"$inc": {"sequence_value": 1}},
        upsert=True,
        return_document=ReturnDocument.AFTER,
    )
    return f"PAY{counter['sequence_value']:06d}"


def pay_advance(appointment_id: str, request: AdvancePaymentCreate) -> AdvancePaymentResponse:
    ensure_advance_payment_indexes()
    appointment = db[APPOINTMENTS_COLLECTION].find_one({
        "appointment_id": appointment_id,
        "is_deleted": {"$ne": True},
    })
    if appointment is None:
        raise AdvancePaymentNotFoundError
    if appointment.get("status") == "Cancelled":
        raise AdvancePaymentInvalidError("Cancelled appointments cannot be paid.")

    existing = _payments().find_one({"appointment_id": appointment_id, "payment_status": "Paid"})
    if existing:
        return advance_payment_document_to_response(existing)

    doctor = db[DOCTORS_COLLECTION].find_one({
        "doctor_id": appointment["doctor_id"],
        "is_deleted": {"$ne": True},
    })
    if doctor is None:
        raise AdvancePaymentNotFoundError
    total_amount = round(float(doctor.get("consultation_fee") or 0), 2)
    if total_amount <= 0:
        raise AdvancePaymentInvalidError("This doctor does not have a valid consultation fee.")

    advance_amount = round(total_amount * 25 / 100, 2)
    remaining_amount = round(total_amount - advance_amount, 2)
    now = datetime.now(timezone.utc)
    payment = {
        "payment_id": _next_payment_id(),
        "appointment_id": appointment_id,
        "patient_id": appointment["patient_id"],
        "doctor_id": appointment["doctor_id"],
        "total_amount": total_amount,
        "advance_amount": advance_amount,
        "remaining_amount": remaining_amount,
        "advance_percentage": 25,
        "payment_method": request.payment_method.value,
        "payment_status": "Paid",
        "transaction_reference": f"SIM-{secrets.token_hex(6).upper()}",
        "simulated": True,
        "created_at": now,
        "updated_at": now,
    }
    if request.upi_id:
        payment["upi_id_provided"] = True
    if request.card_last4:
        payment["card_last4"] = request.card_last4

    try:
        _payments().insert_one(payment)
        db[APPOINTMENTS_COLLECTION].update_one(
            {"appointment_id": appointment_id, "is_deleted": {"$ne": True}},
            {"$set": {
                "status": "Scheduled",
                "payment_status": "Paid",
                "payment_id": payment["payment_id"],
                "total_amount": total_amount,
                "advance_amount": advance_amount,
                "remaining_amount": remaining_amount,
                "payment_method": payment["payment_method"],
                "transaction_reference": payment["transaction_reference"],
                "updated_at": now,
            }},
        )
    except DuplicateKeyError as exc:
        raise AdvancePaymentConflictError from exc
    return advance_payment_document_to_response(payment)
