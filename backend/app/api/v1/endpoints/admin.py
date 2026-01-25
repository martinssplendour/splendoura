from datetime import datetime
from typing import Any, List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app import crud, models, schemas
from app.api import deps
from app.models.user import UserRole, VerificationStatus

router = APIRouter()


@router.get("/users/pending", response_model=List[schemas.User])
def list_pending_users(
    db: Session = Depends(deps.get_db),
    current_user: models.User = Depends(deps.get_current_admin_user),
) -> Any:
    return (
        db.query(models.User)
        .filter(models.User.verification_status == VerificationStatus.PENDING)
        .order_by(models.User.created_at.desc())
        .all()
    )


@router.get("/users/id-pending", response_model=List[schemas.User])
def list_id_pending_users(
    db: Session = Depends(deps.get_db),
    current_user: models.User = Depends(deps.get_current_admin_user),
) -> Any:
    users = (
        db.query(models.User)
        .filter(models.User.deleted_at.is_(None))
        .order_by(models.User.created_at.desc())
        .all()
    )
    return [
        user
        for user in users
        if (user.profile_details or {}).get("id_verification_status") == "pending"
    ]


@router.post("/users/{user_id}/verify", response_model=schemas.User)
def verify_user(
    *,
    db: Session = Depends(deps.get_db),
    user_id: int,
    current_user: models.User = Depends(deps.get_current_admin_user),
) -> Any:
    user = crud.user.get(db, id=user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    user.verification_status = VerificationStatus.VERIFIED
    user.verified_at = datetime.utcnow()
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@router.post("/users/{user_id}/photo-verify", response_model=schemas.User)
def verify_user_photo(
    *,
    db: Session = Depends(deps.get_db),
    user_id: int,
    current_user: models.User = Depends(deps.get_current_admin_user),
) -> Any:
    user = crud.user.get(db, id=user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    media = user.profile_media or {}
    media["photo_verified"] = True
    user.profile_media = media
    user.verification_status = VerificationStatus.VERIFIED
    user.verified_at = datetime.utcnow()
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@router.post("/users/{user_id}/id-verify", response_model=schemas.User)
def verify_user_id(
    *,
    db: Session = Depends(deps.get_db),
    user_id: int,
    current_user: models.User = Depends(deps.get_current_admin_user),
) -> Any:
    user = crud.user.get(db, id=user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    details = user.profile_details or {}
    details["id_verification_status"] = "verified"
    details["id_verified"] = True
    user.profile_details = details
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@router.post("/users/{user_id}/id-reject", response_model=schemas.User)
def reject_user_id(
    *,
    db: Session = Depends(deps.get_db),
    user_id: int,
    current_user: models.User = Depends(deps.get_current_admin_user),
) -> Any:
    user = crud.user.get(db, id=user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    details = user.profile_details or {}
    details["id_verification_status"] = "rejected"
    details["id_verified"] = False
    user.profile_details = details
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@router.post("/users/{user_id}/reject", response_model=schemas.User)
def reject_user(
    *,
    db: Session = Depends(deps.get_db),
    user_id: int,
    current_user: models.User = Depends(deps.get_current_admin_user),
) -> Any:
    user = crud.user.get(db, id=user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    user.verification_status = VerificationStatus.REJECTED
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@router.post("/users/{user_id}/role", response_model=schemas.User)
def update_user_role(
    *,
    db: Session = Depends(deps.get_db),
    user_id: int,
    role: UserRole,
    current_user: models.User = Depends(deps.get_current_admin_user),
) -> Any:
    user = crud.user.get(db, id=user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    user.role = role
    db.add(user)
    db.commit()
    db.refresh(user)
    return user
