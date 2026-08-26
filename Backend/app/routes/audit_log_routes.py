from __future__ import annotations
from typing import Annotated

from fastapi import APIRouter, Depends, Query

from app.controllers import audit_log_controller
from app.schemas.audit_log_schema import AuditAction, AuditLogListResponse, AuditLogResponse, AuditModule
from app.schemas.auth import AUTH_ERROR_RESPONSES, UserResponse
from app.utils.security import require_admin

router = APIRouter(prefix="/audit-logs", tags=["Audit Logs"])
AdminUser = Annotated[UserResponse, Depends(require_admin)]


@router.get("", response_model=AuditLogListResponse, responses=AUTH_ERROR_RESPONSES)
def list_audit_logs(
    _: AdminUser,
    page: int = Query(default=1, ge=1),
    limit: int = Query(default=10, ge=1, le=100),
    search: str | None = Query(default=None),
    action: AuditAction | None = Query(default=None),
    module: AuditModule | None = Query(default=None),
    user_id: str | None = Query(default=None),
) -> AuditLogListResponse:
    return audit_log_controller.list_all(page, limit, search, action, module, user_id)


@router.get("/{audit_id}", response_model=AuditLogResponse, responses=AUTH_ERROR_RESPONSES)
def get_audit_log(audit_id: str, _: AdminUser) -> AuditLogResponse:
    return audit_log_controller.get_one(audit_id)
