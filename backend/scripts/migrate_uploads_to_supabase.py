from __future__ import annotations

import mimetypes
import os
from pathlib import Path
from typing import Any

from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.storage import supabase_storage_enabled, upload_bytes_to_supabase
from app.db.session import SessionLocal
from app.models.group import Group
from app.models.group_extras import GroupMedia
from app.models.media import MediaBlob
from app.models.message import GroupMessage
from app.models.user import User


UPLOADS_ROOT = Path(__file__).resolve().parents[1] / "uploads"


def guess_content_type(filename: str | None, fallback: str = "application/octet-stream") -> str:
    if not filename:
        return fallback
    guessed, _ = mimetypes.guess_type(filename)
    return guessed or fallback


def resolve_upload_path(url: str) -> Path:
    relative = url.replace("/uploads/", "", 1).lstrip("/")
    return UPLOADS_ROOT / relative


def migrate_url(
    session: Session,
    url: str,
    prefix: str,
    cache: dict[str, str],
) -> str:
    if not url:
        return url
    if url.startswith("http://") or url.startswith("https://"):
        return url
    if url in cache:
        return cache[url]

    if url.startswith("/uploads/"):
        file_path = resolve_upload_path(url)
        if not file_path.exists():
            print(f"[WARN] Missing file for {url} -> {file_path}")
            return url
        data = file_path.read_bytes()
        content_type = guess_content_type(file_path.name)
        new_url = upload_bytes_to_supabase(
            prefix=prefix,
            filename=file_path.name,
            content_type=content_type,
            data=data,
        )
        cache[url] = new_url
        return new_url

    if url.startswith("/api/v1/media/"):
        try:
            blob_id = int(url.split("/api/v1/media/")[1])
        except (ValueError, IndexError):
            return url
        blob = session.query(MediaBlob).filter(MediaBlob.id == blob_id).first()
        if not blob:
            print(f"[WARN] Missing MediaBlob {blob_id} for {url}")
            return url
        new_url = upload_bytes_to_supabase(
            prefix=prefix,
            filename=blob.filename,
            content_type=blob.content_type,
            data=bytes(blob.data),
        )
        cache[url] = new_url
        return new_url

    return url


def update_json_urls(
    session: Session,
    value: Any,
    prefix: str,
    cache: dict[str, str],
) -> tuple[Any, bool]:
    if isinstance(value, str):
        new_value = migrate_url(session, value, prefix, cache)
        return new_value, new_value != value
    if isinstance(value, list):
        changed = False
        new_list = []
        for item in value:
            new_item, item_changed = update_json_urls(session, item, prefix, cache)
            new_list.append(new_item)
            changed = changed or item_changed
        return new_list, changed
    if isinstance(value, dict):
        changed = False
        new_dict: dict[str, Any] = {}
        for key, item in value.items():
            new_item, item_changed = update_json_urls(session, item, prefix, cache)
            new_dict[key] = new_item
            changed = changed or item_changed
        return new_dict, changed
    return value, False


def migrate_users(session: Session, cache: dict[str, str]) -> int:
    updated = 0
    users = session.query(User).filter(User.deleted_at.is_(None)).all()
    for user in users:
        changed = False
        prefix = f"users/{user.id}"
        if user.profile_image_url:
            new_url = migrate_url(session, user.profile_image_url, prefix, cache)
            if new_url != user.profile_image_url:
                user.profile_image_url = new_url
                changed = True
        if user.profile_video_url:
            new_url = migrate_url(session, user.profile_video_url, prefix, cache)
            if new_url != user.profile_video_url:
                user.profile_video_url = new_url
                changed = True
        if user.profile_media:
            new_media, media_changed = update_json_urls(
                session, user.profile_media, prefix, cache
            )
            if media_changed:
                user.profile_media = new_media
                changed = True
        if user.profile_details:
            new_details, details_changed = update_json_urls(
                session, user.profile_details, prefix, cache
            )
            if details_changed:
                user.profile_details = new_details
                changed = True
        if changed:
            session.add(user)
            updated += 1
    if updated:
        session.commit()
    return updated


def migrate_groups(session: Session, cache: dict[str, str]) -> int:
    updated = 0
    groups = session.query(Group).filter(Group.deleted_at.is_(None)).all()
    for group in groups:
        changed = False
        prefix = f"groups/{group.id}"
        if group.creator_intro_video_url:
            new_url = migrate_url(session, group.creator_intro_video_url, prefix, cache)
            if new_url != group.creator_intro_video_url:
                group.creator_intro_video_url = new_url
                changed = True
        if changed:
            session.add(group)
            updated += 1
    if updated:
        session.commit()
    return updated


def migrate_group_media(session: Session, cache: dict[str, str]) -> int:
    updated = 0
    items = session.query(GroupMedia).filter(GroupMedia.deleted_at.is_(None)).all()
    for item in items:
        prefix = f"groups/{item.group_id}"
        new_url = migrate_url(session, item.url, prefix, cache)
        if new_url != item.url:
            item.url = new_url
            session.add(item)
            updated += 1
    if updated:
        session.commit()
    return updated


def migrate_messages(session: Session, cache: dict[str, str]) -> int:
    updated = 0
    messages = session.query(GroupMessage).filter(GroupMessage.deleted_at.is_(None)).all()
    for message in messages:
        if not message.attachment_url:
            continue
        prefix = f"messages/{message.group_id}"
        new_url = migrate_url(session, message.attachment_url, prefix, cache)
        if new_url != message.attachment_url:
            message.attachment_url = new_url
            session.add(message)
            updated += 1
    if updated:
        session.commit()
    return updated


def main() -> None:
    if not supabase_storage_enabled():
        raise SystemExit(
            "Supabase storage is not configured. Set SUPABASE_URL, "
            "SUPABASE_SERVICE_ROLE_KEY, and SUPABASE_STORAGE_BUCKET."
        )
    if not UPLOADS_ROOT.exists():
        print(f"[WARN] uploads directory not found at {UPLOADS_ROOT}")

    print("Starting uploads migration...")
    session = SessionLocal()
    cache: dict[str, str] = {}
    try:
        users_updated = migrate_users(session, cache)
        groups_updated = migrate_groups(session, cache)
        media_updated = migrate_group_media(session, cache)
        messages_updated = migrate_messages(session, cache)
        print(
            "Migration complete. Updated:",
            f"users={users_updated}, groups={groups_updated},",
            f"group_media={media_updated}, messages={messages_updated}",
        )
    finally:
        session.close()


if __name__ == "__main__":
    main()
