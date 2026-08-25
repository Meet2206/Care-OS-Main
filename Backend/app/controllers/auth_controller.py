from fastapi import HTTPException, status

from app.schemas.auth import LoginRequest, RegisterRequest, RegisterResponse, TokenResponse
from app.services.auth_service import (
    EmailAlreadyRegisteredError,
    InvalidCredentialsError,
    login_user,
    register_user,
)


def register(request: RegisterRequest) -> RegisterResponse:
    try:
        user = register_user(request)
    except EmailAlreadyRegisteredError as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An account with this login ID already exists.",
        ) from exc

    return RegisterResponse(message="User registered successfully.", user=user)


def login(request: LoginRequest) -> TokenResponse:
    try:
        return login_user(request)
    except InvalidCredentialsError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid login ID or password.",
            headers={"WWW-Authenticate": "Bearer"},
        ) from exc
