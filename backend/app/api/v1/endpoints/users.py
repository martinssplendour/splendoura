# backend/app/api/v1/endpoints/users.py
from datetime import datetime, timezone
from uuid import uuid4
from typing import Any, List
from fastapi import APIRouter, Body, Depends, File, HTTPException, UploadFile, status
from sqlalchemy.orm import Session
from sqlalchemy import func
from pydantic import BaseModel

from app import crud, models, schemas
from app.api import deps
from app.models.group import GroupStatus
from app.models.group_extras import GroupMedia
from app.models.media import MediaBlob
from app.models.membership import JoinStatus
from app.models.user import VerificationStatus
from app.models.message import GroupMessageRead
from app.core.storage import supabase_storage_enabled, upload_bytes_to_supabase

router = APIRouter()


class PhotoRemove(BaseModel):
    url: str

def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _coerce_aware(value: datetime | None) -> datetime | None:
    if value is None:
        return None
    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)
    return value


def _apply_group_lifecycle(group: models.Group, approved_count: int) -> None:
    end_date = _coerce_aware(group.end_date)
    if end_date and end_date < _utcnow():
        group.status = GroupStatus.COMPLETED
        return
    if group.max_participants and approved_count >= group.max_participants:
        group.status = GroupStatus.FULL

@router.post("/", response_model=schemas.User, dependencies=[Depends(deps.rate_limit)])
def create_user(
    *,
    db: Session = Depends(deps.get_db),
    user_in: schemas.UserCreate
) -> Any:
    """Create a new user (Registration)."""
    user = crud.user.get_by_email(db, email=user_in.email)
    if user:
        raise HTTPException(
            status_code=400,
            detail="The user with this email already exists in the system.",
        )
    return crud.user.create(db, obj_in=user_in)

@router.get("/me", response_model=schemas.User)
def read_user_me(
    current_user: models.User = Depends(deps.get_current_user),
) -> Any:
    """Get current logged-in user details."""
    return current_user


@router.post("/me/push-token", dependencies=[Depends(deps.rate_limit)])
def register_push_token(
    *,
    db: Session = Depends(deps.get_db),
    payload: schemas.PushTokenCreate,
    current_user: models.User = Depends(deps.get_current_user),
) -> Any:
    token = payload.token.strip()
    if not token:
        raise HTTPException(status_code=400, detail="Push token is required.")
    existing = (
        db.query(models.UserPushToken)
        .filter(models.UserPushToken.token == token)
        .first()
    )
    if existing:
        existing.user_id = current_user.id
        existing.platform = payload.platform
        db.add(existing)
    else:
        db.add(
            models.UserPushToken(
                user_id=current_user.id,
                token=token,
                platform=payload.platform,
            )
        )
    db.commit()
    return {"msg": "Push token saved"}

@router.get("/me/groups", response_model=List[schemas.Group])
def list_my_groups(
    *,
    db: Session = Depends(deps.get_db),
    current_user: models.User = Depends(deps.get_current_user),
) -> Any:
    groups = (
        db.query(models.Group)
        .join(models.Membership, models.Membership.group_id == models.Group.id)
        .filter(
            models.Membership.user_id == current_user.id,
            models.Membership.join_status == JoinStatus.APPROVED,
            models.Membership.deleted_at.is_(None),
            models.Group.deleted_at.is_(None),
        )
        .all()
    )
    for group in groups:
        approved_count = (
            db.query(models.Membership)
            .filter(
                models.Membership.group_id == group.id,
                models.Membership.join_status == JoinStatus.APPROVED,
                models.Membership.deleted_at.is_(None),
            )
            .count()
        )
        _apply_group_lifecycle(group, approved_count)
        group.approved_members = approved_count
        cover = db.query(GroupMedia).filter(
            GroupMedia.group_id == group.id,
            GroupMedia.is_cover.is_(True),
            GroupMedia.deleted_at.is_(None),
        ).first()
        if not cover:
            cover = db.query(GroupMedia).filter(
                GroupMedia.group_id == group.id,
                GroupMedia.deleted_at.is_(None),
            ).first()
        group.cover_image_url = cover.url if cover else None
    return groups


@router.get("/me/inbox", response_model=List[schemas.InboxThread])
def list_my_inbox(
    *,
    db: Session = Depends(deps.get_db),
    current_user: models.User = Depends(deps.get_current_user),
) -> Any:
    groups = (
        db.query(models.Group)
        .join(models.Membership, models.Membership.group_id == models.Group.id)
        .filter(
            models.Membership.user_id == current_user.id,
            models.Membership.join_status == JoinStatus.APPROVED,
            models.Membership.deleted_at.is_(None),
            models.Group.deleted_at.is_(None),
        )
        .all()
    )
    if not groups:
        return []

    group_ids = [group.id for group in groups]

    covers = (
        db.query(GroupMedia)
        .filter(
            GroupMedia.group_id.in_(group_ids),
            GroupMedia.deleted_at.is_(None),
        )
        .order_by(
            GroupMedia.group_id.asc(),
            GroupMedia.is_cover.desc(),
            GroupMedia.created_at.desc(),
        )
        .all()
    )
    cover_map: dict[int, str] = {}
    for cover in covers:
        if cover.group_id not in cover_map:
            cover_map[cover.group_id] = cover.url

    messages = (
        db.query(models.GroupMessage)
        .filter(
            models.GroupMessage.group_id.in_(group_ids),
            models.GroupMessage.deleted_at.is_(None),
        )
        .order_by(
            models.GroupMessage.group_id.asc(),
            models.GroupMessage.created_at.desc(),
            models.GroupMessage.id.desc(),
        )
        .all()
    )
    last_message_map: dict[int, models.GroupMessage] = {}
    for message in messages:
        if message.group_id not in last_message_map:
            last_message_map[message.group_id] = message

    unread_rows = (
        db.query(models.GroupMessage.group_id, func.count(models.GroupMessage.id))
        .outerjoin(
            GroupMessageRead,
            (GroupMessageRead.message_id == models.GroupMessage.id)
            & (GroupMessageRead.user_id == current_user.id),
        )
        .filter(
            models.GroupMessage.group_id.in_(group_ids),
            models.GroupMessage.deleted_at.is_(None),
            models.GroupMessage.sender_id != current_user.id,
            GroupMessageRead.id.is_(None),
        )
        .group_by(models.GroupMessage.group_id)
        .all()
    )
    unread_map = {group_id: count for group_id, count in unread_rows}

    items: list[schemas.InboxThread] = []
    for group in groups:
        last_message = last_message_map.get(group.id)
        last_message_at = (
            last_message.created_at
            if last_message
            else group.updated_at or group.created_at
        )
        items.append(
            schemas.InboxThread(
                group_id=group.id,
                title=group.title,
                cover_image_url=cover_map.get(group.id),
                last_message=last_message,
                last_message_at=last_message_at,
                unread_count=unread_map.get(group.id, 0),
                updated_at=group.updated_at,
                created_at=group.created_at,
            )
        )

    items.sort(
        key=lambda item: item.last_message_at or item.updated_at or item.created_at or _utcnow(),
        reverse=True,
    )
    return items

@router.post("/me/photo", response_model=schemas.User, dependencies=[Depends(deps.rate_limit)])
def upload_profile_photo(
    *,
    db: Session = Depends(deps.get_db),
    file: UploadFile = File(...),
    current_user: models.User = Depends(deps.get_current_user),
) -> Any:
    """Upload a profile image for the current user."""
    if not file.content_type or not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="Only image uploads are allowed.")

    file_bytes = file.file.read()
    if supabase_storage_enabled():
        photo_url = upload_bytes_to_supabase(
            prefix=f"users/{current_user.id}",
            filename=file.filename,
            content_type=file.content_type,
            data=file_bytes,
        )
    else:
        blob = MediaBlob(
            content_type=file.content_type or "image/jpeg",
            filename=file.filename,
            data=file_bytes,
            created_by=current_user.id,
        )
        db.add(blob)
        db.flush()
        photo_url = f"/api/v1/media/{blob.id}"
    current_user.profile_image_url = current_user.profile_image_url or photo_url
    media = current_user.profile_media or {}
    photos = media.get("photos") or []
    if len(photos) >= 9:
        raise HTTPException(status_code=400, detail="You can upload up to 9 photos.")
    photos.append(photo_url)
    media["photos"] = photos
    current_user.profile_media = media
    if current_user.verification_status != VerificationStatus.VERIFIED:
        current_user.verification_status = VerificationStatus.PENDING
        current_user.verification_requested_at = datetime.utcnow()
    db.add(current_user)
    db.commit()
    db.refresh(current_user)
    return current_user


@router.delete("/me/photo", response_model=schemas.User, dependencies=[Depends(deps.rate_limit)])
def delete_profile_photo(
    *,
    db: Session = Depends(deps.get_db),
    payload: PhotoRemove = Body(...),
    current_user: models.User = Depends(deps.get_current_user),
) -> Any:
    """Delete a profile image for the current user."""
    url = (payload.url or "").strip()
    if not url:
        raise HTTPException(status_code=400, detail="Photo URL is required.")
    media = current_user.profile_media or {}
    photos = media.get("photos") or []
    if url not in photos:
        raise HTTPException(status_code=404, detail="Photo not found.")
    photos = [photo for photo in photos if photo != url]
    media["photos"] = photos
    if current_user.profile_image_url == url:
        current_user.profile_image_url = photos[0] if photos else None
    current_user.profile_media = media
    if url.startswith("/api/v1/media/"):
        try:
            blob_id = int(url.split("/api/v1/media/")[1])
            blob = db.query(MediaBlob).filter(MediaBlob.id == blob_id).first()
            if blob:
                blob.deleted_at = _utcnow()
                db.add(blob)
        except (ValueError, IndexError):
            pass
    db.add(current_user)
    db.commit()
    db.refresh(current_user)
    return current_user


def _extract_media_urls(media: dict | None) -> list[str]:
    if not media:
        return []
    urls: list[str] = []
    photos = media.get("photos") or []
    if isinstance(photos, list):
        urls.extend([item for item in photos if isinstance(item, str)])
    for key in ("photo_verification_url", "id_verification_url"):
        value = media.get(key)
        if isinstance(value, str):
            urls.append(value)
    return urls


@router.delete("/me", status_code=status.HTTP_204_NO_CONTENT, dependencies=[Depends(deps.rate_limit)])
def delete_my_account(
    *,
    db: Session = Depends(deps.get_db),
    current_user: models.User = Depends(deps.get_current_user),
) -> None:
    if current_user.deleted_at is not None:
        return

    now = _utcnow()
    scrub_suffix = f"{current_user.id}-{uuid4().hex[:8]}"
    media_urls = _extract_media_urls(current_user.profile_media or {})

    # Soft-delete related memberships
    db.query(models.Membership).filter(
        models.Membership.user_id == current_user.id,
        models.Membership.deleted_at.is_(None),
    ).update({models.Membership.deleted_at: now})

    # Remove any DB-stored blobs linked to profile media
    for url in media_urls:
        if url.startswith("/api/v1/media/"):
            try:
                blob_id = int(url.split("/api/v1/media/")[1])
                blob = db.query(MediaBlob).filter(MediaBlob.id == blob_id).first()
                if blob:
                    blob.deleted_at = now
                    db.add(blob)
            except (ValueError, IndexError):
                continue

    current_user.deleted_at = now
    current_user.email = f"deleted-{scrub_suffix}@splendoure.local"
    current_user.username = f"deleted-{scrub_suffix}"
    current_user.full_name = "Deleted User"
    current_user.bio = None
    current_user.profile_image_url = None
    current_user.profile_video_url = None
    current_user.interests = None
    current_user.profile_details = None
    current_user.discovery_settings = None
    current_user.profile_media = None
    db.add(current_user)
    db.commit()


@router.post("/me/photo-verification", response_model=schemas.User, dependencies=[Depends(deps.rate_limit)])
def upload_photo_verification(
    *,
    db: Session = Depends(deps.get_db),
    file: UploadFile = File(...),
    current_user: models.User = Depends(deps.get_current_user),
) -> Any:
    if not file.content_type or not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="Only image uploads are allowed.")
    file_bytes = file.file.read()
    if supabase_storage_enabled():
        photo_url = upload_bytes_to_supabase(
            prefix=f"users/{current_user.id}",
            filename=file.filename,
            content_type=file.content_type,
            data=file_bytes,
        )
    else:
        blob = MediaBlob(
            content_type=file.content_type or "image/jpeg",
            filename=file.filename,
            data=file_bytes,
            created_by=current_user.id,
        )
        db.add(blob)
        db.flush()
        photo_url = f"/api/v1/media/{blob.id}"
    media = current_user.profile_media or {}
    media["photo_verification_url"] = photo_url
    media["photo_verified"] = False
    current_user.profile_media = media
    if current_user.verification_status != VerificationStatus.VERIFIED:
        current_user.verification_status = VerificationStatus.PENDING
        current_user.verification_requested_at = datetime.utcnow()
    db.add(current_user)
    db.commit()
    db.refresh(current_user)
    return current_user


@router.post("/me/id-verification", response_model=schemas.User, dependencies=[Depends(deps.rate_limit)])
def upload_id_verification(
    *,
    db: Session = Depends(deps.get_db),
    file: UploadFile = File(...),
    current_user: models.User = Depends(deps.get_current_user),
) -> Any:
    if not file.content_type or not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="Only image uploads are allowed.")
    file_bytes = file.file.read()
    if supabase_storage_enabled():
        id_url = upload_bytes_to_supabase(
            prefix=f"users/{current_user.id}",
            filename=file.filename,
            content_type=file.content_type,
            data=file_bytes,
        )
    else:
        blob = MediaBlob(
            content_type=file.content_type or "image/jpeg",
            filename=file.filename,
            data=file_bytes,
            created_by=current_user.id,
        )
        db.add(blob)
        db.flush()
        id_url = f"/api/v1/media/{blob.id}"
    details = current_user.profile_details or {}
    details["id_verification_url"] = id_url
    details["id_verification_status"] = "pending"
    details["id_verified"] = False
    current_user.profile_details = details
    db.add(current_user)
    db.commit()
    db.refresh(current_user)
    return current_user


@router.post("/me/request-verification", response_model=schemas.User, dependencies=[Depends(deps.rate_limit)])
def request_verification(
    *,
    db: Session = Depends(deps.get_db),
    current_user: models.User = Depends(deps.get_current_user),
) -> Any:
    if current_user.verification_status == VerificationStatus.VERIFIED:
        return current_user
    current_user.verification_status = VerificationStatus.PENDING
    current_user.verification_requested_at = datetime.utcnow()
    db.add(current_user)
    db.commit()
    db.refresh(current_user)
    return current_user

@router.put("/me", response_model=schemas.User)
def update_user_me(
    *,
    db: Session = Depends(deps.get_db),
    user_in: schemas.UserUpdate,
    current_user: models.User = Depends(deps.get_current_user),
) -> Any:
    """Update current user details."""
    allowed_fields = {
        "username",
        "full_name",
        "age",
        "gender",
        "sexual_orientation",
        "location_city",
        "location_country",
        "location_lat",
        "location_lng",
        "bio",
        "profile_video_url",
        "interests",
        "profile_details",
        "discovery_settings",
        "profile_media",
    }
    for field, value in user_in.model_dump(exclude_unset=True).items():
        if field not in allowed_fields:
            continue
        if field == "username" and value:
            existing = (
                db.query(models.User)
                .filter(models.User.username == value, models.User.id != current_user.id)
                .first()
            )
            if existing:
                raise HTTPException(status_code=400, detail="Username already taken.")
        setattr(current_user, field, value)
    db.add(current_user)
    db.commit()
    db.refresh(current_user)
    return current_user

@router.get("/{id}", response_model=schemas.User)
def read_user(
    *,
    db: Session = Depends(deps.get_db),
    id: int,
    current_user: models.User = Depends(deps.get_current_user),
) -> Any:
    """Get user by ID."""
    user = crud.user.get(db, id=id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user
