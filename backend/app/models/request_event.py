from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, Index, Integer, String, func, text
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


class RequestEvent(Base):
    __tablename__ = "request_events"
    __table_args__ = (
        Index("ix_request_events_created_at", "created_at"),
        Index("ix_request_events_client_ip_created_at", "client_ip", "created_at"),
        Index("ix_request_events_path_created_at", "path", "created_at"),
        Index("ix_request_events_status_code_created_at", "status_code", "created_at"),
        Index("ix_request_events_user_id_created_at", "user_id", "created_at"),
        Index("ix_request_events_request_id", "request_id"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    request_id: Mapped[str | None] = mapped_column(String(128), nullable=True)
    method: Mapped[str] = mapped_column(String(16), nullable=False)
    path: Mapped[str] = mapped_column(String(512), nullable=False)
    route: Mapped[str | None] = mapped_column(String(512), nullable=True)
    status_code: Mapped[int] = mapped_column(Integer, nullable=False)
    duration_ms: Mapped[int] = mapped_column(Integer, nullable=False)
    client_ip: Mapped[str | None] = mapped_column(String(64), nullable=True)
    user_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("users.id"), nullable=True)
    user_agent: Mapped[str | None] = mapped_column(String(512), nullable=True)
    referer: Mapped[str | None] = mapped_column(String(512), nullable=True)
    query_string: Mapped[str | None] = mapped_column(String(1024), nullable=True)
    is_error: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False, server_default=text("false")
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=func.now(), server_default=func.now()
    )
