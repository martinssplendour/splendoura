from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
import os
from sqlalchemy import text
import sentry_sdk
from sentry_sdk.integrations.starlette import StarletteIntegration
from app.api.v1.api import api_router
from app.core.config import settings
from app.core.observability import register_observability
from app.core.security import get_password_hash
from app.db.session import engine
from app.db.session import SessionLocal
from app.models import base
from app.models.user import Gender, User, UserRole, VerificationStatus

# Initialize Sentry only when a DSN is provided.
if settings.SENTRY_DSN:
    sentry_sdk.init(
        dsn=settings.SENTRY_DSN,
        environment=settings.SENTRY_ENVIRONMENT,
        traces_sample_rate=settings.SENTRY_TRACES_SAMPLE_RATE,
        integrations=[StarletteIntegration()],
    )

# Create database tables on startup (disable in production if using Alembic)
if settings.AUTO_CREATE_TABLES:
    base.Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="SocialSync API",
    description="Backend for the social activity platform",
    version="1.0.0"
)
register_observability(app)

# CRITICAL: Configure CORS so your Next.js frontend (localhost:3000) 
# can make requests to this FastAPI server (localhost:8000)
origins = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://172.29.176.1:3000",
    "http://localhost:5004",
    "http://127.0.0.1:5004",
    "https://splendouraweb.onrender.com",
    "https://splendoura.onrender.com",
    "https://splendoure.com",
    "https://www.splendoure.com",
]
if settings.CORS_ORIGINS:
    extra_origins = [origin.strip() for origin in settings.CORS_ORIGINS.split(",") if origin.strip()]
    origins.extend(extra_origins)


app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["X-Next-Cursor", "X-Request-ID"],
)

if settings.REQUIRE_STRONG_SECRET_KEY:
    secret = settings.SECRET_KEY or ""
    if secret == "change-me-in-production" or len(secret) < 32:
        raise RuntimeError("JWT_SECRET must be set to a strong value (at least 32 chars).")

# Serve uploaded profile images
os.makedirs("uploads", exist_ok=True)
app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")

# Include all our API routes
app.include_router(api_router, prefix="/api/v1")

@app.on_event("startup")
def check_database_connection() -> None:
    try:
        with engine.connect() as connection:
            connection.execute(text("SELECT 1"))
        print("Database connection OK")
    except Exception as exc:
        print(f"Database connection failed: {exc}")

@app.get("/")
def root():
    return {"message": "SocialSync API is running", "docs": "/docs"}
