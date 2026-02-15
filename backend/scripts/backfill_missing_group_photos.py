import argparse
import io
from typing import Iterable

from PIL import Image, ImageDraw, ImageFont
from sqlalchemy import and_, exists

from app import models
from app.core.storage import (
    supabase_public_storage_enabled,
    supabase_storage_enabled,
    upload_bytes_to_supabase,
    upload_public_image_with_thumbnail,
)
from app.db.session import SessionLocal
from app.models.group_extras import GroupMediaType
from app.models.media import MediaBlob


PLACEHOLDER_TEXT = "No group photo at the moment."
TARGET_SIZE = 1024


def _load_font(size: int) -> ImageFont.ImageFont:
    for name in ("DejaVuSans-Bold.ttf", "DejaVuSans.ttf", "arial.ttf"):
        try:
            return ImageFont.truetype(name, size=size)
        except Exception:
            continue
    return ImageFont.load_default()


def _wrap_text(text: str, *, max_chars: int) -> str:
    words = text.split()
    lines: list[str] = []
    current: list[str] = []
    for word in words:
        candidate = (" ".join(current + [word])).strip()
        if len(candidate) <= max_chars or not current:
            current.append(word)
            continue
        lines.append(" ".join(current))
        current = [word]
    if current:
        lines.append(" ".join(current))
    return "\n".join(lines)


def build_placeholder_jpeg_bytes(*, text: str = PLACEHOLDER_TEXT, size: int = TARGET_SIZE) -> bytes:
    background = (245, 247, 250)
    foreground = (51, 65, 85)
    border = (226, 232, 240)

    image = Image.new("RGB", (size, size), background)
    draw = ImageDraw.Draw(image)

    margin = int(size * 0.08)
    draw.rounded_rectangle(
        (margin, margin, size - margin, size - margin),
        radius=int(size * 0.04),
        outline=border,
        width=4,
    )

    wrapped = _wrap_text(text, max_chars=22)

    # Pick a font size that fits.
    font_size = int(size * 0.07)
    for candidate in range(font_size, 18, -2):
        font = _load_font(candidate)
        bbox = draw.multiline_textbbox((0, 0), wrapped, font=font, align="center", spacing=10)
        w = bbox[2] - bbox[0]
        h = bbox[3] - bbox[1]
        if w <= size - 2 * margin and h <= size - 2 * margin:
            font_size = candidate
            break

    font = _load_font(font_size)
    bbox = draw.multiline_textbbox((0, 0), wrapped, font=font, align="center", spacing=10)
    text_w = bbox[2] - bbox[0]
    text_h = bbox[3] - bbox[1]
    x = (size - text_w) / 2
    y = (size - text_h) / 2
    draw.multiline_text((x, y), wrapped, font=font, fill=foreground, align="center", spacing=10)

    out = io.BytesIO()
    image.save(out, format="JPEG", quality=88, optimize=True)
    return out.getvalue()


def iter_groups_missing_photos(db, *, limit: int | None = None) -> Iterable[models.Group]:
    has_image = exists().where(
        and_(
            models.GroupMedia.group_id == models.Group.id,
            models.GroupMedia.deleted_at.is_(None),
            models.GroupMedia.media_type == GroupMediaType.IMAGE,
        )
    )
    query = (
        db.query(models.Group)
        .filter(
            models.Group.deleted_at.is_(None),
            ~has_image,
        )
        .order_by(models.Group.id.asc())
    )
    if limit:
        query = query.limit(limit)
    return query.all()


def backfill_group_cover(db, *, group: models.Group, jpeg_bytes: bytes) -> None:
    db.query(models.GroupMedia).filter(
        models.GroupMedia.group_id == group.id,
        models.GroupMedia.is_cover.is_(True),
        models.GroupMedia.deleted_at.is_(None),
    ).update({models.GroupMedia.is_cover: False})

    filename = "no-group-photo.jpg"
    content_type = "image/jpeg"
    thumb_url = None

    if supabase_public_storage_enabled():
        url, thumb_url = upload_public_image_with_thumbnail(
            prefix=f"groups/{group.id}",
            filename=filename,
            content_type=content_type,
            data=jpeg_bytes,
        )
    elif supabase_storage_enabled():
        url = upload_bytes_to_supabase(
            prefix=f"groups/{group.id}",
            filename=filename,
            content_type=content_type,
            data=jpeg_bytes,
            public=False,
        )
    else:
        blob = MediaBlob(
            content_type=content_type,
            filename=filename,
            data=jpeg_bytes,
            created_by=group.creator_id,
        )
        db.add(blob)
        db.flush()
        url = f"/api/v1/media/{blob.id}"

    db.add(
        models.GroupMedia(
            group_id=group.id,
            uploader_id=group.creator_id,
            url=url,
            thumb_url=thumb_url,
            media_type=GroupMediaType.IMAGE,
            is_cover=True,
        )
    )


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Backfill missing group cover photos with a 1024x1024 placeholder image."
    )
    parser.add_argument("--dry-run", action="store_true", help="List groups that would be updated.")
    parser.add_argument("--limit", type=int, default=0, help="Limit number of groups processed.")
    args = parser.parse_args()

    limit = args.limit or None
    placeholder = build_placeholder_jpeg_bytes()

    db = SessionLocal()
    try:
        groups = iter_groups_missing_photos(db, limit=limit)
        if args.dry_run:
            print(f"Found {len(groups)} group(s) missing photos.")
            for group in groups:
                print(f"- group_id={group.id} title={group.title!r} creator_id={group.creator_id}")
            return 0

        updated = 0
        for group in groups:
            try:
                backfill_group_cover(db, group=group, jpeg_bytes=placeholder)
                db.commit()
                updated += 1
                print(f"Updated group_id={group.id}")
            except Exception as exc:
                db.rollback()
                print(f"FAILED group_id={group.id}: {exc}")

        print(f"Done. Updated {updated}/{len(groups)} group(s).")
        return 0
    finally:
        db.close()


if __name__ == "__main__":
    raise SystemExit(main())
