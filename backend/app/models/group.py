# app/models/group.py
import enum
from sqlalchemy import Boolean, Column, DateTime, Enum, Float, ForeignKey, Integer, JSON, String, Text
from sqlalchemy.orm import relationship
from app.models.base import Base, SoftDeleteMixin, TimestampMixin

class CostType(enum.Enum):
    FREE = "free"
    SHARED = "shared"
    FULLY_PAID_BY_CREATOR = "fully_paid"
    CUSTOM = "custom"

class GroupStatus(enum.Enum):
    OPEN = "open"
    FULL = "full"
    CLOSED = "closed"
    COMPLETED = "completed"

class GroupVisibility(str, enum.Enum):
    PUBLIC = "public"
    INVITE_ONLY = "invite_only"

class GroupCategory(str, enum.Enum):
    MUTUAL_BENEFITS = "mutual_benefits"
    FRIENDSHIP = "friendship"
    DATING = "dating"

class Group(Base, TimestampMixin, SoftDeleteMixin):
    __tablename__ = "groups"
    
    id = Column(Integer, primary_key=True, index=True)
    creator_id = Column(Integer, ForeignKey("users.id"))
    title = Column(String, nullable=False)
    description = Column(Text, nullable=False)
    activity_type = Column(String) # e.g., "vacation", "dinner"
    location = Column(String, nullable=True)
    location_lat = Column(Float, nullable=True)
    location_lng = Column(Float, nullable=True)
    destination = Column(String, nullable=True)
    start_date = Column(DateTime(timezone=True), nullable=True)
    end_date = Column(DateTime(timezone=True), nullable=True)
    min_participants = Column(Integer, default=1)
    cost_type = Column(
        Enum(CostType, values_callable=lambda x: [e.value for e in x], name="costtype"),
        default=CostType.FREE,
    )
    offerings = Column(JSON) # e.g., {"hotels": True, "food": False}
    rules = Column(Text, nullable=True)
    expectations = Column(JSON, nullable=True)
    tags = Column(JSON, nullable=True)
    creator_intro = Column(Text, nullable=True)
    creator_intro_video_url = Column(String, nullable=True)
    category = Column(String, nullable=False, default=GroupCategory.FRIENDSHIP.value)
    lock_male = Column(Boolean, nullable=False, default=False)
    lock_female = Column(Boolean, nullable=False, default=False)
    max_participants = Column(Integer)
    visibility = Column(
        Enum(GroupVisibility, values_callable=lambda x: [e.value for e in x], name="groupvisibility"),
        default=GroupVisibility.PUBLIC,
    )
    status = Column(
        Enum(GroupStatus, values_callable=lambda x: [e.value for e in x], name="groupstatus"),
        default=GroupStatus.OPEN,
    )
    
    requirements = relationship(
        "GroupRequirement", back_populates="group", cascade="all, delete-orphan"
    )
    memberships = relationship(
        "Membership", back_populates="group", cascade="all, delete-orphan"
    )
    media_items = relationship(
        "GroupMedia", back_populates="group", cascade="all, delete-orphan"
    )
    polls = relationship(
        "GroupPoll", back_populates="group", cascade="all, delete-orphan"
    )
    availability_slots = relationship(
        "GroupAvailability", back_populates="group", cascade="all, delete-orphan"
    )
    plans = relationship(
        "GroupPlan", back_populates="group", cascade="all, delete-orphan"
    )
    pins = relationship(
        "GroupPin", back_populates="group", cascade="all, delete-orphan"
    )
    announcements = relationship(
        "GroupAnnouncement", back_populates="group", cascade="all, delete-orphan"
    )

class AppliesTo(str, enum.Enum):
    MALE = "male"
    FEMALE = "female"
    OTHER = "other"
    ALL = "all"

class GroupRequirement(Base, TimestampMixin, SoftDeleteMixin):
    __tablename__ = "group_requirements"
    
    id = Column(Integer, primary_key=True)
    group_id = Column(Integer, ForeignKey("groups.id"))
    applies_to = Column(
        Enum(AppliesTo, values_callable=lambda x: [e.value for e in x], name="appliesto")
    )
    min_age = Column(Integer)
    max_age = Column(Integer)
    additional_requirements = Column(Text, nullable=True)
    consent_flags = Column(JSON) # Structured flags user must click "Yes" to
    
    group = relationship("Group", back_populates="requirements")
