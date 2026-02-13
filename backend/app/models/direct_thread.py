from sqlalchemy import Column, ForeignKey, Integer, UniqueConstraint
from app.models.base import Base, SoftDeleteMixin, TimestampMixin


class DirectThread(Base, TimestampMixin, SoftDeleteMixin):
    __tablename__ = "direct_threads"
    __table_args__ = (
        UniqueConstraint("user_a_id", "user_b_id", name="uq_direct_threads_users"),
    )

    id = Column(Integer, primary_key=True, index=True)
    user_a_id = Column(Integer, ForeignKey("users.id"), index=True)
    user_b_id = Column(Integer, ForeignKey("users.id"), index=True)
    group_id = Column(Integer, ForeignKey("groups.id"), index=True)
