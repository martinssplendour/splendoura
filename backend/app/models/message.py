import enum
from sqlalchemy import Column, DateTime, Enum, ForeignKey, Integer, JSON, String, Text, UniqueConstraint, func
from sqlalchemy.orm import relationship
from app.models.base import Base, SoftDeleteMixin, TimestampMixin

class MessageType(str, enum.Enum):
    TEXT = "text"
    FILE = "file"
    PLAN = "plan"
    POLL = "poll"
    SYSTEM = "system"

class GroupMessage(Base, TimestampMixin, SoftDeleteMixin):
    __tablename__ = "group_messages"

    id = Column(Integer, primary_key=True, index=True)
    group_id = Column(Integer, ForeignKey("groups.id"), index=True)
    sender_id = Column(Integer, ForeignKey("users.id"), index=True)
    content = Column(Text, nullable=True)
    attachment_url = Column(String, nullable=True)
    attachment_type = Column(String, nullable=True)
    message_type = Column(
        Enum(MessageType, values_callable=lambda x: [e.value for e in x], name="messagetype"),
        default=MessageType.TEXT,
    )
    meta = Column("metadata", JSON, nullable=True)

    sender = relationship("User")


class GroupMessageRead(Base):
    __tablename__ = "group_message_reads"
    __table_args__ = (
        UniqueConstraint("message_id", "user_id", name="uq_group_message_reads"),
    )

    id = Column(Integer, primary_key=True, index=True)
    message_id = Column(Integer, ForeignKey("group_messages.id"), index=True)
    user_id = Column(Integer, ForeignKey("users.id"), index=True)
    read_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
