# backend/app/core/security.py
from datetime import datetime, timedelta, timezone
import hashlib
import secrets
from typing import Any, Union
from jose import jwt, JWTError
from passlib.context import CryptContext
from app.core.config import settings

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

ALGORITHM = settings.ALGORITHM
REFRESH_ALGORITHM = settings.ALGORITHM

def create_access_token(
    subject: Union[str, Any],
    *,
    session_id: str,
    expires_delta: timedelta = None,
) -> str:
    now = datetime.now(timezone.utc)
    if expires_delta:
        expire = now + expires_delta
    else:
        expire = now + timedelta(
            minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES
        )
    to_encode = {
        "exp": expire,
        "iat": now,
        "nbf": now,
        "iss": settings.JWT_ISSUER,
        "aud": settings.JWT_AUDIENCE,
        "sub": str(subject),
        "sid": session_id,
        "type": "access",
        "jti": create_token_id(),
    }
    encoded_jwt = jwt.encode(to_encode, settings.SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

def create_refresh_token(
    subject: Union[str, Any],
    *,
    session_id: str,
    expires_delta: timedelta = None,
) -> str:
    now = datetime.now(timezone.utc)
    if expires_delta:
        expire = now + expires_delta
    else:
        expire = now + timedelta(
            minutes=settings.REFRESH_TOKEN_EXPIRE_MINUTES
        )
    to_encode = {
        "exp": expire,
        "iat": now,
        "nbf": now,
        "iss": settings.JWT_ISSUER,
        "aud": settings.JWT_AUDIENCE,
        "sub": str(subject),
        "sid": session_id,
        "type": "refresh",
        "jti": create_token_id(),
    }
    return jwt.encode(to_encode, settings.SECRET_KEY, algorithm=REFRESH_ALGORITHM)


def decode_token(token: str, *, expected_type: str | None = None) -> dict[str, Any]:
    payload = jwt.decode(
        token,
        settings.SECRET_KEY,
        algorithms=[settings.ALGORITHM],
        audience=settings.JWT_AUDIENCE,
        issuer=settings.JWT_ISSUER,
    )
    token_type = payload.get("type")
    if expected_type and token_type != expected_type:
        raise JWTError("Unexpected token type")
    return payload


def create_token_id() -> str:
    return secrets.token_hex(32)


def hash_token(raw_token: str) -> str:
    return hashlib.sha256(raw_token.encode("utf-8")).hexdigest()

def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)

def get_password_hash(password: str) -> str:
    return pwd_context.hash(password)
