from fastapi import APIRouter, Depends, status

from app.controllers import auth_controller
from app.schemas.auth import (
    AUTH_ERROR_RESPONSES,
    LoginRequest,
    RegisterRequest,
    RegisterResponse,
    TokenResponse,
    UserResponse,
)
from app.utils.security import get_current_user

router = APIRouter(prefix="/auth", tags=["Authentication"])


@router.post(
    "/register",
    response_model=RegisterResponse,
    status_code=status.HTTP_201_CREATED,
    responses=AUTH_ERROR_RESPONSES,
    summary="Register a hospital staff user",
)
def register(request: RegisterRequest) -> RegisterResponse:
    return auth_controller.register(request)


@router.post(
    "/login",
    response_model=TokenResponse,
    status_code=status.HTTP_200_OK,
    responses=AUTH_ERROR_RESPONSES,
    summary="Authenticate and receive a bearer access token",
)
def login(request: LoginRequest) -> TokenResponse:
    return auth_controller.login(request)


@router.get(
    "/me",
    response_model=UserResponse,
    responses=AUTH_ERROR_RESPONSES,
    summary="Get the authenticated user",
)
async def get_me(current_user: UserResponse = Depends(get_current_user)) -> UserResponse:
    return current_user
