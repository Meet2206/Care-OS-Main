from __future__ import annotations
import re
from datetime import datetime, timezone

from pymongo import ReturnDocument

from app.database.mongodb import db
from app.models.notification import COUNTERS_COLLECTION, NOTIFICATION_COUNTER_KEY, NOTIFICATIONS_COLLECTION, notification_document_to_response
from app.schemas.notification_schema import NotificationCreate, NotificationListResponse, NotificationResponse, NotificationStatus, NotificationType, NotificationUpdate


class NotificationNotFoundError(Exception):
    pass


def _notifications():
    return db[NOTIFICATIONS_COLLECTION]


def ensure_notification_indexes() -> None:
    collection = _notifications()
    collection.create_index("notification_id", unique=True, name="unique_notification_id")
    collection.create_index("user_id", name="notification_user_id")
    collection.create_index("status", name="notification_status")
    collection.create_index("type", name="notification_type")
    collection.create_index("scheduled_at", name="notification_scheduled_at")
    collection.create_index("is_deleted", name="notification_is_deleted")


def _next_notification_id() -> str:
    counter = db[COUNTERS_COLLECTION].find_one_and_update({"_id": NOTIFICATION_COUNTER_KEY}, {"$inc": {"sequence_value": 1}}, upsert=True, return_document=ReturnDocument.AFTER)
    return f"NOT{counter['sequence_value']:06d}"


def create_notification(request: NotificationCreate) -> NotificationResponse:
    ensure_notification_indexes()
    now = datetime.now(timezone.utc)
    notification = request.model_dump(mode="python")
    notification.update(notification_id=_next_notification_id(), created_at=now, updated_at=now, is_deleted=False, deleted_at=None)
    _notifications().insert_one(notification)
    return notification_document_to_response(notification)


def get_notification(notification_id: str) -> NotificationResponse:
    notification = _notifications().find_one({"notification_id": notification_id, "is_deleted": {"$ne": True}})
    if notification is None:
        raise NotificationNotFoundError
    return notification_document_to_response(notification)


def list_notifications(page: int, limit: int, search: str | None, user_id: str | None, patient_id: str | None, appointment_id: str | None, notification_type: NotificationType | None, notification_status: NotificationStatus | None) -> NotificationListResponse:
    query: dict = {"is_deleted": {"$ne": True}}
    for field, value in {"user_id": user_id, "patient_id": patient_id, "appointment_id": appointment_id, "type": notification_type.value if notification_type else None, "status": notification_status.value if notification_status else None}.items():
        if value:
            query[field] = value
    if search:
        pattern = re.escape(search.strip())
        query["$or"] = [{field: {"$regex": pattern, "$options": "i"}} for field in ("notification_id", "title", "type", "status")]
    total = _notifications().count_documents(query)
    rows = list(_notifications().find(query).sort("created_at", -1).skip((page - 1) * limit).limit(limit))
    pages = (total + limit - 1) // limit
    return NotificationListResponse(total=total, page=page, limit=limit, total_pages=pages, has_next=page < pages, has_previous=page > 1, data=[notification_document_to_response(row) for row in rows])


def update_notification(notification_id: str, request: NotificationUpdate) -> NotificationResponse:
    changes = request.model_dump(exclude_unset=True, mode="python")
    if not changes:
        return get_notification(notification_id)
    changes["updated_at"] = datetime.now(timezone.utc)
    notification = _notifications().find_one_and_update({"notification_id": notification_id, "is_deleted": {"$ne": True}}, {"$set": changes}, return_document=ReturnDocument.AFTER)
    if notification is None:
        raise NotificationNotFoundError
    return notification_document_to_response(notification)


def delete_notification(notification_id: str) -> None:
    now = datetime.now(timezone.utc)
    notification = _notifications().find_one_and_update({"notification_id": notification_id, "is_deleted": {"$ne": True}}, {"$set": {"is_deleted": True, "deleted_at": now, "updated_at": now}}, return_document=ReturnDocument.AFTER)
    if notification is None:
        raise NotificationNotFoundError
