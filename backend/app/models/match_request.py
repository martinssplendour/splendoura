import enum
from sqlalchemy import JSON, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, SoftDeleteMixin, TimestampMixin


class MatchIntent(str, enum.Enum):
    FRIENDSHIP = "friendship"
    RELATIONSHIP = "relationship"
    MUTUAL_BENEFITS = "mutual_benefits"


class MatchRequestStatus(str, enum.Enum):
    OPEN = "open"
    CLOSED = "closed"


class MatchInviteStatus(str, enum.Enum):
    PENDING = "pending"
    ACCEPTED = "accepted"
    REJECTED = "rejected"
    CANCELLED = "cancelled"


class MatchRequest(Base, TimestampMixin, SoftDeleteMixin):
    __tablename__ = "match_requests"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    requester_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    intent: Mapped[str] = mapped_column(String, nullable=False)
    status: Mapped[str] = mapped_column(String, default=MatchRequestStatus.OPEN.value)
    criteria: Mapped[list[dict] | None] = mapped_column(JSON, nullable=True)
    offers: Mapped[list[str] | None] = mapped_column(JSON, nullable=True)


class MatchRequestInvite(Base, TimestampMixin, SoftDeleteMixin):
    __tablename__ = "match_request_invites"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    request_id: Mapped[int] = mapped_column(ForeignKey("match_requests.id"), index=True)
    requester_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    target_user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    status: Mapped[str] = mapped_column(String, default=MatchInviteStatus.PENDING.value)
