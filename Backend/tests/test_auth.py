from datetime import datetime, timedelta, timezone
from uuid import uuid4

import pytest
from bson import ObjectId
from fastapi import HTTPException
from fastapi.security import HTTPAuthorizationCredentials
from jose import jwt
from pymongo.errors import DuplicateKeyError

from app.config.settings import settings
from app.schemas.auth import LoginRequest, RegisterRequest, UserRole
from app.services import auth_service
from app.utils import security
from app.utils.rate_limit import login_throttle


class InMemoryUsers:
    """Minimal stand-in for the users collection, keyed the way the service is."""

    def __init__(self) -> None:
        self.users: dict[str, dict] = {}

    def create_index(self, *args, **kwargs) -> str:
        return kwargs.get("name", "index")

    def insert_one(self, user: dict):
        if user["login_id"] in self.users:
            raise DuplicateKeyError("duplicate login_id")

        class Result:
            inserted_id = ObjectId()

        self.users[user["login_id"]] = {**user, "_id": Result.inserted_id}
        return Result()

    def find(self, *args, **kwargs):
        return iter([])

    def find_one(self, query: dict, projection: dict | None = None):
        if "login_id" in query:
            return self.users.get(query["login_id"])
        if "email" in query:
            return next(
                (u for u in self.users.values() if u.get("email") == query["email"]), None
            )
        if "_id" in query:
            return next((u for u in self.users.values() if u["_id"] == query["_id"]), None)
        return None

    def update_one(self, query: dict, update: dict):
        user = self.find_one(query)
        if user is not None:
            user.update(update.get("$set", {}))


@pytest.fixture(autouse=True)
def clear_throttle():
    login_throttle.reset()
    yield
    login_throttle.reset()


@pytest.fixture
def users(monkeypatch):
    collection = InMemoryUsers()
    monkeypatch.setattr(auth_service, "_users_collection", lambda: collection)
    return collection


def registration_request(**overrides) -> RegisterRequest:
    payload = {
        "full_name": "Asha Sharma",
        "login_id": "staff@example.com",
        "email": "staff@example.com",
        "password": "SecurePass123",
        "role": UserRole.doctor,
    }
    payload.update(overrides)
    return RegisterRequest(**payload)


def test_registration_hashes_password_and_returns_user(users):
    user = auth_service.register_user(registration_request())

    stored_user = users.users["staff@example.com"]
    assert user.login_id == "staff@example.com"
    assert stored_user["password_hash"] != "SecurePass123"
    assert auth_service.verify_password("SecurePass123", stored_user["password_hash"])


def test_registration_rejects_a_weak_password(users):
    with pytest.raises(auth_service.PasswordPolicyError):
        auth_service.register_user(registration_request(password="allletters"))


def test_login_returns_access_token(users):
    auth_service.register_user(registration_request())

    token = auth_service.login_user(
        LoginRequest(login_id="staff@example.com", password="SecurePass123")
    )

    assert token.token_type == "bearer"
    assert token.access_token.count(".") == 2
    assert token.must_change_password is False


def test_duplicate_login_id_is_rejected(users):
    auth_service.register_user(registration_request())

    with pytest.raises(auth_service.EmailAlreadyRegisteredError):
        auth_service.register_user(registration_request())


def test_invalid_password_is_rejected(users):
    auth_service.register_user(registration_request())

    with pytest.raises(auth_service.InvalidCredentialsError):
        auth_service.login_user(
            LoginRequest(login_id="staff@example.com", password="WrongPass123")
        )


def test_generated_passwords_are_random():
    first = auth_service.generate_temporary_password()
    second = auth_service.generate_temporary_password()
    assert first != second
    assert len(first) >= 12


def test_change_password_requires_the_current_password(users, monkeypatch):
    auth_service.register_user(registration_request())
    stored = users.users["staff@example.com"]
    monkeypatch.setattr(auth_service, "_users_collection", lambda: users)

    with pytest.raises(auth_service.InvalidCredentialsError):
        auth_service.change_password(str(stored["_id"]), "WrongPass123", "BrandNew123")

    auth_service.change_password(str(stored["_id"]), "SecurePass123", "BrandNew123")
    assert auth_service.verify_password("BrandNew123", stored["password_hash"])
    assert stored["must_change_password"] is False


def test_demo_users_are_not_seeded_outside_development(monkeypatch):
    monkeypatch.setattr(settings, "ENVIRONMENT", "production")
    assert auth_service.ensure_demo_users() is None


def test_invalid_token_is_rejected():
    credentials = HTTPAuthorizationCredentials(scheme="Bearer", credentials="not-a-token")

    with pytest.raises(HTTPException) as exc_info:
        security.get_current_user(credentials)

    assert exc_info.value.status_code == 401


def test_expired_token_is_rejected():
    expired_token = jwt.encode(
        {"sub": str(ObjectId()), "exp": datetime.now(timezone.utc) - timedelta(minutes=1)},
        settings.SECRET_KEY,
        algorithm=settings.ALGORITHM,
    )
    credentials = HTTPAuthorizationCredentials(scheme="Bearer", credentials=expired_token)

    with pytest.raises(HTTPException) as exc_info:
        security.get_current_user(credentials)

    assert exc_info.value.status_code == 401


def test_unsigned_token_is_rejected():
    """A token signed with a different key must never authenticate."""
    forged = jwt.encode(
        {"sub": str(ObjectId()), "role": "admin"}, "not-the-real-secret", algorithm="HS256"
    )
    credentials = HTTPAuthorizationCredentials(scheme="Bearer", credentials=forged)

    with pytest.raises(HTTPException) as exc_info:
        security.get_current_user(credentials)

    assert exc_info.value.status_code == 401


def test_missing_credentials_are_rejected():
    with pytest.raises(HTTPException) as exc_info:
        security.get_current_user(None)

    assert exc_info.value.status_code == 401


def test_login_throttle_locks_out_after_repeated_failures(monkeypatch):
    monkeypatch.setattr(settings, "LOGIN_MAX_ATTEMPTS", 3)
    keys = ["login:someone", "ip:203.0.113.5"]

    assert login_throttle.retry_after(keys) == 0
    for _ in range(3):
        login_throttle.register_failure(keys)

    assert login_throttle.retry_after(keys) > 0


def test_login_throttle_clears_after_a_success(monkeypatch):
    monkeypatch.setattr(settings, "LOGIN_MAX_ATTEMPTS", 3)
    keys = ["login:someone-else"]

    login_throttle.register_failure(keys)
    login_throttle.register_success(keys)

    assert login_throttle.retry_after(keys) == 0
