from __future__ import annotations
from datetime import datetime, timezone
import math
import secrets

from fastapi import HTTPException, status
from pymongo import ReturnDocument

from app.database.mongodb import db
from app.models.pharmacy_order import PHARMACY_ORDERS_COLLECTION
from app.schemas.pharmacy_order import (
    FulfillmentChoice,
    PharmacyFulfillmentRequest,
    PharmacyOrderListResponse,
    PharmacyOrderResponse,
    PharmacyOrderStatus,
    PharmacyPaymentMethod,
    PharmacyPaymentRequest,
)

_TRANSITIONS = {
    PharmacyOrderStatus.PENDING: {PharmacyOrderStatus.PENDING_PAYMENT, PharmacyOrderStatus.ACCEPTED, PharmacyOrderStatus.CANCELLED},
    PharmacyOrderStatus.PENDING_PAYMENT: {PharmacyOrderStatus.PAID, PharmacyOrderStatus.CANCELLED},
    PharmacyOrderStatus.PAID: {PharmacyOrderStatus.READY_FOR_PICKUP},
    PharmacyOrderStatus.READY_FOR_PICKUP: {PharmacyOrderStatus.COLLECTED},
    PharmacyOrderStatus.COLLECTED: set(),
    PharmacyOrderStatus.ACCEPTED: {PharmacyOrderStatus.PACKED, PharmacyOrderStatus.CANCELLED},
    PharmacyOrderStatus.PACKED: {PharmacyOrderStatus.DISPENSED},
    PharmacyOrderStatus.DISPENSED: set(),
    PharmacyOrderStatus.CANCELLED: set(),
}


def ensure_pharmacy_order_indexes() -> None:
    collection = db[PHARMACY_ORDERS_COLLECTION]
    collection.create_index("order_id", unique=True, name="unique_pharmacy_order_id")
    collection.create_index("prescription_id", unique=True, name="unique_pharmacy_order_prescription")
    collection.create_index("patient_id", name="pharmacy_order_patient_id")
    collection.create_index("doctor_id", name="pharmacy_order_doctor_id")
    collection.create_index("status", name="pharmacy_order_status")
    collection.create_index("is_deleted", name="pharmacy_order_is_deleted")
    collection.create_index("created_at", name="pharmacy_order_created_at")
    collection.create_index("pickup_token", unique=True, sparse=True, name="unique_pharmacy_pickup_token")


def create_for_prescription(prescription: dict) -> PharmacyOrderResponse:
    ensure_pharmacy_order_indexes()
    existing = db[PHARMACY_ORDERS_COLLECTION].find_one({"prescription_id": prescription["prescription_id"]})
    if existing:
        return PharmacyOrderResponse.model_validate(existing)
    now = datetime.now(timezone.utc)
    sequence = db.counters.find_one_and_update(
        {"_id": "pharmacy_order"}, {"$inc": {"sequence_value": 1}}, upsert=True, return_document=ReturnDocument.AFTER
    )
    document = {
        "order_id": f"PO{sequence['sequence_value']:06d}",
        "prescription_id": prescription["prescription_id"],
        "patient_id": prescription["patient_id"],
        "doctor_id": prescription["doctor_id"],
        "pharmacy_id": None,
        "medicines": [item.model_dump() if hasattr(item, "model_dump") else item for item in prescription["medicines"]],
        "status": PharmacyOrderStatus.PENDING.value,
        "fulfillment_choice": None,
        "payment_status": "Pending",
        "payment_method": None,
        "total_amount": 0,
        "paid_at": None,
        "pickup_status": "NOT_READY",
        "pickup_token": None,
        "pickup_qr_payload": None,
        "created_at": now, "updated_at": now,
        "accepted_at": None, "packed_at": None, "dispensed_at": None,
        "is_deleted": False, "deleted_at": None,
    }
    db[PHARMACY_ORDERS_COLLECTION].insert_one(document)
    return PharmacyOrderResponse.model_validate(document)


def select_fulfillment(order_id: str, request: PharmacyFulfillmentRequest) -> PharmacyOrderResponse:
    """Snapshot the patient's full/half choice without mutating the prescription."""
    order = get_order(order_id)
    if order.status not in {PharmacyOrderStatus.PENDING, PharmacyOrderStatus.PENDING_PAYMENT}:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Fulfillment can no longer be changed for this order.")
    choice = request.fulfillment_choice
    update_items = []
    for item in order.medicines:
        quantity = item.prescribed_quantity if choice is FulfillmentChoice.FULL else math.ceil(item.prescribed_quantity / 2)
        update_items.append({**item.model_dump(), "fulfillment_quantity": quantity})
    now = datetime.now(timezone.utc)
    row = db[PHARMACY_ORDERS_COLLECTION].find_one_and_update(
        {"order_id": order_id, "status": {"$in": [PharmacyOrderStatus.PENDING.value, PharmacyOrderStatus.PENDING_PAYMENT.value]}, "is_deleted": {"$ne": True}},
        {"$set": {"medicines": update_items, "fulfillment_choice": choice.value, "status": PharmacyOrderStatus.PENDING_PAYMENT.value, "updated_at": now}},
        return_document=ReturnDocument.AFTER,
    )
    if row is None:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Fulfillment can no longer be changed for this order.")
    return PharmacyOrderResponse.model_validate(row)


def _paid_update(order: PharmacyOrderResponse, method: PharmacyPaymentMethod, card_last4: str | None = None) -> PharmacyOrderResponse:
    if not order.fulfillment_choice:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Choose FULL or HALF fulfillment before payment.")
    if order.payment_status == "Paid":
        return order
    now = datetime.now(timezone.utc)
    token = secrets.token_urlsafe(32)
    payload = f"CAREOS-PICKUP:{order.order_id}:{token}"
    row = db[PHARMACY_ORDERS_COLLECTION].find_one_and_update(
        {"order_id": order.order_id, "status": PharmacyOrderStatus.PENDING_PAYMENT.value, "payment_status": {"$ne": "Paid"}, "is_deleted": {"$ne": True}},
        {"$set": {
            "status": PharmacyOrderStatus.READY_FOR_PICKUP.value,
            "payment_status": "Paid",
            "payment_method": method.value,
            "card_last4": card_last4,
            "paid_at": now,
            "pickup_status": "READY",
            "pickup_token": token,
            "pickup_qr_payload": payload,
            "updated_at": now,
        }},
        return_document=ReturnDocument.AFTER,
    )
    if row is None:
        latest = get_order(order.order_id)
        if latest.payment_status == "Paid":
            return latest
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Payment could not be recorded for this order.")
    return PharmacyOrderResponse.model_validate(row)


def pay_order(order_id: str, request: PharmacyPaymentRequest) -> PharmacyOrderResponse:
    order = get_order(order_id)
    if request.payment_method in {PharmacyPaymentMethod.CREDIT_CARD, PharmacyPaymentMethod.DEBIT_CARD} and not request.card_last4:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Only the last four card digits may be provided.")
    # Cash and on-counter remain pending until pharmacy confirms receipt.
    if request.payment_method in {PharmacyPaymentMethod.CASH, PharmacyPaymentMethod.ON_COUNTER}:
        if not order.fulfillment_choice:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Choose FULL or HALF fulfillment before payment.")
        db[PHARMACY_ORDERS_COLLECTION].update_one(
            {"order_id": order_id, "status": PharmacyOrderStatus.PENDING_PAYMENT.value, "is_deleted": {"$ne": True}},
            {"$set": {"payment_method": request.payment_method.value, "updated_at": datetime.now(timezone.utc)}},
        )
        return get_order(order_id)
    return _paid_update(order, request.payment_method, request.card_last4)


def confirm_cash_payment(order_id: str, pharmacy_id: str) -> PharmacyOrderResponse:
    order = get_order(order_id)
    if order.payment_method not in {PharmacyPaymentMethod.CASH, PharmacyPaymentMethod.ON_COUNTER}:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="This order is not awaiting cash confirmation.")
    return _paid_update(order, order.payment_method)


def collect_order(order_id: str, pickup_token: str, pharmacy_id: str) -> PharmacyOrderResponse:
    now = datetime.now(timezone.utc)
    row = db[PHARMACY_ORDERS_COLLECTION].find_one_and_update(
        {"order_id": order_id, "pickup_token": pickup_token, "payment_status": "Paid", "status": PharmacyOrderStatus.READY_FOR_PICKUP.value, "is_deleted": {"$ne": True}},
        {"$set": {"status": PharmacyOrderStatus.COLLECTED.value, "pickup_status": "COLLECTED", "pharmacy_id": pharmacy_id, "dispensed_at": now, "updated_at": now}},
        return_document=ReturnDocument.AFTER,
    )
    if row is not None:
        return PharmacyOrderResponse.model_validate(row)
    existing = get_order(order_id)
    if existing.status is PharmacyOrderStatus.COLLECTED:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Order already collected.")
    raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Pickup token is invalid or the order is not ready.")


def list_orders(
    patient_id: str | None = None,
    doctor_id: str | None = None,
    order_status: PharmacyOrderStatus | None = None,
    page: int = 1,
    limit: int = 20,
) -> PharmacyOrderListResponse:
    query: dict = {"is_deleted": {"$ne": True}}
    if patient_id is not None:
        query["patient_id"] = patient_id
    if doctor_id is not None:
        query["doctor_id"] = doctor_id
    if order_status is not None:
        query["status"] = order_status.value

    collection = db[PHARMACY_ORDERS_COLLECTION]
    total = collection.count_documents(query)
    rows = list(
        collection.find(query)
        .sort("created_at", -1)
        .skip((page - 1) * limit)
        .limit(limit)
    )
    total_pages = (total + limit - 1) // limit
    return PharmacyOrderListResponse(
        total=total,
        page=page,
        limit=limit,
        total_pages=total_pages,
        has_next=page < total_pages,
        has_previous=page > 1,
        data=[PharmacyOrderResponse.model_validate(row) for row in rows],
    )


def get_order(order_id: str) -> PharmacyOrderResponse:
    row = db[PHARMACY_ORDERS_COLLECTION].find_one(
        {"order_id": order_id, "is_deleted": {"$ne": True}}
    )
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Pharmacy order not found.")
    return PharmacyOrderResponse.model_validate(row)


def _invalid_transition(current: PharmacyOrderStatus, requested: PharmacyOrderStatus) -> HTTPException:
    # Report the wire values, not the Python enum repr.
    return HTTPException(
        status_code=status.HTTP_409_CONFLICT,
        detail=(
            f"Cannot move a pharmacy order from {current.value} to {requested.value}."
        ),
    )


def update_status(
    order_id: str, next_status: PharmacyOrderStatus, pharmacy_id: str | None = None
) -> PharmacyOrderResponse:
    current = get_order(order_id)
    if next_status not in _TRANSITIONS[current.status]:
        raise _invalid_transition(current.status, next_status)
    now = datetime.now(timezone.utc)
    timestamp_field = {
        PharmacyOrderStatus.ACCEPTED: "accepted_at",
        PharmacyOrderStatus.PACKED: "packed_at",
        PharmacyOrderStatus.DISPENSED: "dispensed_at",
    }.get(next_status)
    changes: dict = {"status": next_status.value, "updated_at": now}
    if timestamp_field:
        changes[timestamp_field] = now
    if next_status is PharmacyOrderStatus.ACCEPTED and pharmacy_id:
        # Record which pharmacy user took ownership of the order.
        changes["pharmacy_id"] = pharmacy_id
    row = db[PHARMACY_ORDERS_COLLECTION].find_one_and_update(
        {"order_id": order_id, "status": current.status.value, "is_deleted": {"$ne": True}},
        {"$set": changes},
        return_document=ReturnDocument.AFTER,
    )
    if row is None:
        # Another request changed the status between the read and the write.
        # Re-read and report the conflict rather than raising on a None document.
        latest = get_order(order_id)
        raise _invalid_transition(latest.status, next_status)
    return PharmacyOrderResponse.model_validate(row)
