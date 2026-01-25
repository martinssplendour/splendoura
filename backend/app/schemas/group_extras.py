from datetime import datetime
from typing import Optional
from pydantic import BaseModel, ConfigDict, Field
from app.models.group_extras import GroupMediaType, RSVPStatus


class GroupMedia(BaseModel):
    id: int
    group_id: int
    uploader_id: int
    url: str
    media_type: GroupMediaType
    is_cover: bool
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class GroupAvailability(BaseModel):
    id: int
    group_id: int
    day_of_week: int = Field(ge=0, le=6)
    slot: str
    created_by: int

    model_config = ConfigDict(from_attributes=True)


class GroupAvailabilityCreate(BaseModel):
    day_of_week: int = Field(ge=0, le=6)
    slot: str


class GroupPlan(BaseModel):
    id: int
    group_id: int
    title: str
    details: Optional[str] = None
    scheduled_at: Optional[datetime] = None
    location_name: Optional[str] = None
    location_lat: Optional[float] = None
    location_lng: Optional[float] = None
    pinned: bool
    created_by: int

    model_config = ConfigDict(from_attributes=True)


class GroupPlanCreate(BaseModel):
    title: str
    details: Optional[str] = None
    scheduled_at: Optional[datetime] = None
    location_name: Optional[str] = None
    location_lat: Optional[float] = None
    location_lng: Optional[float] = None
    pinned: bool = False


class GroupPollOption(BaseModel):
    id: int
    label: str
    vote_count: int | None = None

    model_config = ConfigDict(from_attributes=True)


class GroupPoll(BaseModel):
    id: int
    group_id: int
    question: str
    is_multi: bool
    closes_at: Optional[datetime] = None
    is_active: bool
    created_by: int
    options: list[GroupPollOption] = []

    model_config = ConfigDict(from_attributes=True)


class GroupPollCreate(BaseModel):
    question: str
    is_multi: bool = False
    closes_at: Optional[datetime] = None
    options: list[str]


class GroupPollVote(BaseModel):
    option_ids: list[int]


class GroupPin(BaseModel):
    id: int
    group_id: int
    title: str
    description: Optional[str] = None
    lat: Optional[float] = None
    lng: Optional[float] = None
    created_by: int

    model_config = ConfigDict(from_attributes=True)


class GroupPinCreate(BaseModel):
    title: str
    description: Optional[str] = None
    lat: Optional[float] = None
    lng: Optional[float] = None


class GroupAnnouncement(BaseModel):
    id: int
    group_id: int
    title: str
    body: Optional[str] = None
    created_by: int
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class GroupAnnouncementCreate(BaseModel):
    title: str
    body: Optional[str] = None


class GroupPlanRSVP(BaseModel):
    id: int
    plan_id: int
    user_id: int
    status: RSVPStatus
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class GroupPlanRSVPCreate(BaseModel):
    status: RSVPStatus


class GroupPlanRSVPSummary(BaseModel):
    going: int = 0
    interested: int = 0
    not_going: int = 0
    user_status: Optional[RSVPStatus] = None
