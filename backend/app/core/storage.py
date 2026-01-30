import mimetypes
import os
import uuid
from urllib.parse import quote

import httpx

from app.core.config import settings


def _supabase_headers() -> dict[str, str]:
    service_key = settings.SUPABASE_SERVICE_ROLE_KEY or ""
    return {
        "Authorization": f"Bearer {service_key}",
        "apikey": service_key,
    }


def build_public_url(object_key: str) -> str:
    base_url = (settings.SUPABASE_URL or "").rstrip("/")
    bucket = settings.SUPABASE_STORAGE_BUCKET or ""
    encoded_key = quote(object_key, safe="/")
    return f"{base_url}/storage/v1/object/public/{bucket}/{encoded_key}"


def create_signed_url(object_key: str, *, expires_in: int | None = None) -> str:
    if not supabase_storage_enabled():
        raise RuntimeError("Supabase storage is not configured.")
    base_url = (settings.SUPABASE_URL or "").rstrip("/")
    bucket = settings.SUPABASE_STORAGE_BUCKET or ""
    encoded_key = quote(object_key, safe="/")
    sign_url = f"{base_url}/storage/v1/object/sign/{bucket}/{encoded_key}"
    payload = {"expiresIn": expires_in or settings.SUPABASE_SIGNED_URL_EXPIRE_SECONDS}

    with httpx.Client(timeout=20) as client:
        response = client.post(sign_url, json=payload, headers=_supabase_headers())
        if response.status_code >= 400:
            raise RuntimeError(f"Supabase sign failed: {response.status_code} {response.text}")
        data = response.json()

    signed_path = data.get("signedURL") or data.get("signedUrl") or ""
    if not signed_path:
        raise RuntimeError("Supabase sign failed: missing signed URL")
    if signed_path.startswith("http://") or signed_path.startswith("https://"):
        return signed_path
    return f"{base_url}{signed_path}"


def supabase_storage_enabled() -> bool:
    return bool(
        settings.SUPABASE_URL
        and settings.SUPABASE_SERVICE_ROLE_KEY
        and settings.SUPABASE_STORAGE_BUCKET
    )


def _guess_extension(filename: str | None, content_type: str | None) -> str:
    ext = os.path.splitext(filename or "")[1]
    if ext:
        return ext if ext.startswith(".") else f".{ext}"
    guessed = mimetypes.guess_extension(content_type or "")
    return guessed or ""


def upload_bytes_to_supabase(
    *,
    prefix: str,
    filename: str | None,
    content_type: str | None,
    data: bytes,
) -> str:
    if not supabase_storage_enabled():
        raise RuntimeError("Supabase storage is not configured.")
    base_url = (settings.SUPABASE_URL or "").rstrip("/")
    bucket = settings.SUPABASE_STORAGE_BUCKET or ""
    ext = _guess_extension(filename, content_type)
    object_key = f"{prefix}/{uuid.uuid4().hex}{ext}" if prefix else f"{uuid.uuid4().hex}{ext}"
    encoded_key = quote(object_key, safe="/")
    upload_url = f"{base_url}/storage/v1/object/{bucket}/{encoded_key}"

    headers = {
        **_supabase_headers(),
        "Content-Type": content_type or "application/octet-stream",
        "x-upsert": "true",
    }

    with httpx.Client(timeout=60) as client:
        response = client.post(upload_url, content=data, headers=headers)
        if response.status_code >= 400:
            response = client.put(upload_url, content=data, headers=headers)
        if response.status_code >= 400:
            raise RuntimeError(f"Supabase upload failed: {response.status_code} {response.text}")

    if settings.SUPABASE_STORAGE_PUBLIC:
        return f"{base_url}/storage/v1/object/public/{bucket}/{encoded_key}"
    return f"/api/v1/storage/{encoded_key}"
