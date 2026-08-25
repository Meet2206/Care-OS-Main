import logging
from datetime import datetime, timedelta, timezone

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


class EmailAlreadyRegisteredError(Exception):
    pass


class InvalidCredentialsError(Exception):
    pass


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


_ensure_indexes = ensure_user_indexes


def _next_user_id() -> str:
    counter = db[COUNTERS_COLLECTION].find_one_and_update(
        {"_id": USER_COUNTER_KEY}, {"$inc": {"sequence_value": 1}}, upsert=True,
        return_document=ReturnDocument.AFTER,
    )
    return f"USR{counter['sequence_value']:06d}"


def _normalise_email(email: str) -> str:
    return email.strip().lower()


def hash_password(password: str) -> str:
    return password_context.hash(password)


def verify_password(plain_password: str, password_hash: str) -> bool:
    return password_context.verify(plain_password, password_hash)


def register_user(request: RegisterRequest) -> UserResponse:
    ensure_user_indexes()
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
    return TokenResponse(access_token=create_access_token(user_response), user=user_response)


DEMO_USERS = (
    ("DoctorMeet@CareOS", "MeetLimbachiya22", "doctor", "Doctor Meet"),
    ("PharmacyMeet@CareOS", "MeetLimbachiya22", "pharmacy", "Pharmacy Meet"),
    ("PatientMeet@CareOS", "MeetLimbachiya22", "patient", "Patient Meet"),
    ("Reception@CareOS", "MeetLimbachiya22", "receptionist", "Reception"),
)


def ensure_demo_users() -> None:
    """Create missing development users without changing existing accounts."""
    for login_id, password, role, full_name in DEMO_USERS:
        if _users_collection().find_one({"login_id": login_id}):
            continue
        now = datetime.now(timezone.utc)
        user = {
            "login_id": login_id,
            "full_name": full_name,
            "first_name": full_name.split(maxsplit=1)[0],
            "last_name": full_name.partition(" ")[2] or None,
            "user_id": _next_user_id(),
            "password_hash": hash_password(password),
            "role": role,
            "created_at": now,
            "updated_at": now,
            "status": "Active",
            "is_deleted": False,
            "deleted_at": None,
        }
        try:
            _users_collection().insert_one(user)
        except DuplicateKeyError:
            logger.info("Demo user already exists: %s", login_id)
