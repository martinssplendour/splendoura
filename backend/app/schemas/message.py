from datetime import datetime
from typing import Optional
from pydantic import BaseModel, ConfigDict, Field
from app.models.message import MessageType

class GroupMessageCreate(BaseModel):
    content: str | None = None
    attachment_url: str | None = None
    attachment_type: str | None = None
    message_type: MessageType | None = None
    meta: Optional[dict] = None

class GroupMessage(GroupMessageCreate):
    id: int
    group_id: int
    sender_id: int
    created_at: datetime
    read_by: list[int] = Field(default_factory=list)

    model_config = ConfigDict(from_attributes=True)


class GroupMessageReadRequest(BaseModel):
    message_ids: list[int]
