import os
from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    API_V1_STR: str = "/api/v1"
    DATABASE_URL: str
    # Change this to a long random string for production!
    SECRET_KEY: str = Field(default="12345678910", validation_alias="JWT_SECRET")
    ALGORITHM: str = "HS256"
    # Token expire time (60 minutes * 24 hours * 8 days)
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 8
    REFRESH_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 30
    RATE_LIMIT_PER_MINUTE: int = 60
    REDIS_URL: str | None = None
    CORS_ORIGINS: str | None = None
    AUTO_CREATE_TABLES: bool = True

    NUDITY_PROVIDER: str = "nudenet"
    NUDITY_MIN_CONFIDENCE: float = 0.35

    SENTRY_DSN: str | None = None
    SENTRY_ENVIRONMENT: str = "production"
    SENTRY_TRACES_SAMPLE_RATE: float = 0.05
    
    PROJECT_NAME: str = "splendoura"
    ADMIN_EMAIL: str | None = None
    ADMIN_USERNAME: str | None = None
    ADMIN_PASSWORD: str | None = None

    model_config = SettingsConfigDict(
        case_sensitive=True,
        env_file=os.getenv("ENV_FILE", ".env"),
        env_file_encoding="utf-8",
        extra="ignore",
    )

settings = Settings()
