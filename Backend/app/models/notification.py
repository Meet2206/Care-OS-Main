from typing import Any

from app.schemas.notification_schema import NotificationResponse

NOTIFICATIONS_COLLECTION = "notifications"
COUNTERS_COLLECTION = "counters"
NOTIFICATION_COUNTER_KEY = "notification_id"


def notification_document_to_response(notification: dict[str, Any]) -> NotificationResponse:
    return NotificationResponse(**{key: value for key, value in notification.items() if key not in {"_id", "is_deleted", "deleted_at"}})
