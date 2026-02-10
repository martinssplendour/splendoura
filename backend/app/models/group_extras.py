import enum
from sqlalchemy import Boolean, Column, DateTime, Enum, Float, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import relationship
from app.models.base import Base, SoftDeleteMixin, TimestampMixin


class GroupMediaType(str, enum.Enum):
    IMAGE = "image"
    VIDEO = "video"


class GroupMedia(Base, TimestampMixin, SoftDeleteMixin):
    __tablename__ = "group_media"

    id = Column(Integer, primary_key=True)
    group_id = Column(Integer, ForeignKey("groups.id"), index=True)
    uploader_id = Column(Integer, ForeignKey("users.id"), index=True)
    url = Column(String, nullable=False)
    thumb_url = Column(String, nullable=True)
    media_type = Column(
        Enum(GroupMediaType, values_callable=lambda x: [e.value for e in x], name="groupmediatype")
    )
    is_cover = Column(Boolean, default=False)

    group = relationship("Group", back_populates="media_items")
    uploader = relationship("User")


class GroupAvailability(Base, TimestampMixin, SoftDeleteMixin):
    __tablename__ = "group_availability"
    __table_args__ = (UniqueConstraint("group_id", "day_of_week", "slot", name="uq_group_slot"),)

    id = Column(Integer, primary_key=True)
    group_id = Column(Integer, ForeignKey("groups.id"), index=True)
    day_of_week = Column(Integer, nullable=False)  # 0=Mon ... 6=Sun
    slot = Column(String, nullable=False)  # e.g. "morning", "afternoon", "evening", "night"
    created_by = Column(Integer, ForeignKey("users.id"), index=True)

    group = relationship("Group", back_populates="availability_slots")
    creator = relationship("User")


class GroupPlan(Base, TimestampMixin, SoftDeleteMixin):
    __tablename__ = "group_plans"

    id = Column(Integer, primary_key=True)
    group_id = Column(Integer, ForeignKey("groups.id"), index=True)
    title = Column(String, nullable=False)
    details = Column(Text, nullable=True)
    scheduled_at = Column(DateTime(timezone=True), nullable=True)
    location_name = Column(String, nullable=True)
    location_lat = Column(Float, nullable=True)
    location_lng = Column(Float, nullable=True)
    pinned = Column(Boolean, default=False)
    created_by = Column(Integer, ForeignKey("users.id"), index=True)

    group = relationship("Group", back_populates="plans")
    creator = relationship("User")


class GroupAnnouncement(Base, TimestampMixin, SoftDeleteMixin):
    __tablename__ = "group_announcements"

    id = Column(Integer, primary_key=True)
    group_id = Column(Integer, ForeignKey("groups.id"), index=True)
    title = Column(String, nullable=False)
    body = Column(Text, nullable=True)
    created_by = Column(Integer, ForeignKey("users.id"), index=True)

    group = relationship("Group", back_populates="announcements")
    creator = relationship("User")


class RSVPStatus(str, enum.Enum):
    GOING = "going"
    INTERESTED = "interested"
    NOT_GOING = "not_going"


class GroupPlanRSVP(Base, TimestampMixin, SoftDeleteMixin):
    __tablename__ = "group_plan_rsvps"
    __table_args__ = (UniqueConstraint("plan_id", "user_id", name="uq_group_plan_rsvp"),)

    id = Column(Integer, primary_key=True)
    plan_id = Column(Integer, ForeignKey("group_plans.id"), index=True)
    user_id = Column(Integer, ForeignKey("users.id"), index=True)
    status = Column(
        Enum(RSVPStatus, values_callable=lambda x: [e.value for e in x], name="rsvpstatus")
    )

    plan = relationship("GroupPlan")
    user = relationship("User")


class GroupPoll(Base, TimestampMixin, SoftDeleteMixin):
    __tablename__ = "group_polls"

    id = Column(Integer, primary_key=True)
    group_id = Column(Integer, ForeignKey("groups.id"), index=True)
    question = Column(Text, nullable=False)
    is_multi = Column(Boolean, default=False)
    closes_at = Column(DateTime(timezone=True), nullable=True)
    is_active = Column(Boolean, default=True)
    created_by = Column(Integer, ForeignKey("users.id"), index=True)

    group = relationship("Group", back_populates="polls")
    options = relationship("GroupPollOption", back_populates="poll", cascade="all, delete-orphan")
    creator = relationship("User")


class GroupPollOption(Base, TimestampMixin, SoftDeleteMixin):
    __tablename__ = "group_poll_options"

    id = Column(Integer, primary_key=True)
    poll_id = Column(Integer, ForeignKey("group_polls.id"), index=True)
    label = Column(String, nullable=False)

    poll = relationship("GroupPoll", back_populates="options")


class GroupPollVote(Base, TimestampMixin, SoftDeleteMixin):
    __tablename__ = "group_poll_votes"
    __table_args__ = (UniqueConstraint("poll_id", "user_id", "option_id", name="uq_poll_vote"),)

    id = Column(Integer, primary_key=True)
    poll_id = Column(Integer, ForeignKey("group_polls.id"), index=True)
    option_id = Column(Integer, ForeignKey("group_poll_options.id"), index=True)
    user_id = Column(Integer, ForeignKey("users.id"), index=True)

    poll = relationship("GroupPoll")
    option = relationship("GroupPollOption")
    voter = relationship("User")


class GroupPin(Base, TimestampMixin, SoftDeleteMixin):
    __tablename__ = "group_pins"

    id = Column(Integer, primary_key=True)
    group_id = Column(Integer, ForeignKey("groups.id"), index=True)
    title = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    lat = Column(Float, nullable=True)
    lng = Column(Float, nullable=True)
    created_by = Column(Integer, ForeignKey("users.id"), index=True)

    group = relationship("Group", back_populates="pins")
    creator = relationship("User")
