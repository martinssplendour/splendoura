from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app import models, schemas
from app.api import deps

router = APIRouter()

@router.post("/", response_model=schemas.Report, dependencies=[Depends(deps.rate_limit)])
def create_report(
    *,
    db: Session = Depends(deps.get_db),
    report_in: schemas.ReportCreate,
    current_user: models.User = Depends(deps.get_current_active_user),
):
    if not report_in.reported_user_id and not report_in.group_id:
        raise HTTPException(status_code=400, detail="Provide reported_user_id or group_id.")
    report = models.Report(
        reporter_id=current_user.id,
        reported_user_id=report_in.reported_user_id,
        group_id=report_in.group_id,
        reason=report_in.reason,
        description=report_in.description,
    )
    db.add(report)
    db.commit()
    db.refresh(report)
    return report

@router.get("/", response_model=list[schemas.Report])
def list_reports(
    db: Session = Depends(deps.get_db),
    current_user: models.User = Depends(deps.get_current_admin_user),
):
    return db.query(models.Report).filter(models.Report.deleted_at.is_(None)).all()
