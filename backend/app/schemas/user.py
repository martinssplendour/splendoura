from datetime import datetime
from typing import Optional
from pydantic import BaseModel, EmailStr, Field, ConfigDict
from app.models.user import Gender, UserRole, VerificationStatus

# Shared properties
class UserBase(BaseModel):
    email: Optional[EmailStr] = None
    username: Optional[str] = None
    full_name: Optional[str] = None
    age: Optional[int] = None
    gender: Optional[Gender] = None
    sexual_orientation: Optional[str] = None
    location_city: Optional[str] = None
    location_country: Optional[str] = None
    location_lat: Optional[float] = None
    location_lng: Optional[float] = None
    bio: Optional[str] = None
    profile_image_url: Optional[str] = None
    profile_video_url: Optional[str] = None
    interests: Optional[list[str]] = None
    badges: Optional[list[str]] = None
    profile_details: Optional[dict] = None
    discovery_settings: Optional[dict] = None
    profile_media: Optional[dict] = None
    reputation_score: Optional[float] = None
    safety_score: Optional[float] = None
    verification_status: Optional[VerificationStatus] = None
    verification_requested_at: Optional[datetime] = None
    verified_at: Optional[datetime] = None
    last_active_at: Optional[datetime] = None
    role: Optional[UserRole] = None

# Properties to receive via API on creation
class UserCreate(UserBase):
    email: EmailStr
    password: str
    username: Optional[str] = None
    full_name: str
    age: int = Field(ge=18)
    gender: Gender

class UserUpdate(UserBase):
    age: Optional[int] = Field(default=None, ge=18)

class PushTokenCreate(BaseModel):
    token: str
    platform: Optional[str] = None

# Properties to return via API
class User(UserBase):
    id: int
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)
