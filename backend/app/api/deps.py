from typing import Dict, Generator
import time
from datetime import datetime, timezone
from fastapi import Depends, HTTPException, Request, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError
from sqlalchemy.orm import Session

from app.db.session import SessionLocal
from sqlalchemy import text
from app.core.config import settings
from app.core import security
from app.models.auth_session import UserRefreshSession
from app.models.user import User, VerificationStatus, UserRole
from app import crud

# This tells FastAPI where to look for the token to login
oauth2_scheme = OAuth2PasswordBearer(
    tokenUrl=f"{settings.API_V1_STR}/auth/login",
    auto_error=False,
)

_rate_limit_bucket: Dict[str, list[float]] = {}

def rate_limit(request: Request) -> None:
    key = f"{request.client.host}:{request.url.path}"
    now = time.time()
    window_seconds = 60
    limit = settings.RATE_LIMIT_PER_MINUTE
    timestamps = _rate_limit_bucket.get(key, [])
    timestamps = [t for t in timestamps if now - t < window_seconds]
    if len(timestamps) >= limit:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Rate limit exceeded. Please try again later.",
        )
    timestamps.append(now)
    _rate_limit_bucket[key] = timestamps

def get_db() -> Generator:
    try:
        db = SessionLocal()
        try:
            db.execute(text("SET statement_timeout = 5000"))
        except Exception:
            pass
        yield db
    finally:
        db.close()

def get_current_user(
    request: Request,
    db: Session = Depends(get_db),
    token: str | None = Depends(oauth2_scheme),
) -> User:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    resolved_token = token
    if not resolved_token:
        resolved_token = request.cookies.get(settings.AUTH_ACCESS_COOKIE_NAME)
    if not resolved_token:
        raise credentials_exception
    try:
        payload = security.decode_token(resolved_token, expected_type="access")
        user_id: str = payload.get("sub")
        session_id: str | None = payload.get("sid")
        if user_id is None:
            raise credentials_exception
        if not session_id:
            raise credentials_exception
    except JWTError:
        raise credentials_exception
    try:
        user_id_int = int(user_id)
    except ValueError:
        raise credentials_exception

    session = (
        db.query(UserRefreshSession)
        .filter(
            UserRefreshSession.id == session_id,
            UserRefreshSession.user_id == user_id_int,
            UserRefreshSession.revoked_at.is_(None),
            UserRefreshSession.expires_at > datetime.now(timezone.utc),
        )
        .first()
    )
    if not session:
        raise credentials_exception

    user = crud.user.get(db, id=user_id_int)
    if not user:
        raise credentials_exception
    user.last_active_at = datetime.utcnow()
    db.add(user)
    db.commit()
    return user


def get_current_user_id(
    request: Request,
    db: Session = Depends(get_db),
    token: str | None = Depends(oauth2_scheme),
) -> int:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    resolved_token = token or request.cookies.get(settings.AUTH_ACCESS_COOKIE_NAME)
    if not resolved_token:
        raise credentials_exception
    try:
        payload = security.decode_token(resolved_token, expected_type="access")
        user_id: str | None = payload.get("sub")
        session_id: str | None = payload.get("sid")
        if user_id is None:
            raise credentials_exception
        if not session_id:
            raise credentials_exception
        user_id_int = int(user_id)
        session = (
            db.query(UserRefreshSession)
            .filter(
                UserRefreshSession.id == session_id,
                UserRefreshSession.user_id == user_id_int,
                UserRefreshSession.revoked_at.is_(None),
                UserRefreshSession.expires_at > datetime.now(timezone.utc),
            )
            .first()
        )
        if not session:
            raise credentials_exception
        return user_id_int
    except (JWTError, ValueError):
        raise credentials_exception

def get_current_active_user(
    current_user: User = Depends(get_current_user),
) -> User:
    return current_user

def get_current_verified_user(
    current_user: User = Depends(get_current_user),
) -> User:
    if not settings.REQUIRE_VERIFICATION:
        return current_user
    if current_user.verification_status != VerificationStatus.VERIFIED:
        raise HTTPException(status_code=403, detail="User must be verified")
    return current_user

def get_current_admin_user(
    current_user: User = Depends(get_current_verified_user),
) -> User:
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Admin access required")
    return current_user
