import io
import mimetypes
import os
import uuid
from urllib.parse import quote

import httpx
from PIL import Image

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
    if signed_path.startswith("/object/"):
        signed_path = f"/storage/v1{signed_path}"
    elif signed_path.startswith("/storage/") and not signed_path.startswith("/storage/v1/"):
        signed_path = f"/storage/v1{signed_path[len('/storage'):]}"
    return f"{base_url}{signed_path}"


def supabase_storage_enabled() -> bool:
    return bool(
        settings.SUPABASE_URL
        and settings.SUPABASE_SERVICE_ROLE_KEY
        and settings.SUPABASE_STORAGE_BUCKET
    )


def supabase_public_storage_enabled() -> bool:
    return bool(
        settings.SUPABASE_URL
        and settings.SUPABASE_SERVICE_ROLE_KEY
        and settings.SUPABASE_PUBLIC_STORAGE_BUCKET
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
    bucket: str | None = None,
    public: bool | None = None,
    cache_control: str | None = None,
) -> str:
    if not (settings.SUPABASE_URL and settings.SUPABASE_SERVICE_ROLE_KEY):
        raise RuntimeError("Supabase storage is not configured.")
    base_url = (settings.SUPABASE_URL or "").rstrip("/")
    bucket = bucket or settings.SUPABASE_STORAGE_BUCKET or ""
    if not bucket:
        raise RuntimeError("Supabase storage bucket is not configured.")
    ext = _guess_extension(filename, content_type)
    object_key = f"{prefix}/{uuid.uuid4().hex}{ext}" if prefix else f"{uuid.uuid4().hex}{ext}"
    encoded_key = quote(object_key, safe="/")
    upload_url = f"{base_url}/storage/v1/object/{bucket}/{encoded_key}"

    headers = {
        **_supabase_headers(),
        "Content-Type": content_type or "application/octet-stream",
        "x-upsert": "true",
    }
    if cache_control:
        headers["cache-control"] = cache_control

    with httpx.Client(timeout=60) as client:
        response = client.post(upload_url, content=data, headers=headers)
        if response.status_code >= 400:
            response = client.put(upload_url, content=data, headers=headers)
        if response.status_code >= 400:
            raise RuntimeError(f"Supabase upload failed: {response.status_code} {response.text}")

    is_public = settings.SUPABASE_STORAGE_PUBLIC if public is None else public
    if is_public:
        return f"{base_url}/storage/v1/object/public/{bucket}/{encoded_key}"
    return f"/api/v1/storage/{encoded_key}"


def _create_thumbnail_bytes(image_bytes: bytes, *, max_size: int) -> tuple[bytes, str] | None:
    try:
        with Image.open(io.BytesIO(image_bytes)) as image:
            image = image.convert("RGB")
            image.thumbnail((max_size, max_size), Image.LANCZOS)
            out = io.BytesIO()
            image.save(out, format="JPEG", quality=82, optimize=True)
            return out.getvalue(), "image/jpeg"
    except Exception:
        return None


def upload_public_image_with_thumbnail(
    *,
    prefix: str,
    filename: str | None,
    content_type: str | None,
    data: bytes,
) -> tuple[str, str | None]:
    if not supabase_public_storage_enabled():
        raise RuntimeError("Supabase public storage bucket is not configured.")
    bucket = settings.SUPABASE_PUBLIC_STORAGE_BUCKET or ""
    cache_control = settings.SUPABASE_PUBLIC_STORAGE_CACHE_CONTROL
    full_url = upload_bytes_to_supabase(
        prefix=prefix,
        filename=filename,
        content_type=content_type,
        data=data,
        bucket=bucket,
        public=True,
        cache_control=cache_control,
    )
    thumb = _create_thumbnail_bytes(
        data,
        max_size=settings.SUPABASE_PUBLIC_THUMBNAIL_MAX_SIZE,
    )
    if not thumb:
        return full_url, None
    thumb_bytes, thumb_type = thumb
    thumb_prefix = f"{prefix}/thumbs" if prefix else "thumbs"
    thumb_url = upload_bytes_to_supabase(
        prefix=thumb_prefix,
        filename="thumb.jpg",
        content_type=thumb_type,
        data=thumb_bytes,
        bucket=bucket,
        public=True,
        cache_control=cache_control,
    )
    return full_url, thumb_url


def upload_public_bytes_to_supabase(
    *,
    prefix: str,
    filename: str | None,
    content_type: str | None,
    data: bytes,
) -> str:
    if not supabase_public_storage_enabled():
        raise RuntimeError("Supabase public storage bucket is not configured.")
    bucket = settings.SUPABASE_PUBLIC_STORAGE_BUCKET or ""
    cache_control = settings.SUPABASE_PUBLIC_STORAGE_CACHE_CONTROL
    return upload_bytes_to_supabase(
        prefix=prefix,
        filename=filename,
        content_type=content_type,
        data=data,
        bucket=bucket,
        public=True,
        cache_control=cache_control,
    )
