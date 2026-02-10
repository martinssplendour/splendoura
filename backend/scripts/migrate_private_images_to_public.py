from __future__ import annotations

import io
import mimetypes
import os
from pathlib import Path
from typing import Any
from urllib.parse import unquote, urlparse, quote

import httpx
from PIL import Image
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.storage import (
    supabase_public_storage_enabled,
    upload_public_bytes_to_supabase,
    upload_public_image_with_thumbnail,
)
from app.db.session import SessionLocal
from app.models.group_extras import GroupMedia, GroupMediaType
from app.models.media import MediaBlob
from app.models.user import User


UPLOADS_ROOT = Path(__file__).resolve().parents[1] / "uploads"


def guess_content_type(filename: str | None, fallback: str = "application/octet-stream") -> str:
    if not filename:
        return fallback
    guessed, _ = mimetypes.guess_type(filename)
    return guessed or fallback


def _supabase_headers() -> dict[str, str]:
    service_key = settings.SUPABASE_SERVICE_ROLE_KEY or ""
    return {
        "Authorization": f"Bearer {service_key}",
        "apikey": service_key,
    }


def _supabase_base_url() -> str:
    return (settings.SUPABASE_URL or "").rstrip("/")


def _public_bucket() -> str:
    return settings.SUPABASE_PUBLIC_STORAGE_BUCKET or ""


def _private_bucket() -> str:
    return settings.SUPABASE_STORAGE_BUCKET or ""


def _is_public_bucket_url(url: str) -> bool:
    base = _supabase_base_url()
    bucket = _public_bucket()
    if not base or not bucket:
        return False
    return url.startswith(f"{base}/storage/v1/object/public/{bucket}/")


def _resolve_upload_path(url: str) -> Path:
    relative = url.replace("/uploads/", "", 1).lstrip("/")
    return UPLOADS_ROOT / relative


def _parse_supabase_object(url: str) -> tuple[str, str] | None:
    base = _supabase_base_url()
    if not base:
        return None
    if url.startswith("/api/v1/storage/"):
        key = unquote(url.split("/api/v1/storage/", 1)[1])
        bucket = _private_bucket()
        return (bucket, key) if bucket else None

    if not url.startswith("http://") and not url.startswith("https://"):
        return None

    parsed = urlparse(url)
    if not parsed.path:
        return None

    prefixes = [
        "/storage/v1/object/public/",
        "/storage/v1/object/sign/",
        "/storage/v1/object/",
    ]
    for prefix in prefixes:
        if parsed.path.startswith(prefix):
            rest = parsed.path[len(prefix):]
            bucket, _, key = rest.partition("/")
            if not bucket or not key:
                return None
            return bucket, unquote(key)
    return None


def _download_supabase_object(bucket: str, key: str) -> tuple[bytes, str, str]:
    base = _supabase_base_url()
    encoded_key = quote(key, safe="/")
    url = f"{base}/storage/v1/object/{bucket}/{encoded_key}"
    with httpx.Client(timeout=60) as client:
        res = client.get(url, headers=_supabase_headers())
        res.raise_for_status()
        content_type = res.headers.get("content-type") or guess_content_type(key)
        filename = os.path.basename(key)
        return res.content, content_type, filename


def _download_http_url(url: str) -> tuple[bytes, str, str]:
    with httpx.Client(timeout=60, follow_redirects=True) as client:
        res = client.get(url)
        res.raise_for_status()
        content_type = res.headers.get("content-type") or guess_content_type(url)
        filename = os.path.basename(urlparse(url).path) or "file"
        return res.content, content_type, filename


def _download_bytes(session: Session, url: str) -> tuple[bytes, str, str] | None:
    if not url:
        return None
    if url.startswith("/api/v1/media/"):
        try:
            blob_id = int(url.split("/api/v1/media/", 1)[1])
        except (ValueError, IndexError):
            return None
        blob = session.query(MediaBlob).filter(MediaBlob.id == blob_id).first()
        if not blob:
            return None
        filename = blob.filename or f"{blob_id}.bin"
        return bytes(blob.data), blob.content_type, filename
    if url.startswith("/uploads/"):
        file_path = _resolve_upload_path(url)
        if not file_path.exists():
            return None
        data = file_path.read_bytes()
        return data, guess_content_type(file_path.name), file_path.name

    supabase_obj = _parse_supabase_object(url)
    if supabase_obj:
        bucket, key = supabase_obj
        if not bucket or not key:
            return None
        return _download_supabase_object(bucket, key)

    if url.startswith("http://") or url.startswith("https://"):
        return _download_http_url(url)

    return None


def _create_thumbnail_bytes(image_bytes: bytes, *, max_size: int) -> bytes | None:
    try:
        with Image.open(io.BytesIO(image_bytes)) as image:
            image = image.convert("RGB")
            image.thumbnail((max_size, max_size), Image.LANCZOS)
            out = io.BytesIO()
            image.save(out, format="JPEG", quality=82, optimize=True)
            return out.getvalue()
    except Exception:
        return None


def ensure_public_image(
    session: Session,
    url: str,
    prefix: str,
    cache: dict[str, tuple[str, str | None]],
    existing_thumb: str | None = None,
) -> tuple[str, str | None, bool]:
    if not url:
        return url, existing_thumb, False
    if url in cache:
        cached_url, cached_thumb = cache[url]
        return cached_url, cached_thumb, cached_url != url

    if _is_public_bucket_url(url):
        if existing_thumb and _is_public_bucket_url(existing_thumb):
            cache[url] = (url, existing_thumb)
            return url, existing_thumb, False
        download = _download_bytes(session, url)
        if not download:
            cache[url] = (url, existing_thumb)
            return url, existing_thumb, False
        data, _, _ = download
        thumb_bytes = _create_thumbnail_bytes(
            data,
            max_size=settings.SUPABASE_PUBLIC_THUMBNAIL_MAX_SIZE,
        )
        if not thumb_bytes:
            cache[url] = (url, existing_thumb)
            return url, existing_thumb, False
        thumb_url = upload_public_bytes_to_supabase(
            prefix=f"{prefix}/thumbs",
            filename="thumb.jpg",
            content_type="image/jpeg",
            data=thumb_bytes,
        )
        cache[url] = (url, thumb_url)
        return url, thumb_url, True

    download = _download_bytes(session, url)
    if not download:
        return url, existing_thumb, False
    data, content_type, filename = download
    new_url, thumb_url = upload_public_image_with_thumbnail(
        prefix=prefix,
        filename=filename,
        content_type=content_type,
        data=data,
    )
    cache[url] = (new_url, thumb_url)
    return new_url, thumb_url, True


def ensure_public_file(
    session: Session,
    url: str,
    prefix: str,
    cache: dict[str, str],
) -> tuple[str, bool]:
    if not url:
        return url, False
    if url in cache:
        return cache[url], cache[url] != url
    if _is_public_bucket_url(url):
        cache[url] = url
        return url, False
    download = _download_bytes(session, url)
    if not download:
        return url, False
    data, content_type, filename = download
    new_url = upload_public_bytes_to_supabase(
        prefix=prefix,
        filename=filename,
        content_type=content_type,
        data=data,
    )
    cache[url] = new_url
    return new_url, True


def migrate_users(session: Session) -> int:
    updated = 0
    cache: dict[str, tuple[str, str | None]] = {}
    users = session.query(User).filter(User.deleted_at.is_(None)).all()
    for user in users:
        changed = False
        prefix = f"users/{user.id}"
        media = user.profile_media or {}
        photos_raw = media.get("photos") or []
        photos = [photo for photo in photos_raw if isinstance(photo, str)]
        photo_thumbs_existing = media.get("photo_thumbs")
        if not isinstance(photo_thumbs_existing, dict):
            photo_thumbs_existing = {}
        new_photos: list[str] = []
        new_thumbs: dict[str, str] = {}
        for photo in photos:
            new_url, thumb_url, _ = ensure_public_image(
                session,
                photo,
                prefix,
                cache,
                existing_thumb=photo_thumbs_existing.get(photo),
            )
            new_photos.append(new_url)
            if thumb_url:
                new_thumbs[new_url] = thumb_url

        if user.profile_image_url:
            new_profile_url, profile_thumb, _ = ensure_public_image(
                session,
                user.profile_image_url,
                prefix,
                cache,
                existing_thumb=media.get("profile_image_thumb_url"),
            )
            if new_profile_url != user.profile_image_url:
                user.profile_image_url = new_profile_url
                changed = True
            if profile_thumb:
                media["profile_image_thumb_url"] = profile_thumb
                changed = True
            else:
                if "profile_image_thumb_url" in media:
                    media.pop("profile_image_thumb_url", None)
                    changed = True

        if photos:
            if new_photos != photos:
                media["photos"] = new_photos
                changed = True
            if new_thumbs:
                media["photo_thumbs"] = new_thumbs
                changed = True
            elif "photo_thumbs" in media:
                media.pop("photo_thumbs", None)
                changed = True

        if changed:
            user.profile_media = media
            session.add(user)
            updated += 1

    if updated:
        session.commit()
    return updated


def migrate_group_media(session: Session) -> int:
    updated = 0
    image_cache: dict[str, tuple[str, str | None]] = {}
    file_cache: dict[str, str] = {}
    items = session.query(GroupMedia).filter(GroupMedia.deleted_at.is_(None)).all()
    for item in items:
        prefix = f"groups/{item.group_id}"
        if item.media_type == GroupMediaType.IMAGE or item.media_type == GroupMediaType.IMAGE.value:
            new_url, thumb_url, changed = ensure_public_image(
                session,
                item.url,
                prefix,
                image_cache,
                existing_thumb=item.thumb_url,
            )
            if changed or thumb_url != item.thumb_url:
                item.url = new_url
                item.thumb_url = thumb_url
                session.add(item)
                updated += 1
        else:
            new_url, changed = ensure_public_file(session, item.url, prefix, file_cache)
            if changed:
                item.url = new_url
                session.add(item)
                updated += 1

    if updated:
        session.commit()
    return updated


def main() -> None:
    if not supabase_public_storage_enabled():
        raise SystemExit(
            "Public Supabase storage is not configured. "
            "Set SUPABASE_PUBLIC_STORAGE_BUCKET, SUPABASE_URL, and SUPABASE_SERVICE_ROLE_KEY."
        )
    if not UPLOADS_ROOT.exists():
        print(f"[WARN] uploads directory not found at {UPLOADS_ROOT}")

    print("Starting public media migration...")
    session = SessionLocal()
    try:
        users_updated = migrate_users(session)
        media_updated = migrate_group_media(session)
        print(
            "Migration complete. Updated:",
            f"users={users_updated}, group_media={media_updated}",
        )
    finally:
        session.close()


if __name__ == "__main__":
    main()
