# backend/app/api/v1/endpoints/auth.py
from datetime import datetime, timedelta, timezone
from hashlib import sha256
from secrets import randbelow
from typing import Any
from fastapi import APIRouter, BackgroundTasks, Body, Depends, HTTPException, Request, Response, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from jose import JWTError

from app import crud, schemas, models
from app.api import deps
from app.core import security, email as email_utils
from app.core.config import settings
from app.core.request_meta import get_client_ip
from app.models.auth_session import UserRefreshSession

router = APIRouter()


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _revoke_session_chain(
    *,
    db: Session,
    user_id: int,
    start_session_id: str | None,
    now: datetime,
) -> None:
    current_id = start_session_id
    seen: set[str] = set()
    while current_id and current_id not in seen:
        seen.add(current_id)
        session = (
            db.query(UserRefreshSession)
            .filter(
                UserRefreshSession.id == current_id,
                UserRefreshSession.user_id == user_id,
            )
            .first()
        )
        if not session:
            break
        if session.revoked_at is None:
            session.revoked_at = now
            db.add(session)
        current_id = session.replaced_by_session_id


def _enforce_active_session_limit(*, db: Session, user_id: int, now: datetime) -> None:
    max_sessions = max(1, settings.MAX_ACTIVE_SESSIONS_PER_USER)
    active_sessions = (
        db.query(UserRefreshSession)
        .filter(
            UserRefreshSession.user_id == user_id,
            UserRefreshSession.revoked_at.is_(None),
            UserRefreshSession.expires_at > now,
        )
        .order_by(UserRefreshSession.created_at.desc())
        .all()
    )
    for stale_session in active_sessions[max_sessions:]:
        stale_session.revoked_at = now
        db.add(stale_session)


def _cookie_secure() -> bool:
    if settings.AUTH_COOKIE_SECURE is not None:
        return settings.AUTH_COOKIE_SECURE
    return settings.FRONTEND_BASE_URL.startswith("https://")


def _set_auth_cookies(response: Response, access_token: str, refresh_token: str) -> None:
    secure = _cookie_secure()
    same_site = (settings.AUTH_COOKIE_SAMESITE or "lax").lower()
    access_max_age = max(60, settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60)
    refresh_max_age = max(60, settings.REFRESH_TOKEN_EXPIRE_MINUTES * 60)
    response.set_cookie(
        key=settings.AUTH_ACCESS_COOKIE_NAME,
        value=access_token,
        max_age=access_max_age,
        httponly=True,
        secure=secure,
        samesite=same_site,
        path="/",
    )
    response.set_cookie(
        key=settings.AUTH_REFRESH_COOKIE_NAME,
        value=refresh_token,
        max_age=refresh_max_age,
        httponly=True,
        secure=secure,
        samesite=same_site,
        path=settings.AUTH_REFRESH_COOKIE_PATH or "/",
    )


def _clear_auth_cookies(response: Response) -> None:
    secure = _cookie_secure()
    same_site = (settings.AUTH_COOKIE_SAMESITE or "lax").lower()
    response.delete_cookie(
        key=settings.AUTH_ACCESS_COOKIE_NAME,
        path="/",
        httponly=True,
        secure=secure,
        samesite=same_site,
    )
    response.delete_cookie(
        key=settings.AUTH_REFRESH_COOKIE_NAME,
        path=settings.AUTH_REFRESH_COOKIE_PATH or "/",
        httponly=True,
        secure=secure,
        samesite=same_site,
    )


def _issue_session_tokens(
    *,
    db: Session,
    user: models.User,
    user_agent: str | None,
    ip_address: str | None,
) -> tuple[str, str]:
    now = _utcnow()
    access_token_expires = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    refresh_token_expires = timedelta(minutes=settings.REFRESH_TOKEN_EXPIRE_MINUTES)
    refresh_expires_at = now + refresh_token_expires

    session_id = security.create_token_id()
    refresh_token = security.create_refresh_token(
        user.id,
        session_id=session_id,
        expires_delta=refresh_token_expires,
    )
    refresh_session = UserRefreshSession(
        id=session_id,
        user_id=user.id,
        token_hash=security.hash_token(refresh_token),
        expires_at=refresh_expires_at,
        user_agent=(user_agent or "")[:512] or None,
        ip_address=(ip_address or "")[:64] or None,
    )
    db.add(refresh_session)
    _enforce_active_session_limit(db=db, user_id=user.id, now=now)
    db.commit()

    access_token = security.create_access_token(
        user.id,
        session_id=session_id,
        expires_delta=access_token_expires,
    )
    return access_token, refresh_token


def _extract_refresh_token(
    request: Request,
    token_in: schemas.RefreshTokenRequest | None,
) -> str | None:
    if token_in and token_in.refresh_token:
        return token_in.refresh_token
    return request.cookies.get(settings.AUTH_REFRESH_COOKIE_NAME)

@router.post("/register", response_model=schemas.User, dependencies=[Depends(deps.rate_limit)])
def register_user(
    *,
    db: Session = Depends(deps.get_db),
    user_in: schemas.UserCreate
) -> Any:
    """Register a new user."""
    user = crud.user.get_by_email(db, email=user_in.email)
    if user:
        raise HTTPException(
            status_code=400,
            detail="The user with this email already exists in the system.",
        )
    return crud.user.create(db, obj_in=user_in)

@router.post("/login", response_model=schemas.Token, dependencies=[Depends(deps.rate_limit)])
def login_access_token(
    request: Request,
    response: Response,
    db: Session = Depends(deps.get_db),
    form_data: OAuth2PasswordRequestForm = Depends(),
) -> Any:
    """OAuth2 compatible token login, get an access token for future requests."""
    # 1. Authenticate the user
    user = crud.user.authenticate(
        db, email=form_data.username, password=form_data.password
    )
    if not user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Incorrect email or password"
        )
    user.last_active_at = datetime.utcnow()
    db.add(user)
    db.commit()
    request.state.user_id = user.id

    access_token, refresh_token = _issue_session_tokens(
        db=db,
        user=user,
        user_agent=request.headers.get("user-agent"),
        ip_address=get_client_ip(request),
    )
    _set_auth_cookies(response, access_token, refresh_token)
    return {
        "access_token": access_token,
        "refresh_token": refresh_token,
        "token_type": "bearer",
    }

@router.post("/forgot-password", dependencies=[Depends(deps.rate_limit)])
def forgot_password(
    payload: schemas.PasswordResetRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(deps.get_db),
) -> Any:
    """Generate a password reset token and send a reset email."""
    user = crud.user.get_by_email(db, email=payload.email)
    reset_token = None

    if user:
        reset_token = str(randbelow(1_000_000)).zfill(6)
        user.password_reset_token_hash = sha256(reset_token.encode("utf-8")).hexdigest()
        user.password_reset_expires_at = datetime.now(timezone.utc) + timedelta(
            minutes=settings.RESET_TOKEN_EXPIRE_MINUTES
        )
        db.add(user)
        db.commit()

        reset_link = (
            f"{settings.FRONTEND_BASE_URL.rstrip('/')}/auth/reset"
        )
        background_tasks.add_task(
            email_utils.send_password_reset_email, user.email, reset_link, reset_token
        )

    response: dict[str, Any] = {
        "detail": "If an account exists, a reset link has been sent."
    }
    if settings.RESET_TOKEN_DEBUG and reset_token:
        response["reset_token"] = reset_token
    return response

@router.post("/reset-password", dependencies=[Depends(deps.rate_limit)])
def reset_password(
    payload: schemas.PasswordResetConfirm,
    db: Session = Depends(deps.get_db),
) -> Any:
    """Reset a user's password using a valid token."""
    if not payload.token.isdigit():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Reset code must be numeric.",
        )
    token_hash = sha256(payload.token.encode("utf-8")).hexdigest()
    now = datetime.now(timezone.utc)
    user = (
        db.query(models.User)
        .filter(models.User.password_reset_token_hash == token_hash)
        .filter(models.User.password_reset_expires_at.is_not(None))
        .filter(models.User.password_reset_expires_at > now)
        .first()
    )
    if not user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Reset token is invalid or expired.",
        )

    user.hashed_password = security.get_password_hash(payload.new_password)
    user.password_reset_token_hash = None
    user.password_reset_expires_at = None
    now = _utcnow()
    (
        db.query(UserRefreshSession)
        .filter(
            UserRefreshSession.user_id == user.id,
            UserRefreshSession.revoked_at.is_(None),
        )
        .update({UserRefreshSession.revoked_at: now}, synchronize_session=False)
    )
    db.add(user)
    db.commit()
    return {"detail": "Password updated successfully."}

@router.post("/refresh", response_model=schemas.Token, dependencies=[Depends(deps.rate_limit)])
def refresh_access_token(
    *,
    db: Session = Depends(deps.get_db),
    request: Request,
    response: Response,
    token_in: schemas.RefreshTokenRequest | None = Body(default=None),
) -> Any:
    """Refresh access token."""
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
    )
    raw_refresh_token = _extract_refresh_token(request, token_in)
    if not raw_refresh_token:
        raise credentials_exception
    try:
        payload = security.decode_token(raw_refresh_token, expected_type="refresh")
        user_id = payload.get("sub")
        session_id = payload.get("sid")
        if not user_id:
            raise credentials_exception
        if not session_id:
            raise credentials_exception
    except JWTError:
        raise credentials_exception

    now = _utcnow()
    try:
        user_id_int = int(user_id)
    except ValueError:
        raise credentials_exception
    current_session = (
        db.query(UserRefreshSession)
        .filter(
            UserRefreshSession.id == session_id,
            UserRefreshSession.user_id == user_id_int,
        )
        .first()
    )
    if not current_session:
        raise credentials_exception
    hashed_refresh = security.hash_token(raw_refresh_token)
    if current_session.token_hash != hashed_refresh:
        current_session.revoked_at = now
        db.add(current_session)
        db.commit()
        raise credentials_exception
    if current_session.revoked_at is not None:
        _revoke_session_chain(
            db=db,
            user_id=user_id_int,
            start_session_id=current_session.replaced_by_session_id,
            now=now,
        )
        db.commit()
        raise credentials_exception
    if current_session.expires_at <= now:
        current_session.revoked_at = now
        db.add(current_session)
        db.commit()
        raise credentials_exception

    user = crud.user.get(db, id=user_id_int)
    if not user:
        raise credentials_exception
    request.state.user_id = user_id_int

    refresh_token_expires = timedelta(minutes=settings.REFRESH_TOKEN_EXPIRE_MINUTES)
    new_session_id = security.create_token_id()
    new_refresh_expires_at = now + refresh_token_expires
    new_refresh_token = security.create_refresh_token(
        user_id_int,
        session_id=new_session_id,
        expires_delta=refresh_token_expires,
    )
    new_session = UserRefreshSession(
        id=new_session_id,
        user_id=user_id_int,
        token_hash=security.hash_token(new_refresh_token),
        expires_at=new_refresh_expires_at,
        user_agent=(request.headers.get("user-agent") or "")[:512] or None,
        ip_address=(get_client_ip(request) or "")[:64] or None,
    )
    current_session.last_used_at = now
    current_session.revoked_at = now
    current_session.replaced_by_session_id = new_session_id
    db.add(current_session)
    db.add(new_session)
    _enforce_active_session_limit(db=db, user_id=user_id_int, now=now)
    db.commit()

    access_token_expires = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    new_access_token = security.create_access_token(
        user_id_int,
        session_id=new_session_id,
        expires_delta=access_token_expires,
    )
    _set_auth_cookies(response, new_access_token, new_refresh_token)
    return {
        "access_token": new_access_token,
        "refresh_token": new_refresh_token,
        "token_type": "bearer",
    }


@router.post("/logout", dependencies=[Depends(deps.rate_limit)])
def logout(
    *,
    db: Session = Depends(deps.get_db),
    request: Request,
    response: Response,
    current_user: models.User = Depends(deps.get_current_user),
) -> Any:
    now = _utcnow()
    access_cookie = request.cookies.get(settings.AUTH_ACCESS_COOKIE_NAME)
    bearer_token = None
    auth_header = request.headers.get("authorization") or ""
    if auth_header.lower().startswith("bearer "):
        bearer_token = auth_header.split(" ", 1)[1].strip()
    candidate_tokens = [token for token in [bearer_token, access_cookie] if token]
    revoked = 0
    for token in candidate_tokens:
        try:
            payload = security.decode_token(token, expected_type="access")
        except JWTError:
            continue
        session_id = payload.get("sid")
        if not session_id:
            continue
        updated = (
            db.query(UserRefreshSession)
            .filter(
                UserRefreshSession.id == session_id,
                UserRefreshSession.user_id == current_user.id,
                UserRefreshSession.revoked_at.is_(None),
            )
            .update({UserRefreshSession.revoked_at: now}, synchronize_session=False)
        )
        revoked += int(updated or 0)

    refresh_token = request.cookies.get(settings.AUTH_REFRESH_COOKIE_NAME)
    if refresh_token:
        try:
            payload = security.decode_token(refresh_token, expected_type="refresh")
            session_id = payload.get("sid")
            if session_id:
                updated = (
                    db.query(UserRefreshSession)
                    .filter(
                        UserRefreshSession.id == session_id,
                        UserRefreshSession.user_id == current_user.id,
                        UserRefreshSession.revoked_at.is_(None),
                    )
                    .update({UserRefreshSession.revoked_at: now}, synchronize_session=False)
                )
                revoked += int(updated or 0)
        except JWTError:
            pass

    db.commit()
    _clear_auth_cookies(response)
    return {"detail": "Logged out", "revoked_sessions": revoked}


@router.post("/logout-all", dependencies=[Depends(deps.rate_limit)])
def logout_all(
    *,
    db: Session = Depends(deps.get_db),
    response: Response,
    current_user: models.User = Depends(deps.get_current_user),
) -> Any:
    now = _utcnow()
    revoked = (
        db.query(UserRefreshSession)
        .filter(
            UserRefreshSession.user_id == current_user.id,
            UserRefreshSession.revoked_at.is_(None),
        )
        .update({UserRefreshSession.revoked_at: now}, synchronize_session=False)
    )
    db.commit()
    _clear_auth_cookies(response)
    return {"detail": "Logged out from all sessions", "revoked_sessions": int(revoked or 0)}

@router.post("/test-token", response_model=schemas.User)
def test_token(current_user: models.User = Depends(deps.get_current_user)) -> Any:
    """Test access token."""
    return current_user
