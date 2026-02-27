# backend/app/crud/crud_user.py
from typing import Optional
from sqlalchemy.orm import Session
from datetime import datetime
from app.models.user import User, VerificationStatus
from app.schemas.user import UserCreate
from app.core.security import verify_password, get_password_hash
from app.core import email as email_utils
from app.core.config import settings
from app.core.push import notify_admins_new_user

class CRUDUser:
    def get(self, db: Session, id: int) -> Optional[User]:
        return db.query(User).filter(User.id == id, User.deleted_at.is_(None)).first()

    def get_by_email(self, db: Session, email: str) -> Optional[User]:
        return db.query(User).filter(User.email == email, User.deleted_at.is_(None)).first()

    def authenticate(self, db: Session, *, email: str, password: str) -> Optional[User]:
        """Verify the user's email and hashed password."""
        user = self.get_by_email(db, email=email)
        if not user:
            return None
        if not verify_password(password, user.hashed_password):
            return None
        return user

    def create(self, db: Session, *, obj_in: UserCreate) -> User:
        """Create a new user with a hashed password."""
        username = obj_in.username or obj_in.email.split("@")[0]
        db_obj = User(
            email=obj_in.email,
            hashed_password=get_password_hash(obj_in.password), # FIXED: Now hashing the password
            username=username,
            full_name=obj_in.full_name,
            age=obj_in.age,
            gender=obj_in.gender,
            sexual_orientation=obj_in.sexual_orientation,
            location_city=obj_in.location_city,
            location_country=obj_in.location_country,
            location_lat=obj_in.location_lat,
            location_lng=obj_in.location_lng,
            bio=obj_in.bio,
            profile_video_url=obj_in.profile_video_url,
            interests=obj_in.interests,
            profile_details=obj_in.profile_details,
            discovery_settings=obj_in.discovery_settings,
            profile_media=obj_in.profile_media,
            badges=[],
            reputation_score=0.0,
            safety_score=0.0,
            verification_status=VerificationStatus.PENDING,
            verification_requested_at=datetime.utcnow(),
            last_active_at=datetime.utcnow(),
        )
        db.add(db_obj)
        db.commit()
        db.refresh(db_obj)
        if settings.NEW_USER_ALERT_EMAIL:
            email_utils.send_new_user_alert_email(
                to_email=settings.NEW_USER_ALERT_EMAIL,
                user_id=db_obj.id,
                full_name=db_obj.full_name,
                username=db_obj.username,
                joined_email=db_obj.email,
            )
        notify_admins_new_user(db, db_obj)
        return db_obj

user = CRUDUser()
