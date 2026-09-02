"""Audit trail for authenticated access to clinical and administrative data.

Handling health information requires a record of who accessed what and when.
Recording it here rather than in each route means a new endpoint is covered the
moment it is added, and no handler can forget to log.

Only successful requests are recorded. Reads of collection endpoints and of
non-clinical modules are skipped to keep the trail signal-dense.
"""
from __future__ import annotations

import logging
from typing import Any

from bson import ObjectId
from jose import JWTError, jwt
from starlette.concurrency import run_in_threadpool
from starlette.middleware.base import BaseHTTPMiddleware

from app.config.settings import settings
from app.database.mongodb import db
from app.models.user import USERS_COLLECTION
from app.schemas.audit_log_schema import AuditAction, AuditLogCreate, AuditModule
from app.services.audit_log_service import create_audit_log

logger = logging.getLogger(__name__)

_MODULE_BY_PREFIX: tuple[tuple[str, AuditModule], ...] = (
    ("/api/v1/patients", AuditModule.patients),
    ("/api/v1/doctors", AuditModule.doctors),
    ("/api/v1/appointments", AuditModule.appointments),
    ("/api/v1/medical-records", AuditModule.medical_records),
    ("/api/v1/prescriptions", AuditModule.prescriptions),
    ("/api/v1/pharmacy-orders", AuditModule.pharmacy_orders),
    ("/api/v1/bills", AuditModule.billing),
    ("/api/v1/notifications", AuditModule.notifications),
    ("/api/v1/files", AuditModule.files),
    ("/api/v1/reports", AuditModule.reports),
    ("/api/v1/ai", AuditModule.ai),
    ("/api/v1/auth", AuditModule.users),
)

# Modules whose reads carry health information and are therefore recorded.
_READ_AUDITED = {
    AuditModule.patients,
    AuditModule.medical_records,
    AuditModule.prescriptions,
    AuditModule.reports,
    AuditModule.files,
}

_ACTION_BY_METHOD = {
    "POST": AuditAction.create,
    "PUT": AuditAction.update,
    "PATCH": AuditAction.update,
    "DELETE": AuditAction.delete,
    "GET": AuditAction.read,
}


def _module_for(path: str) -> AuditModule | None:
    for prefix, module in _MODULE_BY_PREFIX:
        if path.startswith(prefix):
            return module
    return None


def _identity_from_token(authorization: str | None) -> dict[str, Any] | None:
    """Resolve the acting user from the bearer token without an extra DB round trip."""
    if not authorization or not authorization.lower().startswith("bearer "):
        return None
    token = authorization.split(" ", 1)[1].strip()
    try:
        claims = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
    except JWTError:
        return None
    subject = claims.get("sub")
    if not isinstance(subject, str) or not ObjectId.is_valid(subject):
        return None
    return {
        "object_id": subject,
        "login_id": claims.get("login_id") or "unknown",
        "role": claims.get("role") or "unknown",
    }


def _entity_id(path: str) -> str | None:
    """Return the trailing resource identifier, when the path addresses one."""
    parts = [segment for segment in path.split("/") if segment]
    if len(parts) < 4:
        return None
    candidate = parts[-1]
    if candidate == "status" and len(parts) >= 5:
        candidate = parts[-2]
    return candidate if any(character.isdigit() for character in candidate) else None


def _write_entry(
    identity: dict[str, Any],
    action: AuditAction,
    module: AuditModule,
    method: str,
    path: str,
    status_code: int,
    client_ip: str | None,
) -> None:
    user = db[USERS_COLLECTION].find_one(
        {"_id": ObjectId(identity["object_id"])},
        {"user_id": 1, "full_name": 1, "role": 1},
    )
    create_audit_log(
        AuditLogCreate(
            user_id=(user or {}).get("user_id") or identity["object_id"][:24],
            user_name=(user or {}).get("full_name") or identity["login_id"],
            role=(user or {}).get("role") or identity["role"],
            action=action,
            module=module,
            entity_id=_entity_id(path),
            description=f"{method} {path} -> {status_code}",
            ip_address=client_ip,
        )
    )


class AuditLogMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request, call_next):
        response = await call_next(request)
        try:
            await self._record(request, response)
        except Exception:  # pragma: no cover - auditing must never break a request
            logger.exception("Failed to write an audit log entry")
        return response

    async def _record(self, request, response) -> None:
        if not (200 <= response.status_code < 300):
            return
        module = _module_for(request.url.path)
        if module is None:
            return
        action = _ACTION_BY_METHOD.get(request.method)
        if action is None:
            return
        if action is AuditAction.read and module not in _READ_AUDITED:
            return
        identity = _identity_from_token(request.headers.get("authorization"))
        if identity is None:
            return
        client_ip = request.client.host if request.client else None
        # PyMongo is blocking; keep it off the event loop.
        await run_in_threadpool(
            _write_entry,
            identity,
            action,
            module,
            request.method,
            request.url.path,
            response.status_code,
            client_ip,
        )
