from pydantic import AliasChoices, Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    HOST: str
    PORT: int

    MONGODB_URI: str
    DATABASE_NAME: str

    SECRET_KEY: str = Field(validation_alias=AliasChoices("SECRET_KEY", "JWT_SECRET"))
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    CORS_ORIGINS: str = "http://localhost:5173"
    AI_MODEL_DIR: str = "AI:ML"

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")


settings = Settings()
