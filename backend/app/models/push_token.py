from sqlalchemy import Column, ForeignKey, Integer, String, UniqueConstraint
from app.models.base import Base, TimestampMixin


class UserPushToken(Base, TimestampMixin):
    __tablename__ = "user_push_tokens"
    __table_args__ = (UniqueConstraint("token", name="uq_user_push_tokens"),)

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), index=True)
    token = Column(String, nullable=False, unique=True, index=True)
    platform = Column(String, nullable=True)
