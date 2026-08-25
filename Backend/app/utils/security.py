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


async def get_current_user(
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

    async def role_dependency(
        current_user: UserResponse = Depends(get_current_user),
    ) -> UserResponse:
        if current_user.role.value not in allowed_roles:
            logger.warning("Denied request due to insufficient user role")
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Insufficient permissions.",
            )
        return current_user

    return role_dependency


def require_patient_ownership(current_user: UserResponse, patient_id: str) -> None:
    """Reject patient requests that are not tied to the authenticated patient."""
    if current_user.role != UserRole.patient:
        return
    if not current_user.patient_id or current_user.patient_id != patient_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Patients may access only their own records.",
        )


require_admin = require_roles(UserRole.admin)
require_receptionist = require_roles(UserRole.receptionist)
require_doctor = require_roles(UserRole.doctor)
require_pharmacy = require_roles(UserRole.pharmacy)
require_patient = require_roles(UserRole.patient)
