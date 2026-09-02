from typing import Annotated

from fastapi import APIRouter, Depends, Request, Response, status

from app.controllers import auth_controller
from app.schemas.auth import (
    AUTH_ERROR_RESPONSES,
    ChangePasswordRequest,
    LoginRequest,
    RegisterRequest,
    RegisterResponse,
    TokenResponse,
    UserResponse,
)
from app.utils.security import get_current_user, require_admin

router = APIRouter(prefix="/auth", tags=["Authentication"])
AdminUser = Annotated[UserResponse, Depends(require_admin)]
CurrentUser = Annotated[UserResponse, Depends(get_current_user)]


def _client_ip(request: Request) -> str | None:
    return request.client.host if request.client else None


@router.post(
    "/register",
    response_model=RegisterResponse,
    status_code=status.HTTP_201_CREATED,
    responses=AUTH_ERROR_RESPONSES,
    summary="Register a hospital staff user (administrators only)",
)
def register(request: RegisterRequest, _: AdminUser) -> RegisterResponse:
    # Account creation is an administrative action. Self-service registration is
    # not offered because the role is caller-supplied and would otherwise permit
    # anonymous privilege escalation.
    return auth_controller.register(request)


@router.post(
    "/login",
    response_model=TokenResponse,
    status_code=status.HTTP_200_OK,
    responses=AUTH_ERROR_RESPONSES,
    summary="Authenticate and receive a bearer access token",
)
def login(request: LoginRequest, http_request: Request) -> TokenResponse:
    return auth_controller.login(request, client_ip=_client_ip(http_request))


@router.post(
    "/change-password",
    status_code=status.HTTP_204_NO_CONTENT,
    responses=AUTH_ERROR_RESPONSES,
    summary="Rotate the authenticated user's own password",
)
def change_password(
    request: ChangePasswordRequest, current_user: CurrentUser
) -> Response:
    auth_controller.change_password(
        current_user.id, request.current_password, request.new_password
    )
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get(
    "/me",
    response_model=UserResponse,
    responses=AUTH_ERROR_RESPONSES,
    summary="Get the authenticated user",
)
def get_me(current_user: CurrentUser) -> UserResponse:
    return current_user
