from typing import Any

from app.schemas.auth import UserResponse

USERS_COLLECTION = "users"
COUNTERS_COLLECTION = "counters"
USER_COUNTER_KEY = "user_id"


def user_document_to_response(user: dict[str, Any]) -> UserResponse:
    """Convert a MongoDB user document into a safe API response."""
    full_name = user.get("full_name", "").strip()
    first_name = user.get("first_name")
    last_name = user.get("last_name")
    if not first_name:
        first_name, _, last_name = full_name.partition(" ")
    full_name = full_name or " ".join(part for part in (first_name, last_name) if part).strip()
    return UserResponse(
        id=str(user["_id"]),
        full_name=full_name,
        login_id=user.get("login_id", user.get("email", "")),
        email=user.get("email"),
        role=user["role"],
        created_at=user["created_at"],
        user_id=user.get("user_id"),
        first_name=first_name,
        last_name=last_name or None,
        patient_id=user.get("patient_id"),
        doctor_id=user.get("doctor_id"),
        status=user.get("status", "Active"),
    )
