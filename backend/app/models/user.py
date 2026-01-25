import enum
from datetime import datetime
from sqlalchemy import CheckConstraint, DateTime, Enum, Float, Integer, JSON, String
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.models.base import Base, SoftDeleteMixin, TimestampMixin

class Gender(str, enum.Enum):
    MALE = "male"
    FEMALE = "female"
    OTHER = "other"
    OTHER_CUSTOM = "other_custom"

class VerificationStatus(str, enum.Enum):
    PENDING = "pending"
    VERIFIED = "verified"
    REJECTED = "rejected"

class UserRole(str, enum.Enum):
    USER = "user"
    ADMIN = "admin"

class User(Base, TimestampMixin, SoftDeleteMixin):
    __tablename__ = "users"
    __table_args__ = (
        CheckConstraint("age >= 18", name="check_user_age_minimum"),
    )
    
    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    email: Mapped[str] = mapped_column(unique=True, index=True)
    username: Mapped[str | None] = mapped_column(String, unique=True, nullable=True)
    hashed_password: Mapped[str] = mapped_column(String)
    full_name: Mapped[str] = mapped_column(String)
    age: Mapped[int] = mapped_column(Integer)
    gender: Mapped[Gender] = mapped_column(
        Enum(Gender, values_callable=lambda x: [e.value for e in x], name="gender")
    )
    sexual_orientation: Mapped[str | None] = mapped_column(String, nullable=True)
    location_city: Mapped[str | None] = mapped_column(String, nullable=True)
    location_country: Mapped[str | None] = mapped_column(String, nullable=True)
    location_lat: Mapped[float | None] = mapped_column(Float, nullable=True)
    location_lng: Mapped[float | None] = mapped_column(Float, nullable=True)
    bio: Mapped[str] = mapped_column(String, nullable=True)
    profile_image_url: Mapped[str | None] = mapped_column(String, nullable=True)
    profile_video_url: Mapped[str | None] = mapped_column(String, nullable=True)
    interests: Mapped[list[str] | None] = mapped_column(JSON, nullable=True)
    badges: Mapped[list[str] | None] = mapped_column(JSON, nullable=True)
    profile_details: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    discovery_settings: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    profile_media: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    reputation_score: Mapped[float] = mapped_column(Float, default=0.0)
    safety_score: Mapped[float] = mapped_column(Float, default=0.0)
    verification_status: Mapped[VerificationStatus] = mapped_column(
        Enum(
            VerificationStatus,
            values_callable=lambda x: [e.value for e in x],
            name="verificationstatus",
        ),
        default=VerificationStatus.PENDING,
    )
    verification_requested_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    verified_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    last_active_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    role: Mapped[UserRole] = mapped_column(
        Enum(UserRole, values_callable=lambda x: [e.value for e in x], name="userrole"),
        default=UserRole.USER,
    )

    memberships = relationship("Membership", back_populates="user")
