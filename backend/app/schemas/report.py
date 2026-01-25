from pydantic import BaseModel, ConfigDict
from app.models.report import ReportStatus

class ReportCreate(BaseModel):
    reported_user_id: int | None = None
    group_id: int | None = None
    reason: str
    description: str | None = None

class Report(BaseModel):
    id: int
    reporter_id: int
    reported_user_id: int | None = None
    group_id: int | None = None
    reason: str
    description: str | None = None
    status: ReportStatus

    model_config = ConfigDict(from_attributes=True)
