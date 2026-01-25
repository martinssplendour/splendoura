# backend/app/api/v1/endpoints/auth.py
from datetime import datetime, timedelta
from typing import Any
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from jose import JWTError, jwt

from app import crud, schemas, models
from app.api import deps
from app.core import security
from app.core.config import settings

router = APIRouter()

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
    db: Session = Depends(deps.get_db), 
    form_data: OAuth2PasswordRequestForm = Depends()
) -> Any:
    """OAuth2 compatible token login, get an access token for future requests."""
    print(f"[AUTH] Login attempt for {form_data.username}")
    # 1. Authenticate the user
    user = crud.user.authenticate(
        db, email=form_data.username, password=form_data.password
    )
    print("[AUTH] Login lookup complete")
    if not user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Incorrect email or password"
        )
    user.last_active_at = datetime.utcnow()
    db.add(user)
    db.commit()

    # 2. Generate the JWT token
    access_token_expires = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    refresh_token_expires = timedelta(minutes=settings.REFRESH_TOKEN_EXPIRE_MINUTES)
    return {
        "access_token": security.create_access_token(
            user.id, expires_delta=access_token_expires
        ),
        "refresh_token": security.create_refresh_token(
            user.id, expires_delta=refresh_token_expires
        ),
        "token_type": "bearer",
    }

@router.post("/refresh", response_model=schemas.Token, dependencies=[Depends(deps.rate_limit)])
def refresh_access_token(
    *,
    token_in: schemas.RefreshTokenRequest,
) -> Any:
    """Refresh access token."""
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
    )
    try:
        payload = jwt.decode(
            token_in.refresh_token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM]
        )
        if payload.get("type") != "refresh":
            raise credentials_exception
        user_id = payload.get("sub")
        if not user_id:
            raise credentials_exception
    except JWTError:
        raise credentials_exception

    access_token_expires = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    refresh_token_expires = timedelta(minutes=settings.REFRESH_TOKEN_EXPIRE_MINUTES)
    return {
        "access_token": security.create_access_token(
            user_id, expires_delta=access_token_expires
        ),
        "refresh_token": security.create_refresh_token(
            user_id, expires_delta=refresh_token_expires
        ),
        "token_type": "bearer",
    }

@router.post("/test-token", response_model=schemas.User)
def test_token(current_user: models.User = Depends(deps.get_current_user)) -> Any:
    """Test access token."""
    return current_user
