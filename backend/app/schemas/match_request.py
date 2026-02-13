from datetime import datetime
from typing import Any, List, Optional
from pydantic import BaseModel, ConfigDict

from app.models.match_request import MatchIntent, MatchInviteStatus, MatchRequestStatus
from app.schemas.user import User


class MatchCriterion(BaseModel):
    key: str
    value: Any | None = None


class MatchRequestCreate(BaseModel):
    intent: MatchIntent
    criteria: List[MatchCriterion] = []
    offers: List[str] = []


class MatchRequest(BaseModel):
    id: int
    requester_id: int
    intent: MatchIntent
    status: MatchRequestStatus
    criteria: Optional[List[MatchCriterion]] = None
    offers: Optional[List[str]] = None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class MatchCandidate(BaseModel):
    user: User
    match_count: int
    criteria_count: int
    score: float


class MatchRequestWithResults(BaseModel):
    request: MatchRequest
    results: List[MatchCandidate]


class MatchInviteCreate(BaseModel):
    request_id: int
    target_user_id: int


class MatchInvite(BaseModel):
    id: int
    request_id: int
    requester_id: int
    target_user_id: int
    status: MatchInviteStatus
    matched: Optional[bool] = None
    match_user_id: Optional[int] = None
    chat_group_id: Optional[int] = None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)
