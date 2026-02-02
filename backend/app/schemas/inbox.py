from datetime import datetime
from typing import Optional
from pydantic import BaseModel, ConfigDict
from app.models.message import MessageType


class InboxMessage(BaseModel):
    id: int
    sender_id: int
    content: Optional[str] = None
    attachment_url: Optional[str] = None
    attachment_type: Optional[str] = None
    message_type: Optional[MessageType] = None
    meta: Optional[dict] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class InboxThread(BaseModel):
    group_id: int
    title: str
    cover_image_url: Optional[str] = None
    last_message: Optional[InboxMessage] = None
    last_message_at: Optional[datetime] = None
    unread_count: int = 0
    updated_at: Optional[datetime] = None
    created_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)
