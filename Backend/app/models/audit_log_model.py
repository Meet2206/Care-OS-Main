from typing import Any

from app.schemas.audit_log_schema import AuditLogResponse

AUDIT_LOGS_COLLECTION = "audit_logs"
COUNTERS_COLLECTION = "counters"
AUDIT_LOG_COUNTER_KEY = "audit_log_id"


def audit_log_document_to_response(audit_log: dict[str, Any]) -> AuditLogResponse:
    return AuditLogResponse(**{key: value for key, value in audit_log.items() if key != "_id"})
