# backend/app/schemas/membership.py
from datetime import datetime
from pydantic import BaseModel, ConfigDict
from app.models.membership import JoinStatus, MembershipRole

class JoinRequest(BaseModel):
    consent_flags: dict[str, bool]
    request_message: str | None = None
    request_tier: str | None = None

class MembershipBase(BaseModel):
    user_id: int
    group_id: int
    role: MembershipRole = MembershipRole.MEMBER
    join_status: JoinStatus = JoinStatus.REQUESTED
    request_message: str | None = None
    request_tier: str | None = None

class MembershipCreate(MembershipBase):
    pass

class Membership(MembershipBase):
    id: int
    joined_at: datetime

    model_config = ConfigDict(from_attributes=True)
