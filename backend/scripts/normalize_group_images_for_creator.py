from __future__ import annotations

import argparse
import io
import mimetypes
import os
from pathlib import Path
from urllib.parse import quote, unquote, urlparse

import httpx
from PIL import Image
from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.storage import (
    normalize_group_image_bytes,
    supabase_public_storage_enabled,
    supabase_storage_enabled,
    upload_bytes_to_supabase,
    upload_public_image_with_thumbnail,
)
from app.db.session import SessionLocal
from app.models.group import Group
from app.models.group_extras import GroupMedia, GroupMediaType
from app.models.media import MediaBlob
from app.models.user import User


UPLOADS_ROOT = Path(__file__).resolve().parents[1] / "uploads"


def _guess_content_type(filename: str | None, fallback: str = "application/octet-stream") -> str:
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


def _private_bucket() -> str:
    return settings.SUPABASE_STORAGE_BUCKET or ""


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
        response = client.get(url, headers=_supabase_headers())
        response.raise_for_status()
        content_type = response.headers.get("content-type") or _guess_content_type(key)
        filename = os.path.basename(key) or "group-image"
        return response.content, content_type, filename


def _download_http_url(url: str) -> tuple[bytes, str, str]:
    with httpx.Client(timeout=60, follow_redirects=True) as client:
        response = client.get(url)
        response.raise_for_status()
        content_type = response.headers.get("content-type") or _guess_content_type(url)
        filename = os.path.basename(urlparse(url).path) or "group-image"
        return response.content, content_type, filename


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
        path = _resolve_upload_path(url)
        if not path.exists():
            return None
        return path.read_bytes(), _guess_content_type(path.name), path.name

    supabase_obj = _parse_supabase_object(url)
    if supabase_obj:
        bucket, key = supabase_obj
        if not bucket or not key:
            return None
        return _download_supabase_object(bucket, key)

    if url.startswith("http://") or url.startswith("https://"):
        return _download_http_url(url)
    return None


def _resolve_creator(session: Session, creator_id: int | None, username: str | None) -> User:
    if creator_id and username:
        raise SystemExit("Use either --creator-id or --creator-username, not both.")
    if not creator_id and not username:
        raise SystemExit("Provide --creator-id or --creator-username.")

    user = None
    if creator_id:
        user = session.query(User).filter(User.id == creator_id, User.deleted_at.is_(None)).first()
    else:
        user = (
            session.query(User)
            .filter(User.username == username, User.deleted_at.is_(None))
            .first()
        )
    if not user:
        raise SystemExit("Creator not found.")
    return user


def _normalized_filename(source_name: str | None, media_id: int) -> str:
    base = os.path.splitext(source_name or "")[0] or f"group-image-{media_id}"
    return f"{base}.jpg"


def _image_dimensions(image_bytes: bytes) -> tuple[int, int] | None:
    try:
        with Image.open(io.BytesIO(image_bytes)) as image:
            width, height = image.size
            if width <= 0 or height <= 0:
                return None
            return width, height
    except Exception:
        return None


def normalize_group_images(
    session: Session,
    *,
    creator_id: int | None = None,
    cover_only: bool = False,
    dry_run: bool = False,
    limit: int | None = None,
    target_size: int = 1024,
) -> dict[str, int]:
    query = (
        session.query(GroupMedia)
        .join(Group, Group.id == GroupMedia.group_id)
        .filter(
            Group.deleted_at.is_(None),
            GroupMedia.deleted_at.is_(None),
            or_(
                GroupMedia.media_type == GroupMediaType.IMAGE,
                GroupMedia.media_type == GroupMediaType.IMAGE.value,
            ),
        )
        .order_by(GroupMedia.group_id.asc(), GroupMedia.created_at.asc())
    )
    if creator_id is not None:
        query = query.filter(Group.creator_id == creator_id)
    if cover_only:
        query = query.filter(GroupMedia.is_cover.is_(True))
    if limit and limit > 0:
        query = query.limit(limit)
    items = query.all()

    stats = {
        "found": len(items),
        "updated": 0,
        "already_correct": 0,
        "skipped_download": 0,
        "skipped_invalid": 0,
        "failed_upload": 0,
    }
    if not items:
        return stats

    for item in items:
        downloaded = _download_bytes(session, item.url)
        if not downloaded:
            stats["skipped_download"] += 1
            print(f"[WARN] media={item.id} group={item.group_id} could not download source.")
            continue
        source_bytes, _source_type, source_name = downloaded
        size = _image_dimensions(source_bytes)
        if not size:
            stats["skipped_invalid"] += 1
            print(f"[WARN] media={item.id} group={item.group_id} invalid image bytes.")
            continue
        width, height = size
        if width == target_size and height == target_size:
            stats["already_correct"] += 1
            continue

        try:
            normalized_bytes, normalized_type = normalize_group_image_bytes(
                source_bytes,
                target_size=target_size,
            )
        except ValueError:
            stats["skipped_invalid"] += 1
            print(f"[WARN] media={item.id} group={item.group_id} invalid image bytes.")
            continue

        if dry_run:
            print(
                f"[DRY-RUN] media={item.id} group={item.group_id} "
                f"would be normalized ({width}x{height} -> {target_size}x{target_size})."
            )
            stats["updated"] += 1
            continue

        upload_name = _normalized_filename(source_name, item.id)
        prefix = f"groups/{item.group_id}"
        try:
            if supabase_public_storage_enabled():
                new_url, new_thumb_url = upload_public_image_with_thumbnail(
                    prefix=prefix,
                    filename=upload_name,
                    content_type=normalized_type,
                    data=normalized_bytes,
                )
            elif supabase_storage_enabled():
                new_url = upload_bytes_to_supabase(
                    prefix=prefix,
                    filename=upload_name,
                    content_type=normalized_type,
                    data=normalized_bytes,
                    public=False,
                )
                new_thumb_url = None
            else:
                blob = MediaBlob(
                    content_type=normalized_type,
                    filename=upload_name,
                    data=normalized_bytes,
                    created_by=item.uploader_id,
                )
                session.add(blob)
                session.flush()
                new_url = f"/api/v1/media/{blob.id}"
                new_thumb_url = None
        except Exception as exc:
            stats["failed_upload"] += 1
            print(f"[WARN] media={item.id} group={item.group_id} upload failed: {exc}")
            continue

        item.url = new_url
        item.thumb_url = new_thumb_url
        session.add(item)
        stats["updated"] += 1
        print(
            f"[OK] media={item.id} group={item.group_id} normalized "
            f"({width}x{height} -> {target_size}x{target_size})."
        )

    if not dry_run and stats["updated"] > 0:
        session.commit()
    return stats


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Normalize existing group image media to 1024x1024."
    )
    parser.add_argument("--creator-id", type=int, default=None, help="Creator user ID.")
    parser.add_argument(
        "--creator-username",
        type=str,
        default=None,
        help="Creator username.",
    )
    parser.add_argument(
        "--all-creators",
        action="store_true",
        help="Process images for every creator.",
    )
    parser.add_argument(
        "--cover-only",
        action="store_true",
        help="Only process cover images.",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Preview changes without writing anything.",
    )
    parser.add_argument(
        "--limit",
        type=int,
        default=None,
        help="Optional cap on number of images to process.",
    )
    parser.add_argument(
        "--target-size",
        type=int,
        default=1024,
        help="Expected square size in pixels.",
    )
    args = parser.parse_args()

    session = SessionLocal()
    try:
        creator_id: int | None = None
        if args.all_creators:
            if args.creator_id or args.creator_username:
                raise SystemExit("Use --all-creators by itself (without creator filters).")
            print(
                f"Target: all creators, cover_only={args.cover_only}, dry_run={args.dry_run}, "
                f"target_size={args.target_size}"
            )
        else:
            creator = _resolve_creator(session, args.creator_id, args.creator_username)
            creator_id = creator.id
            print(
                f"Target creator: id={creator.id}, username={creator.username or '<none>'}, "
                f"cover_only={args.cover_only}, dry_run={args.dry_run}, target_size={args.target_size}"
            )

        stats = normalize_group_images(
            session,
            creator_id=creator_id,
            cover_only=args.cover_only,
            dry_run=args.dry_run,
            limit=args.limit,
            target_size=args.target_size,
        )
        print(
            "Done.",
            f"found={stats['found']}",
            f"updated={stats['updated']}",
            f"already_correct={stats['already_correct']}",
            f"skipped_download={stats['skipped_download']}",
            f"skipped_invalid={stats['skipped_invalid']}",
            f"failed_upload={stats['failed_upload']}",
        )
    finally:
        session.close()


if __name__ == "__main__":
    main()
