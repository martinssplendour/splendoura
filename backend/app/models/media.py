from sqlalchemy import Column, ForeignKey, Integer, LargeBinary, String
from sqlalchemy.orm import relationship
from app.models.base import Base, SoftDeleteMixin, TimestampMixin


class MediaBlob(Base, TimestampMixin, SoftDeleteMixin):
    __tablename__ = "media_blobs"

    id = Column(Integer, primary_key=True)
    content_type = Column(String, nullable=False)
    filename = Column(String, nullable=True)
    data = Column(LargeBinary, nullable=False)
    created_by = Column(Integer, ForeignKey("users.id"), index=True, nullable=True)

    creator = relationship("User")
