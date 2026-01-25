import enum
from sqlalchemy import Column, Enum, ForeignKey, Integer, Text
from sqlalchemy.orm import relationship
from app.models.base import Base, SoftDeleteMixin, TimestampMixin

class ReportStatus(str, enum.Enum):
    OPEN = "open"
    REVIEWED = "reviewed"
    CLOSED = "closed"

class Report(Base, TimestampMixin, SoftDeleteMixin):
    __tablename__ = "reports"

    id = Column(Integer, primary_key=True, index=True)
    reporter_id = Column(Integer, ForeignKey("users.id"))
    reported_user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    group_id = Column(Integer, ForeignKey("groups.id"), nullable=True)
    reason = Column(Text, nullable=False)
    description = Column(Text, nullable=True)
    status = Column(Enum(ReportStatus), default=ReportStatus.OPEN)

    reporter = relationship("User", foreign_keys=[reporter_id])
    reported_user = relationship("User", foreign_keys=[reported_user_id])
    group = relationship("Group")
