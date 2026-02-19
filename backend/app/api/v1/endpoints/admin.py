from datetime import datetime, timedelta, timezone
from typing import Any, List
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import case, func
from sqlalchemy.orm import Session

from app import crud, models, schemas
from app.api import deps
from app.models.user import UserRole, VerificationStatus

router = APIRouter()


@router.get("/users/pending", response_model=List[schemas.User])
def list_pending_users(
    db: Session = Depends(deps.get_db),
    current_user: models.User = Depends(deps.get_current_admin_user),
) -> Any:
    return (
        db.query(models.User)
        .filter(models.User.verification_status == VerificationStatus.PENDING)
        .order_by(models.User.created_at.desc())
        .all()
    )


@router.get("/users/id-pending", response_model=List[schemas.User])
def list_id_pending_users(
    db: Session = Depends(deps.get_db),
    current_user: models.User = Depends(deps.get_current_admin_user),
) -> Any:
    users = (
        db.query(models.User)
        .filter(models.User.deleted_at.is_(None))
        .order_by(models.User.created_at.desc())
        .all()
    )
    return [
        user
        for user in users
        if (user.profile_details or {}).get("id_verification_status") == "pending"
    ]


@router.post("/users/{user_id}/verify", response_model=schemas.User)
def verify_user(
    *,
    db: Session = Depends(deps.get_db),
    user_id: int,
    current_user: models.User = Depends(deps.get_current_admin_user),
) -> Any:
    user = crud.user.get(db, id=user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    user.verification_status = VerificationStatus.VERIFIED
    user.verified_at = datetime.utcnow()
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@router.post("/users/{user_id}/photo-verify", response_model=schemas.User)
def verify_user_photo(
    *,
    db: Session = Depends(deps.get_db),
    user_id: int,
    current_user: models.User = Depends(deps.get_current_admin_user),
) -> Any:
    user = crud.user.get(db, id=user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    media = user.profile_media or {}
    media["photo_verified"] = True
    user.profile_media = media
    user.verification_status = VerificationStatus.VERIFIED
    user.verified_at = datetime.utcnow()
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@router.post("/users/{user_id}/id-verify", response_model=schemas.User)
def verify_user_id(
    *,
    db: Session = Depends(deps.get_db),
    user_id: int,
    current_user: models.User = Depends(deps.get_current_admin_user),
) -> Any:
    user = crud.user.get(db, id=user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    details = user.profile_details or {}
    details["id_verification_status"] = "verified"
    details["id_verified"] = True
    user.profile_details = details
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@router.post("/users/{user_id}/id-reject", response_model=schemas.User)
def reject_user_id(
    *,
    db: Session = Depends(deps.get_db),
    user_id: int,
    current_user: models.User = Depends(deps.get_current_admin_user),
) -> Any:
    user = crud.user.get(db, id=user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    details = user.profile_details or {}
    details["id_verification_status"] = "rejected"
    details["id_verified"] = False
    user.profile_details = details
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@router.post("/users/{user_id}/reject", response_model=schemas.User)
def reject_user(
    *,
    db: Session = Depends(deps.get_db),
    user_id: int,
    current_user: models.User = Depends(deps.get_current_admin_user),
) -> Any:
    user = crud.user.get(db, id=user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    user.verification_status = VerificationStatus.REJECTED
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@router.post("/users/{user_id}/role", response_model=schemas.User)
def update_user_role(
    *,
    db: Session = Depends(deps.get_db),
    user_id: int,
    role: UserRole,
    current_user: models.User = Depends(deps.get_current_admin_user),
) -> Any:
    user = crud.user.get(db, id=user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    user.role = role
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@router.get("/analytics/overview", response_model=schemas.AnalyticsOverview)
def analytics_overview(
    *,
    days: int = Query(default=7, ge=1, le=90),
    limit: int = Query(default=10, ge=1, le=50),
    db: Session = Depends(deps.get_db),
    current_user: models.User = Depends(deps.get_current_admin_user),
) -> Any:
    since = datetime.now(timezone.utc) - timedelta(days=days)

    total_requests, unique_ips, total_4xx, total_5xx, avg_latency_ms = (
        db.query(
            func.count(models.RequestEvent.id),
            func.count(func.distinct(models.RequestEvent.client_ip)),
            func.sum(case((models.RequestEvent.status_code.between(400, 499), 1), else_=0)),
            func.sum(case((models.RequestEvent.status_code >= 500, 1), else_=0)),
            func.avg(models.RequestEvent.duration_ms),
        )
        .filter(models.RequestEvent.created_at >= since)
        .one()
    )

    total_requests = int(total_requests or 0)
    unique_ips = int(unique_ips or 0)
    total_4xx = int(total_4xx or 0)
    total_5xx = int(total_5xx or 0)
    avg_latency = float(avg_latency_ms) if avg_latency_ms is not None else None
    error_rate = float((total_4xx + total_5xx) / total_requests) if total_requests else 0.0

    top_paths = (
        db.query(
            models.RequestEvent.path.label("path"),
            func.count(models.RequestEvent.id).label("requests"),
            func.sum(case((models.RequestEvent.status_code.between(400, 499), 1), else_=0)).label("errors_4xx"),
            func.sum(case((models.RequestEvent.status_code >= 500, 1), else_=0)).label("errors_5xx"),
            func.avg(models.RequestEvent.duration_ms).label("avg_latency_ms"),
        )
        .filter(models.RequestEvent.created_at >= since)
        .group_by(models.RequestEvent.path)
        .order_by(func.count(models.RequestEvent.id).desc())
        .limit(limit)
        .all()
    )

    top_ips = (
        db.query(
            models.RequestEvent.client_ip.label("ip_address"),
            func.count(models.RequestEvent.id).label("requests"),
            func.count(func.distinct(models.RequestEvent.user_id)).label("unique_users"),
            func.sum(case((models.RequestEvent.status_code.between(400, 499), 1), else_=0)).label("errors_4xx"),
            func.sum(case((models.RequestEvent.status_code >= 500, 1), else_=0)).label("errors_5xx"),
            func.avg(models.RequestEvent.duration_ms).label("avg_latency_ms"),
            func.max(models.RequestEvent.created_at).label("last_seen_at"),
        )
        .filter(models.RequestEvent.created_at >= since, models.RequestEvent.client_ip.is_not(None))
        .group_by(models.RequestEvent.client_ip)
        .order_by(func.count(models.RequestEvent.id).desc())
        .limit(limit)
        .all()
    )

    active_refresh_sessions = (
        db.query(func.count(models.UserRefreshSession.id))
        .filter(
            models.UserRefreshSession.revoked_at.is_(None),
            models.UserRefreshSession.expires_at > datetime.now(timezone.utc),
        )
        .scalar()
    )

    return schemas.AnalyticsOverview(
        window_days=days,
        total_requests=total_requests,
        unique_ips=unique_ips,
        total_4xx=total_4xx,
        total_5xx=total_5xx,
        error_rate=error_rate,
        avg_latency_ms=avg_latency,
        active_refresh_sessions=int(active_refresh_sessions or 0),
        top_paths=[
            schemas.AnalyticsTopPath(
                path=row.path,
                requests=int(row.requests or 0),
                errors_4xx=int(row.errors_4xx or 0),
                errors_5xx=int(row.errors_5xx or 0),
                avg_latency_ms=float(row.avg_latency_ms) if row.avg_latency_ms is not None else None,
            )
            for row in top_paths
        ],
        top_ips=[
            schemas.AnalyticsIpUsage(
                ip_address=row.ip_address,
                requests=int(row.requests or 0),
                unique_users=int(row.unique_users or 0),
                errors_4xx=int(row.errors_4xx or 0),
                errors_5xx=int(row.errors_5xx or 0),
                avg_latency_ms=float(row.avg_latency_ms) if row.avg_latency_ms is not None else None,
                last_seen_at=row.last_seen_at,
            )
            for row in top_ips
            if row.ip_address
        ],
    )


@router.get("/analytics/ip-usage", response_model=List[schemas.AnalyticsIpUsage])
def analytics_ip_usage(
    *,
    days: int = Query(default=30, ge=1, le=180),
    limit: int = Query(default=50, ge=1, le=200),
    db: Session = Depends(deps.get_db),
    current_user: models.User = Depends(deps.get_current_admin_user),
) -> Any:
    since = datetime.now(timezone.utc) - timedelta(days=days)

    rows = (
        db.query(
            models.RequestEvent.client_ip.label("ip_address"),
            func.count(models.RequestEvent.id).label("requests"),
            func.count(func.distinct(models.RequestEvent.user_id)).label("unique_users"),
            func.sum(case((models.RequestEvent.status_code.between(400, 499), 1), else_=0)).label("errors_4xx"),
            func.sum(case((models.RequestEvent.status_code >= 500, 1), else_=0)).label("errors_5xx"),
            func.avg(models.RequestEvent.duration_ms).label("avg_latency_ms"),
            func.max(models.RequestEvent.created_at).label("last_seen_at"),
        )
        .filter(models.RequestEvent.created_at >= since, models.RequestEvent.client_ip.is_not(None))
        .group_by(models.RequestEvent.client_ip)
        .order_by(func.count(models.RequestEvent.id).desc())
        .limit(limit)
        .all()
    )

    return [
        schemas.AnalyticsIpUsage(
            ip_address=row.ip_address,
            requests=int(row.requests or 0),
            unique_users=int(row.unique_users or 0),
            errors_4xx=int(row.errors_4xx or 0),
            errors_5xx=int(row.errors_5xx or 0),
            avg_latency_ms=float(row.avg_latency_ms) if row.avg_latency_ms is not None else None,
            last_seen_at=row.last_seen_at,
        )
        for row in rows
        if row.ip_address
    ]
