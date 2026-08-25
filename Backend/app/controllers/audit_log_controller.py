from fastapi import HTTPException, status

from app.schemas.audit_log_schema import AuditAction, AuditLogListResponse, AuditLogResponse, AuditModule
from app.services import audit_log_service


def list_all(
    page: int,
    limit: int,
    search: str | None,
    action: AuditAction | None,
    module: AuditModule | None,
    user_id: str | None,
) -> AuditLogListResponse:
    return audit_log_service.list_audit_logs(page, limit, search, action, module, user_id)


def get_one(audit_id: str) -> AuditLogResponse:
    try:
        return audit_log_service.get_audit_log(audit_id)
    except audit_log_service.AuditLogNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Audit log not found.") from exc
