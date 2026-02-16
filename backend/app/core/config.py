import os
from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    API_V1_STR: str = "/api/v1"
    DATABASE_URL: str
    # Must be overridden in production.
    SECRET_KEY: str = Field(default="change-me-in-production", validation_alias="JWT_SECRET")
    ALGORITHM: str = "HS256"
    JWT_ISSUER: str = "splendoure-api"
    JWT_AUDIENCE: str = "splendoure-clients"
    # Token expiry defaults (short-lived access + rotating refresh)
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 15
    REFRESH_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 30
    MAX_ACTIVE_SESSIONS_PER_USER: int = 10
    REQUIRE_STRONG_SECRET_KEY: bool = True
    AUTH_ACCESS_COOKIE_NAME: str = "spl_access"
    AUTH_REFRESH_COOKIE_NAME: str = "spl_refresh"
    AUTH_COOKIE_SECURE: bool | None = None
    AUTH_COOKIE_SAMESITE: str = "lax"
    AUTH_REFRESH_COOKIE_PATH: str = "/api/v1/auth"
    RESET_TOKEN_EXPIRE_MINUTES: int = 30
    RATE_LIMIT_PER_MINUTE: int = 60
    REDIS_URL: str | None = None
    CORS_ORIGINS: str | None = None
    AUTO_CREATE_TABLES: bool = True
    REQUIRE_VERIFICATION: bool = False

    NUDITY_PROVIDER: str = "nudenet"
    NUDITY_MIN_CONFIDENCE: float = 0.35

    SUPABASE_URL: str | None = None
    SUPABASE_SERVICE_ROLE_KEY: str | None = None
    SUPABASE_STORAGE_BUCKET: str | None = None
    SUPABASE_STORAGE_PUBLIC: bool = True
    SUPABASE_SIGNED_URL_EXPIRE_SECONDS: int = 3600
    SUPABASE_PUBLIC_STORAGE_BUCKET: str | None = None
    SUPABASE_PUBLIC_STORAGE_CACHE_CONTROL: str = "public, max-age=31536000, immutable"
    SUPABASE_PUBLIC_THUMBNAIL_MAX_SIZE: int = 720

    SENTRY_DSN: str | None = None
    SENTRY_ENVIRONMENT: str = "production"
    SENTRY_TRACES_SAMPLE_RATE: float = 0.05
    
    PROJECT_NAME: str = "splendoura"
    ADMIN_EMAIL: str | None = None
    ADMIN_USERNAME: str | None = None
    ADMIN_PASSWORD: str | None = None
    RESET_TOKEN_DEBUG: bool = False

    FRONTEND_BASE_URL: str = "http://localhost:3000"
    SMTP_HOST: str | None = None
    SMTP_PORT: int = 587
    SMTP_USERNAME: str | None = None
    SMTP_PASSWORD: str | None = None
    SMTP_USE_TLS: bool = True
    SMTP_USE_SSL: bool = False
    SMTP_FROM: str = "support@splendoure.com"

    model_config = SettingsConfigDict(
        case_sensitive=True,
        env_file=os.getenv("ENV_FILE", ".env"),
        env_file_encoding="utf-8",
        extra="ignore",
    )

settings = Settings()
