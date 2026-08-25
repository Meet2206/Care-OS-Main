from typing import Annotated

from fastapi import APIRouter, Depends, Query, Response, status

from app.controllers import notification_controller
from app.schemas.auth import UserResponse, UserRole
from app.schemas.notification_schema import NotificationCreate, NotificationListResponse, NotificationResponse, NotificationStatus, NotificationType, NotificationUpdate
from app.utils.security import require_admin, require_roles

router = APIRouter(prefix="/notifications", tags=["Notifications"])
ReadUser = Annotated[UserResponse, Depends(require_roles(UserRole.admin, UserRole.doctor, UserRole.receptionist))]
CreateUser = Annotated[UserResponse, Depends(require_roles(UserRole.admin, UserRole.receptionist))]
AdminUser = Annotated[UserResponse, Depends(require_admin)]


@router.post("", response_model=NotificationResponse, status_code=status.HTTP_201_CREATED)
def create_notification(request: NotificationCreate, _: CreateUser) -> NotificationResponse:
    return notification_controller.create(request)


@router.get("", response_model=NotificationListResponse)
def list_notifications(_: ReadUser, page: int = Query(1, ge=1), limit: int = Query(10, ge=1, le=100), search: str | None = None, user_id: str | None = None, patient_id: str | None = None, appointment_id: str | None = None, notification_type: NotificationType | None = Query(None, alias="type"), notification_status: NotificationStatus | None = Query(None, alias="status")) -> NotificationListResponse:
    return notification_controller.list_all(page, limit, search, user_id, patient_id, appointment_id, notification_type, notification_status)


@router.get("/{notification_id}", response_model=NotificationResponse)
def get_notification(notification_id: str, _: ReadUser) -> NotificationResponse:
    return notification_controller.get_one(notification_id)


@router.put("/{notification_id}", response_model=NotificationResponse)
def update_notification(notification_id: str, request: NotificationUpdate, _: AdminUser) -> NotificationResponse:
    return notification_controller.update(notification_id, request)


@router.delete("/{notification_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_notification(notification_id: str, _: AdminUser) -> Response:
    notification_controller.delete(notification_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
