from __future__ import annotations
import logging
from collections.abc import Callable
from typing import Any

from bson import ObjectId
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import ExpiredSignatureError, JWTError, jwt

from app.config.settings import settings
from app.database.mongodb import db
from app.models.user import USERS_COLLECTION, user_document_to_response
from app.schemas.auth import UserResponse, UserRole

logger = logging.getLogger(__name__)
bearer_scheme = HTTPBearer(auto_error=False)


def _credentials_exception() -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials.",
        headers={"WWW-Authenticate": "Bearer"},
    )


def _forbidden(detail: str) -> HTTPException:
    return HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=detail)


# Declared with `def` rather than `async def` on purpose: the body performs a
# blocking PyMongo read, and FastAPI runs sync dependencies in a threadpool.
# Marking it async would block the event loop on every authenticated request.
def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
) -> UserResponse:
    """Resolve the current user from a valid bearer access token."""
    if credentials is None or credentials.scheme.lower() != "bearer":
        raise _credentials_exception()

    try:
        payload: dict[str, Any] = jwt.decode(
            credentials.credentials,
            settings.SECRET_KEY,
            algorithms=[settings.ALGORITHM],
        )
        user_id = payload.get("sub")
        if not isinstance(user_id, str) or not ObjectId.is_valid(user_id):
            raise _credentials_exception()
    except ExpiredSignatureError as exc:
        logger.info("Rejected expired access token")
        raise _credentials_exception() from exc
    except JWTError as exc:
        logger.warning("Rejected invalid access token")
        raise _credentials_exception() from exc

    user = db[USERS_COLLECTION].find_one({"_id": ObjectId(user_id)})
    if user is None:
        logger.warning("Rejected access token for a user that no longer exists")
        raise _credentials_exception()

    if user.get("is_deleted", False) or user.get("status", "Active").lower() != "active":
        logger.warning("Rejected token for an inactive or deleted user")
        raise _credentials_exception()

    return user_document_to_response(user)


def require_roles(*roles: UserRole | str) -> Callable[..., UserResponse]:
    """Create a dependency that permits only users with one of the supplied roles."""
    allowed_roles = {
        role.value if isinstance(role, UserRole) else UserRole(role).value
        for role in roles
    }

    def role_dependency(
        current_user: UserResponse = Depends(get_current_user),
    ) -> UserResponse:
        if current_user.role.value not in allowed_roles:
            logger.warning("Denied request due to insufficient user role")
            raise _forbidden("Insufficient permissions.")
        return current_user

    return role_dependency


def require_patient_ownership(current_user: UserResponse, patient_id: str) -> None:
    """Reject patient requests that are not tied to the authenticated patient."""
    if current_user.role != UserRole.patient:
        return
    if not current_user.patient_id or current_user.patient_id != patient_id:
        raise _forbidden("Patients may access only their own records.")


# --------------------------------------------------------------------------- #
# Resource ownership
#
# Role checks alone are not sufficient: "is a doctor" does not mean "is *this*
# patient's doctor". Every clinical read/write funnels through the helpers below
# so the linkage rule lives in one place.
# --------------------------------------------------------------------------- #

def doctor_patient_ids(doctor_id: str | None) -> set[str]:
    """Return every patient ID the given doctor is clinically linked to."""
    if not doctor_id:
        return set()
    active = {"is_deleted": {"$ne": True}}
    patient_ids = {
        item["patient_id"]
        for item in db.appointments.find({"doctor_id": doctor_id, **active}, {"patient_id": 1})
        if item.get("patient_id")
    }
    patient_ids.update(
        item["patient_id"]
        for item in db.medical_records.find({"doctor_id": doctor_id, **active}, {"patient_id": 1})
        if item.get("patient_id")
    )
    patient_ids.update(
        item["patient_id"]
        for item in db.patients.find({"assigned_doctor_id": doctor_id, **active}, {"patient_id": 1})
        if item.get("patient_id")
    )
    return patient_ids


def doctor_can_access_patient(current_user: UserResponse, patient_id: str) -> bool:
    """True when a doctor has an appointment, record, or assignment for a patient."""
    if current_user.role != UserRole.doctor:
        return True
    if not current_user.doctor_id:
        return False
    active = {"is_deleted": {"$ne": True}}
    return (
        db.patients.find_one(
            {"patient_id": patient_id, "assigned_doctor_id": current_user.doctor_id, **active}
        )
        is not None
        or db.appointments.find_one(
            {"doctor_id": current_user.doctor_id, "patient_id": patient_id, **active}
        )
        is not None
        or db.medical_records.find_one(
            {"doctor_id": current_user.doctor_id, "patient_id": patient_id, **active}
        )
        is not None
    )


def require_doctor_patient_access(current_user: UserResponse, patient_id: str) -> None:
    """Reject a doctor who has no clinical relationship with the patient."""
    if not doctor_can_access_patient(current_user, patient_id):
        raise _forbidden("Doctors may access only patients they are assigned to.")


def require_clinical_access(current_user: UserResponse, patient_id: str) -> None:
    """Apply both patient-ownership and doctor-linkage rules to one resource."""
    require_patient_ownership(current_user, patient_id)
    require_doctor_patient_access(current_user, patient_id)


def require_owning_doctor(current_user: UserResponse, doctor_id: str | None) -> None:
    """Reject a doctor acting on a record authored by a different doctor."""
    if current_user.role != UserRole.doctor:
        return
    if not current_user.doctor_id or current_user.doctor_id != doctor_id:
        raise _forbidden("Doctors may modify only their own clinical records.")


require_admin = require_roles(UserRole.admin)
require_receptionist = require_roles(UserRole.receptionist)
require_doctor = require_roles(UserRole.doctor)
require_pharmacy = require_roles(UserRole.pharmacy)
require_patient = require_roles(UserRole.patient)
