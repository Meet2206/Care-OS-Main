import asyncio
from datetime import datetime, timedelta, timezone
from uuid import uuid4

import pytest
from fastapi import HTTPException
from fastapi.security import HTTPAuthorizationCredentials
from jose import jwt
from pymongo.errors import DuplicateKeyError

from app.config.settings import settings
from app.schemas.auth import LoginRequest, RegisterRequest, UserRole
from app.services import auth_service
from app.utils import security


class InMemoryUsers:
    def __init__(self) -> None:
        self.users: dict[str, dict] = {}

    def create_index(self, *args, **kwargs) -> str:
        return "unique_user_email"

    def insert_one(self, user: dict):
        if user["email"] in self.users:
            raise DuplicateKeyError("duplicate email")

        class Result:
            inserted_id = uuid4()

        self.users[user["email"]] = {**user, "_id": Result.inserted_id}
        return Result()

    def find_one(self, query: dict):
        if "email" in query:
            return self.users.get(query["email"])
        return None


@pytest.fixture
def users(monkeypatch):
    collection = InMemoryUsers()
    monkeypatch.setattr(auth_service, "_users_collection", lambda: collection)
    return collection


def registration_request() -> RegisterRequest:
    return RegisterRequest(
        full_name="Asha Sharma",
        email="staff@example.com",
        password="SecurePass123",
        role=UserRole.doctor,
    )


def test_registration_hashes_password_and_returns_user(users):
    user = auth_service.register_user(registration_request())

    stored_user = users.users["staff@example.com"]
    assert user.email == "staff@example.com"
    assert stored_user["password_hash"] != "SecurePass123"
    assert auth_service.verify_password("SecurePass123", stored_user["password_hash"])


def test_login_returns_access_token(users):
    auth_service.register_user(registration_request())

    token = auth_service.login_user(LoginRequest(email="staff@example.com", password="SecurePass123"))

    assert token.token_type == "bearer"
    assert token.access_token.count(".") == 2


def test_duplicate_email_is_rejected(users):
    auth_service.register_user(registration_request())

    with pytest.raises(auth_service.EmailAlreadyRegisteredError):
        auth_service.register_user(registration_request())


def test_invalid_password_is_rejected(users):
    auth_service.register_user(registration_request())

    with pytest.raises(auth_service.InvalidCredentialsError):
        auth_service.login_user(LoginRequest(email="staff@example.com", password="WrongPass123"))


def test_invalid_token_is_rejected():
    credentials = HTTPAuthorizationCredentials(scheme="Bearer", credentials="not-a-token")

    with pytest.raises(HTTPException) as exc_info:
        asyncio.run(security.get_current_user(credentials))

    assert exc_info.value.status_code == 401


def test_expired_token_is_rejected():
    expired_token = jwt.encode(
        {"sub": str(uuid4()), "exp": datetime.now(timezone.utc) - timedelta(minutes=1)},
        settings.SECRET_KEY,
        algorithm=settings.ALGORITHM,
    )
    credentials = HTTPAuthorizationCredentials(scheme="Bearer", credentials=expired_token)

    with pytest.raises(HTTPException) as exc_info:
        asyncio.run(security.get_current_user(credentials))

    assert exc_info.value.status_code == 401
