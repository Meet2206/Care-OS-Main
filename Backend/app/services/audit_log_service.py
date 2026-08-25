import re
from datetime import datetime, timezone

from pymongo import ReturnDocument

from app.database.mongodb import db
from app.models.audit_log_model import (
    AUDIT_LOG_COUNTER_KEY,
    AUDIT_LOGS_COLLECTION,
    COUNTERS_COLLECTION,
    audit_log_document_to_response,
)
from app.schemas.audit_log_schema import (
    AuditAction,
    AuditLogCreate,
    AuditLogListResponse,
    AuditLogResponse,
    AuditModule,
)


class AuditLogNotFoundError(Exception):
    pass


def _audit_logs():
    return db[AUDIT_LOGS_COLLECTION]


def ensure_audit_log_indexes() -> None:
    collection = _audit_logs()
    collection.create_index("audit_id", unique=True, name="unique_audit_id")
    collection.create_index("user_id", name="audit_user_id")
    collection.create_index("action", name="audit_action")
    collection.create_index("module", name="audit_module")
    collection.create_index("created_at", name="audit_created_at")
    collection.create_index("is_deleted", name="audit_is_deleted")


def _next_audit_id() -> str:
    counter = db[COUNTERS_COLLECTION].find_one_and_update(
        {"_id": AUDIT_LOG_COUNTER_KEY},
        {"$inc": {"sequence_value": 1}},
        upsert=True,
        return_document=ReturnDocument.AFTER,
    )
    return f"AUD{counter['sequence_value']:06d}"


def create_audit_log(request: AuditLogCreate) -> AuditLogResponse:
    audit_log = request.model_dump(mode="python")
    audit_log.update(
        audit_id=_next_audit_id(),
        created_at=datetime.now(timezone.utc),
        is_deleted=False,
        deleted_at=None,
    )
    _audit_logs().insert_one(audit_log)
    return audit_log_document_to_response(audit_log)


def get_audit_log(audit_id: str) -> AuditLogResponse:
    audit_log = _audit_logs().find_one({"audit_id": audit_id, "is_deleted": {"$ne": True}})
    if audit_log is None:
        raise AuditLogNotFoundError
    return audit_log_document_to_response(audit_log)


def list_audit_logs(
    page: int = 1,
    limit: int = 10,
    search: str | None = None,
    action: AuditAction | None = None,
    module: AuditModule | None = None,
    user_id: str | None = None,
) -> AuditLogListResponse:
    query: dict = {"is_deleted": {"$ne": True}}
    if action:
        query["action"] = action.value
    if module:
        query["module"] = module.value
    if user_id:
        query["user_id"] = user_id
    if search:
        pattern = re.escape(search.strip())
        query["$or"] = [
            {field: {"$regex": pattern, "$options": "i"}}
            for field in ("audit_id", "user_name", "action", "module", "entity_id", "description")
        ]

    total = _audit_logs().count_documents(query)
    records = list(
        _audit_logs().find(query).sort("created_at", -1).skip((page - 1) * limit).limit(limit)
    )
    total_pages = (total + limit - 1) // limit
    return AuditLogListResponse(
        total=total,
        page=page,
        limit=limit,
        total_pages=total_pages,
        has_next=page < total_pages,
        has_previous=page > 1,
        data=[audit_log_document_to_response(record) for record in records],
    )
