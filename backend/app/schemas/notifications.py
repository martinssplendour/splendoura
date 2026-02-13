from datetime import datetime
from typing import Optional
from pydantic import BaseModel, ConfigDict


class NotificationUser(BaseModel):
    id: int
    full_name: Optional[str] = None
    username: Optional[str] = None
    profile_image_url: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


class NotificationGroup(BaseModel):
    id: int
    title: str
    cover_image_url: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


class GroupNotification(BaseModel):
    id: str
    type: str
    created_at: Optional[datetime] = None
    group: NotificationGroup
    actor: Optional[NotificationUser] = None
    message: Optional[str] = None
    request_tier: Optional[str] = None
    unread_count: Optional[int] = None


class MatchNotification(BaseModel):
    id: str
    matched_at: Optional[datetime] = None
    user: NotificationUser
    chat_group_id: Optional[int] = None
