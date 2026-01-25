# backend/app/schemas/group.py
from datetime import datetime
from typing import Dict, List, Optional
from pydantic import BaseModel, ConfigDict, Field
from app.models.group import AppliesTo, CostType, GroupCategory, GroupStatus, GroupVisibility

# Define classes in order of dependency
class GroupRequirementBase(BaseModel):
    applies_to: AppliesTo
    min_age: int = Field(ge=18)
    max_age: int
    additional_requirements: Optional[str] = None
    consent_flags: Dict[str, bool]

    model_config = ConfigDict(from_attributes=True)

class GroupCreate(BaseModel):
    title: str
    description: str
    activity_type: str
    category: GroupCategory
    location: Optional[str] = None
    location_lat: Optional[float] = None
    location_lng: Optional[float] = None
    destination: Optional[str] = None
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None
    min_participants: int = Field(default=1, ge=1)
    max_participants: int = Field(ge=1)
    cost_type: CostType
    offerings: List[str] = Field(min_length=2)
    rules: Optional[str] = None
    expectations: Optional[str] = None
    tags: Optional[List[str]] = None
    creator_intro: Optional[str] = None
    creator_intro_video_url: Optional[str] = None
    visibility: GroupVisibility = GroupVisibility.PUBLIC
    requirements: List[GroupRequirementBase]

class GroupUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    activity_type: Optional[str] = None
    category: Optional[GroupCategory] = None
    location: Optional[str] = None
    location_lat: Optional[float] = None
    location_lng: Optional[float] = None
    destination: Optional[str] = None
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None
    min_participants: Optional[int] = Field(default=None, ge=1)
    max_participants: Optional[int] = Field(default=None, ge=1)
    cost_type: Optional[CostType] = None
    offerings: Optional[List[str]] = None
    rules: Optional[str] = None
    expectations: Optional[str] = None
    tags: Optional[List[str]] = None
    creator_intro: Optional[str] = None
    creator_intro_video_url: Optional[str] = None
    lock_male: Optional[bool] = None
    lock_female: Optional[bool] = None
    visibility: Optional[GroupVisibility] = None
    requirements: Optional[List[GroupRequirementBase]] = None

class Group(BaseModel):
    id: int
    creator_id: int
    title: str
    description: str
    activity_type: str
    category: GroupCategory
    location: Optional[str] = None
    location_lat: Optional[float] = None
    location_lng: Optional[float] = None
    destination: Optional[str] = None
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None
    min_participants: int = Field(default=1, ge=1)
    max_participants: int = Field(ge=1)
    cost_type: CostType
    offerings: Optional[List[str]] = None
    rules: Optional[str] = None
    expectations: Optional[str] = None
    tags: Optional[List[str]] = None
    creator_intro: Optional[str] = None
    creator_intro_video_url: Optional[str] = None
    lock_male: bool
    lock_female: bool
    visibility: GroupVisibility = GroupVisibility.PUBLIC
    status: GroupStatus
    requirements: List[GroupRequirementBase]
    approved_members: Optional[int] = None
    cover_image_url: Optional[str] = None
    shared_tags: Optional[List[str]] = None
    discovery_labels: Optional[List[str]] = None
    discovery_reason: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)
