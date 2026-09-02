from __future__ import annotations
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status

from app.controllers import notification_controller
from app.schemas.auth import UserResponse, UserRole
from app.schemas.notification_schema import (
    NotificationCreate,
    NotificationListResponse,
    NotificationResponse,
    NotificationStatus,
    NotificationType,
    NotificationUpdate,
)
from app.utils.security import get_current_user, require_admin, require_roles

router = APIRouter(prefix="/notifications", tags=["Notifications"])
# Every signed-in user can read their own notifications; scoping happens below.
CurrentUser = Annotated[UserResponse, Depends(get_current_user)]
CreateUser = Annotated[
    UserResponse, Depends(require_roles(UserRole.admin, UserRole.receptionist))
]
AdminUser = Annotated[UserResponse, Depends(require_admin)]
_STAFF_WIDE = {UserRole.admin, UserRole.receptionist}


def _own_scope(current_user: UserResponse) -> tuple[str | None, str | None]:
    """Return the (user_id, patient_id) a non-privileged caller is limited to."""
    return current_user.user_id, current_user.patient_id


@router.post("", response_model=NotificationResponse, status_code=status.HTTP_201_CREATED)
def create_notification(request: NotificationCreate, _: CreateUser) -> NotificationResponse:
    return notification_controller.create(request)


@router.get("", response_model=NotificationListResponse)
def list_notifications(
    current_user: CurrentUser,
    page: int = Query(1, ge=1),
    limit: int = Query(10, ge=1, le=100),
    search: str | None = None,
    user_id: str | None = None,
    patient_id: str | None = None,
    appointment_id: str | None = None,
    notification_type: NotificationType | None = Query(None, alias="type"),
    notification_status: NotificationStatus | None = Query(None, alias="status"),
) -> NotificationListResponse:
    if current_user.role not in _STAFF_WIDE:
        # Doctors, pharmacy users, and patients see only what is addressed to them.
        own_user_id, own_patient_id = _own_scope(current_user)
        if current_user.role == UserRole.patient and own_patient_id:
            user_id, patient_id = None, own_patient_id
        else:
            user_id, patient_id = own_user_id, None
        if not (user_id or patient_id):
            return NotificationListResponse(
                total=0, page=page, limit=limit, total_pages=0,
                has_next=False, has_previous=False, data=[],
            )
    return notification_controller.list_all(
        page, limit, search, user_id, patient_id, appointment_id,
        notification_type, notification_status,
    )


@router.get("/{notification_id}", response_model=NotificationResponse)
def get_notification(notification_id: str, current_user: CurrentUser) -> NotificationResponse:
    notification = notification_controller.get_one(notification_id)
    if current_user.role not in _STAFF_WIDE:
        own_user_id, own_patient_id = _own_scope(current_user)
        addressed_to_caller = (
            (own_user_id and notification.user_id == own_user_id)
            or (own_patient_id and notification.patient_id == own_patient_id)
        )
        if not addressed_to_caller:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="This notification is addressed to another user.",
            )
    return notification


@router.put("/{notification_id}", response_model=NotificationResponse)
def update_notification(
    notification_id: str, request: NotificationUpdate, _: AdminUser
) -> NotificationResponse:
    return notification_controller.update(notification_id, request)


@router.delete("/{notification_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_notification(notification_id: str, _: AdminUser) -> Response:
    notification_controller.delete(notification_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
