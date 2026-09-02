import logging

from fastapi import HTTPException, status

from app.schemas.auth import LoginRequest, RegisterRequest, RegisterResponse, TokenResponse
from app.services.auth_service import (
    EmailAlreadyRegisteredError,
    InvalidCredentialsError,
    PasswordPolicyError,
    change_password as change_password_service,
    login_user,
    register_user,
)
from app.utils.rate_limit import login_throttle

logger = logging.getLogger(__name__)


def _throttle_keys(login_id: str | None, client_ip: str | None) -> list[str]:
    keys = []
    if login_id:
        keys.append(f"login:{login_id.strip().lower()}")
    if client_ip:
        keys.append(f"ip:{client_ip}")
    return keys


def register(request: RegisterRequest) -> RegisterResponse:
    try:
        user = register_user(request)
    except PasswordPolicyError as exc:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(exc)) from exc
    except EmailAlreadyRegisteredError as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An account with this login ID already exists.",
        ) from exc

    return RegisterResponse(message="User registered successfully.", user=user)


def login(request: LoginRequest, client_ip: str | None = None) -> TokenResponse:
    keys = _throttle_keys(request.login_id, client_ip)
    retry_after = login_throttle.retry_after(keys)
    if retry_after:
        logger.warning("Login blocked by throttle")
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many failed sign-in attempts. Please try again later.",
            headers={"Retry-After": str(retry_after)},
        )
    try:
        token = login_user(request)
    except InvalidCredentialsError as exc:
        login_throttle.register_failure(keys)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid login ID or password.",
            headers={"WWW-Authenticate": "Bearer"},
        ) from exc
    login_throttle.register_success(keys)
    return token


def change_password(user_id: str, current_password: str, new_password: str) -> None:
    try:
        change_password_service(user_id, current_password, new_password)
    except InvalidCredentialsError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="The current password is incorrect.",
        ) from exc
    except PasswordPolicyError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(exc)
        ) from exc
