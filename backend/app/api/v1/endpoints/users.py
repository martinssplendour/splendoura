# backend/app/api/v1/endpoints/users.py
from datetime import datetime, timezone
from typing import Any, List
from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from sqlalchemy.orm import Session

from app import crud, models, schemas
from app.api import deps
from app.models.group import GroupStatus
from app.models.group_extras import GroupMedia
from app.models.media import MediaBlob
from app.models.membership import JoinStatus
from app.models.user import VerificationStatus
from app.core.storage import supabase_storage_enabled, upload_bytes_to_supabase

router = APIRouter()

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
