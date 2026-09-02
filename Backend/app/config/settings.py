from __future__ import annotations

import secrets
from typing import Literal

from pydantic import AliasChoices, Field, field_validator, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

# Secrets shorter than this are trivially brute-forced against an HS256 signature.
MINIMUM_SECRET_KEY_LENGTH = 32
_INSECURE_SECRET_KEYS = {
    "replace_with_a_long_random_secret",
    "replace-with-a-local-development-secret",
    "changeme",
    "secret",
}


class Settings(BaseSettings):
    ENVIRONMENT: Literal["development", "staging", "production"] = "development"

    HOST: str
    PORT: int

    MONGODB_URI: str
    DATABASE_NAME: str

    SECRET_KEY: str = Field(validation_alias=AliasChoices("SECRET_KEY", "JWT_SECRET"))
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    CORS_ORIGINS: str = "http://localhost:5173,http://127.0.0.1:5173"
    AI_MODEL_DIR: str = "AI:ML"

    # Directory for uploaded files. Relative values resolve against the Backend
    # package root rather than the process working directory.
    UPLOAD_DIR: str = "uploads"

    # Login throttling. Counted per login ID and per client address.
    LOGIN_MAX_ATTEMPTS: int = Field(default=8, ge=1)
    LOGIN_ATTEMPT_WINDOW_SECONDS: int = Field(default=300, ge=1)
    LOGIN_LOCKOUT_SECONDS: int = Field(default=900, ge=1)

    # Development-only convenience accounts. Never seeded outside development,
    # and only when an explicit password is supplied.
    SEED_DEMO_USERS: bool = True
    DEMO_USER_PASSWORD: str | None = None

    # Interactive API documentation is disabled outside development by default.
    ENABLE_API_DOCS: bool | None = None

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    @field_validator("CORS_ORIGINS")
    @classmethod
    def _reject_wildcard_origin(cls, value: str) -> str:
        if "*" in value:
            raise ValueError(
                "CORS_ORIGINS must list explicit origins; wildcards are not allowed "
                "because the API is used with credentials."
            )
        return value

    @model_validator(mode="after")
    def _validate_deployment_safety(self) -> "Settings":
        secret = self.SECRET_KEY.strip()
        if self.ENVIRONMENT != "development":
            if len(secret) < MINIMUM_SECRET_KEY_LENGTH or secret in _INSECURE_SECRET_KEYS:
                raise ValueError(
                    "SECRET_KEY must be a unique random value of at least "
                    f"{MINIMUM_SECRET_KEY_LENGTH} characters outside development."
                )
            if self.SEED_DEMO_USERS:
                raise ValueError(
                    "SEED_DEMO_USERS must be false outside development. "
                    "Demo accounts must never exist in a deployed environment."
                )
        return self

    @property
    def is_development(self) -> bool:
        return self.ENVIRONMENT == "development"

    @property
    def docs_enabled(self) -> bool:
        if self.ENABLE_API_DOCS is not None:
            return self.ENABLE_API_DOCS
        return self.is_development

    @property
    def cors_origin_list(self) -> list[str]:
        return [origin.strip() for origin in self.CORS_ORIGINS.split(",") if origin.strip()]

    @property
    def demo_user_password(self) -> str | None:
        """Return the development demo password, if demo seeding is enabled."""
        if not (self.is_development and self.SEED_DEMO_USERS):
            return None
        if self.DEMO_USER_PASSWORD:
            return self.DEMO_USER_PASSWORD
        # No password configured: generate one per process so the accounts are
        # never guessable. The startup log prints it for local development use.
        return secrets.token_urlsafe(18)


settings = Settings()
