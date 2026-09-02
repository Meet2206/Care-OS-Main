import logging
import secrets
import string
from datetime import datetime, timedelta, timezone

from bson import ObjectId
from jose import jwt
from passlib.context import CryptContext
from pymongo.errors import DuplicateKeyError
from pymongo import ReturnDocument

from app.config.settings import settings
from app.database.mongodb import db
from app.models.user import COUNTERS_COLLECTION, USER_COUNTER_KEY, USERS_COLLECTION, user_document_to_response
from app.schemas.auth import LoginRequest, RegisterRequest, TokenResponse, UserResponse

password_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
logger = logging.getLogger(__name__)

# bcrypt silently truncates beyond 72 bytes; reject longer input instead.
MAX_PASSWORD_BYTES = 72
_PASSWORD_ALPHABET = string.ascii_letters + string.digits


class EmailAlreadyRegisteredError(Exception):
    pass


class InvalidCredentialsError(Exception):
    pass


class PasswordPolicyError(Exception):
    """Raised when a supplied password does not meet the minimum policy."""


def _users_collection():
    return db[USERS_COLLECTION]


def ensure_user_indexes() -> None:
    # Older users were keyed by email. Preserve them by deriving a stable login ID
    # before enforcing the new unique login_id index.
    for legacy_user in _users_collection().find({"login_id": {"$exists": False}}):
        legacy_login_id = legacy_user.get("email") or legacy_user.get("user_id")
        if legacy_login_id:
            _users_collection().update_one(
                {"_id": legacy_user["_id"]}, {"$set": {"login_id": str(legacy_login_id)}}
            )
    _users_collection().create_index("login_id", unique=True, name="unique_user_login_id")
    _users_collection().create_index("email", unique=True, sparse=True, name="unique_user_email")
    _users_collection().create_index("user_id", unique=True, sparse=True, name="unique_user_id")
    _users_collection().create_index("is_deleted", name="user_is_deleted")
    _users_collection().create_index("patient_id", sparse=True, name="user_patient_id")
    _users_collection().create_index("doctor_id", sparse=True, name="user_doctor_id")


_ensure_indexes = ensure_user_indexes


def _next_user_id() -> str:
    counter = db[COUNTERS_COLLECTION].find_one_and_update(
        {"_id": USER_COUNTER_KEY}, {"$inc": {"sequence_value": 1}}, upsert=True,
        return_document=ReturnDocument.AFTER,
    )
    return f"USR{counter['sequence_value']:06d}"


def _normalise_email(email: str) -> str:
    return email.strip().lower()


def generate_temporary_password(length: int = 14) -> str:
    """Return a cryptographically random password for a system-created account."""
    return "".join(secrets.choice(_PASSWORD_ALPHABET) for _ in range(length))


def validate_password_policy(password: str) -> None:
    if len(password) < 8:
        raise PasswordPolicyError("Password must be at least 8 characters long.")
    if len(password.encode("utf-8")) > MAX_PASSWORD_BYTES:
        raise PasswordPolicyError("Password must not exceed 72 bytes.")
    if password.isdigit() or password.isalpha():
        raise PasswordPolicyError("Password must combine letters and numbers.")


def hash_password(password: str) -> str:
    return password_context.hash(password)


def verify_password(plain_password: str, password_hash: str) -> bool:
    try:
        return password_context.verify(plain_password, password_hash)
    except ValueError:
        # Malformed or truncated stored hash: treat as a failed verification
        # rather than surfacing an internal error to the caller.
        logger.warning("Password verification failed because the stored hash is unusable")
        return False


def register_user(request: RegisterRequest) -> UserResponse:
    """Create a staff account. Callers must already have enforced authorisation."""
    ensure_user_indexes()
    validate_password_policy(request.password)
    now = datetime.now(timezone.utc)
    user = {
        "full_name": request.full_name.strip(),
        "first_name": request.full_name.strip().split(maxsplit=1)[0],
        "last_name": request.full_name.strip().partition(" ")[2],
        "user_id": _next_user_id(),
        "login_id": request.login_id.strip(),
        **({"email": _normalise_email(str(request.email))} if request.email else {}),
        "password_hash": hash_password(request.password),
        "role": request.role.value,
        "created_at": now,
        "updated_at": now,
        "status": "Active",
        "must_change_password": False,
        "is_deleted": False,
        "deleted_at": None,
    }

    try:
        result = _users_collection().insert_one(user)
    except DuplicateKeyError as exc:
        logger.warning("Registration rejected because the login ID is already registered")
        raise EmailAlreadyRegisteredError from exc

    user["_id"] = result.inserted_id
    logger.info("User registered successfully", extra={"user_id": str(result.inserted_id)})
    return user_document_to_response(user)


def create_access_token(user: UserResponse) -> str:
    expires_at = datetime.now(timezone.utc) + timedelta(
        minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES
    )
    payload = {
        "sub": user.id,
        "login_id": user.login_id,
        "role": user.role.value,
        "exp": expires_at,
        "iat": datetime.now(timezone.utc),
    }
    return jwt.encode(payload, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


def login_user(request: LoginRequest) -> TokenResponse:
    user = _users_collection().find_one({"login_id": request.login_id.strip()})
    if user is None and request.email:
        user = _users_collection().find_one({"email": _normalise_email(str(request.email))})
    if (
        user is None
        or user.get("is_deleted", False)
        or user.get("status", "Active").lower() != "active"
        or not verify_password(request.password, user["password_hash"])
    ):
        logger.warning("Login rejected because credentials are invalid")
        raise InvalidCredentialsError

    user_response = user_document_to_response(user)
    logger.info("User logged in successfully", extra={"user_id": user_response.id})
    return TokenResponse(
        access_token=create_access_token(user_response),
        user=user_response,
        must_change_password=bool(user.get("must_change_password", False)),
    )


def change_password(user_id: str, current_password: str, new_password: str) -> None:
    """Rotate the authenticated user's own password."""
    user = _users_collection().find_one({"_id": ObjectId(user_id)})
    if user is None or not verify_password(current_password, user["password_hash"]):
        raise InvalidCredentialsError
    validate_password_policy(new_password)
    if verify_password(new_password, user["password_hash"]):
        raise PasswordPolicyError("The new password must differ from the current password.")
    _users_collection().update_one(
        {"_id": user["_id"]},
        {
            "$set": {
                "password_hash": hash_password(new_password),
                "must_change_password": False,
                "password_changed_at": datetime.now(timezone.utc),
                "updated_at": datetime.now(timezone.utc),
            }
        },
    )
    logger.info("Password rotated", extra={"user_id": str(user["_id"])})


# Development convenience accounts. The password is never stored in source; it
# comes from DEMO_USER_PASSWORD, or is generated per process and logged locally.
DEMO_USERS = (
    ("Admin@CareOS", "admin", "CareOS Admin"),
    ("DoctorMeet@CareOS", "doctor", "Doctor Meet"),
    ("PharmacyMeet@CareOS", "pharmacy", "Pharmacy Meet"),
    ("PatientMeet@CareOS", "patient", "Patient Meet"),
    ("Reception@CareOS", "receptionist", "Reception"),
)


def ensure_demo_users() -> str | None:
    """Create missing development accounts. No-op outside development.

    Returns the password the accounts were created with, or None when nothing
    was seeded. Existing accounts are never modified.
    """
    demo_password = settings.demo_user_password
    if demo_password is None:
        logger.info("Demo user seeding is disabled for this environment")
        return None

    created_any = False
    for login_id, role, full_name in DEMO_USERS:
        if _users_collection().find_one({"login_id": login_id}):
            continue
        now = datetime.now(timezone.utc)
        user = {
            "login_id": login_id,
            "full_name": full_name,
            "first_name": full_name.split(maxsplit=1)[0],
            "last_name": full_name.partition(" ")[2] or None,
            "user_id": _next_user_id(),
            "password_hash": hash_password(demo_password),
            "role": role,
            "created_at": now,
            "updated_at": now,
            "status": "Active",
            "must_change_password": False,
            "is_deleted": False,
            "deleted_at": None,
        }
        try:
            _users_collection().insert_one(user)
            created_any = True
        except DuplicateKeyError:
            logger.info("Demo user already exists: %s", login_id)
    return demo_password if created_any else None
