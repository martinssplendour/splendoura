from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
import os
from sqlalchemy import text
from datetime import datetime
import sentry_sdk
from sentry_sdk.integrations.starlette import StarletteIntegration
from app.api.v1.api import api_router
from app.core.config import settings
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
)

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
    if settings.ADMIN_EMAIL and settings.ADMIN_PASSWORD and settings.ADMIN_USERNAME:
        db = SessionLocal()
        try:
            email_user = db.query(User).filter(User.email == settings.ADMIN_EMAIL).first()
            username_user = db.query(User).filter(User.username == settings.ADMIN_USERNAME).first()
            user = email_user or username_user

            if user:
                user.role = UserRole.ADMIN
                user.verification_status = VerificationStatus.VERIFIED
                user.verified_at = datetime.utcnow()
                if not user.username and settings.ADMIN_USERNAME:
                    # Only set if empty to avoid unique conflicts.
                    user.username = settings.ADMIN_USERNAME
                db.add(user)
                db.commit()
            else:
                # Avoid crashing startup if username already exists with another account.
                existing_username = (
                    db.query(User).filter(User.username == settings.ADMIN_USERNAME).first()
                )
                if existing_username:
                    print(
                        "[ADMIN] Username already exists; skipping admin bootstrap."
                    )
                else:
                    user = User(
                        email=settings.ADMIN_EMAIL,
                        username=settings.ADMIN_USERNAME,
                        hashed_password=get_password_hash(settings.ADMIN_PASSWORD),
                        full_name="admin",
                        age=30,
                        gender=Gender.OTHER,
                        verification_status=VerificationStatus.VERIFIED,
                        verified_at=datetime.utcnow(),
                        role=UserRole.ADMIN,
                    )
                    db.add(user)
                    db.commit()
        finally:
            db.close()

@app.get("/")
def root():
    return {"message": "SocialSync API is running", "docs": "/docs"}
