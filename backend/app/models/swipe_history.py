import enum
from sqlalchemy import Column, Enum, ForeignKey, Integer, UniqueConstraint
from sqlalchemy.orm import relationship
from app.models.base import Base, TimestampMixin


class SwipeTargetType(str, enum.Enum):
    GROUP = "group"
    PROFILE = "profile"


class SwipeAction(str, enum.Enum):
    LIKE = "like"
    NOPE = "nope"
    SUPERLIKE = "superlike"
    VIEW = "view"


class SwipeHistory(Base, TimestampMixin):
    __tablename__ = "swipe_history"
    __table_args__ = (
        UniqueConstraint("user_id", "target_type", "target_id", name="uq_swipe_history_user_target"),
    )

    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id"), index=True)
    target_type = Column(
        Enum(SwipeTargetType, values_callable=lambda x: [e.value for e in x], name="swipetargettype"),
        nullable=False,
    )
    target_id = Column(Integer, index=True, nullable=False)
    action = Column(
        Enum(SwipeAction, values_callable=lambda x: [e.value for e in x], name="swipeaction"),
        nullable=False,
    )

    user = relationship("User")
