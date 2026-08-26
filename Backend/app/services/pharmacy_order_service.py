from __future__ import annotations
from datetime import datetime, timezone

from fastapi import HTTPException, status
from pymongo import ReturnDocument

from app.database.mongodb import db
from app.models.pharmacy_order import PHARMACY_ORDERS_COLLECTION
from app.schemas.pharmacy_order import PharmacyOrderListResponse, PharmacyOrderResponse, PharmacyOrderStatus

_TRANSITIONS = {
    PharmacyOrderStatus.PENDING: {PharmacyOrderStatus.ACCEPTED, PharmacyOrderStatus.CANCELLED},
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
    collection.create_index("status", name="pharmacy_order_status")


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
        "created_at": now, "updated_at": now,
        "accepted_at": None, "packed_at": None, "dispensed_at": None,
    }
    db[PHARMACY_ORDERS_COLLECTION].insert_one(document)
    return PharmacyOrderResponse.model_validate(document)


def list_orders(patient_id: str | None = None) -> PharmacyOrderListResponse:
    query = {} if patient_id is None else {"patient_id": patient_id}
    rows = list(db[PHARMACY_ORDERS_COLLECTION].find(query).sort("created_at", -1))
    return PharmacyOrderListResponse(total=len(rows), data=[PharmacyOrderResponse.model_validate(row) for row in rows])


def get_order(order_id: str) -> PharmacyOrderResponse:
    row = db[PHARMACY_ORDERS_COLLECTION].find_one({"order_id": order_id})
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Pharmacy order not found.")
    return PharmacyOrderResponse.model_validate(row)


def update_status(order_id: str, next_status: PharmacyOrderStatus) -> PharmacyOrderResponse:
    current = get_order(order_id)
    if next_status not in _TRANSITIONS[current.status]:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=f"Invalid pharmacy order transition: {current.status} to {next_status}.")
    now = datetime.now(timezone.utc)
    timestamp_field = {
        PharmacyOrderStatus.ACCEPTED: "accepted_at",
        PharmacyOrderStatus.PACKED: "packed_at",
        PharmacyOrderStatus.DISPENSED: "dispensed_at",
    }.get(next_status)
    changes = {"status": next_status.value, "updated_at": now}
    if timestamp_field:
        changes[timestamp_field] = now
    row = db[PHARMACY_ORDERS_COLLECTION].find_one_and_update(
        {"order_id": order_id, "status": current.status.value}, {"$set": changes}, return_document=ReturnDocument.AFTER
    )
    return PharmacyOrderResponse.model_validate(row)
