# backend/app/models/membership.py
import enum
from sqlalchemy import Column, DateTime, Enum, ForeignKey, Integer, String, Text, UniqueConstraint, func
from sqlalchemy.orm import relationship
from app.models.base import Base, SoftDeleteMixin, TimestampMixin

class MembershipRole(str, enum.Enum):
    CREATOR = "creator"
    MEMBER = "member"

class JoinStatus(str, enum.Enum):
    REQUESTED = "requested"
    APPROVED = "approved"
    REJECTED = "rejected"

class Membership(Base, TimestampMixin, SoftDeleteMixin):
    __tablename__ = "memberships"
    __table_args__ = (
        UniqueConstraint("user_id", "group_id", name="uq_memberships_user_group"),
    )

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    group_id = Column(Integer, ForeignKey("groups.id"))
    role = Column(
        Enum(MembershipRole, values_callable=lambda x: [e.value for e in x], name="membershiprole"),
        default=MembershipRole.MEMBER,
    )
    join_status = Column(
        Enum(JoinStatus, values_callable=lambda x: [e.value for e in x], name="joinstatus"),
        default=JoinStatus.REQUESTED,
    )
    joined_at = Column(DateTime(timezone=True), default=func.now())
    request_message = Column(Text, nullable=True)
    request_tier = Column(String, nullable=True, default="like")

    # Relationships to easily access user or group data from a membership object
    user = relationship("User", back_populates="memberships")
    group = relationship("Group", back_populates="memberships")
