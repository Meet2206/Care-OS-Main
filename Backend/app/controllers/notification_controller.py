from fastapi import HTTPException, status

from app.schemas.notification_schema import NotificationCreate, NotificationUpdate
from app.services import notification_service


def _not_found(exc: Exception):
    raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Notification not found.") from exc


def create(request: NotificationCreate):
    return notification_service.create_notification(request)


def get_one(notification_id: str):
    try:
        return notification_service.get_notification(notification_id)
    except notification_service.NotificationNotFoundError as exc:
        _not_found(exc)


def list_all(*args):
    return notification_service.list_notifications(*args)


def update(notification_id: str, request: NotificationUpdate):
    try:
        return notification_service.update_notification(notification_id, request)
    except notification_service.NotificationNotFoundError as exc:
        _not_found(exc)


def delete(notification_id: str):
    try:
        notification_service.delete_notification(notification_id)
    except notification_service.NotificationNotFoundError as exc:
        _not_found(exc)
