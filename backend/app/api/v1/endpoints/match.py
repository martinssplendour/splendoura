import math
from typing import Any, List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import and_
from sqlalchemy.orm import Session

from app import crud, models, schemas
from app.api import deps
from app.core.matching import compute_match_score, is_profile_visible

router = APIRouter()
MAX_MATCH_CANDIDATES = 200


def _to_list(value: Any) -> list:
    if value is None:
        return []
    if isinstance(value, list):
        return [item for item in value if item is not None]
    if isinstance(value, str):
        return [item.strip() for item in value.split(",") if item.strip()]
    return [value]


def _apply_match_filters(
    query,
    *,
    criteria: list[dict],
    requester: models.User,
):
    for criterion in criteria:
        key = str(criterion.get("key") or "")
        value = criterion.get("value")
        if key == "age_range" and isinstance(value, dict):
            min_age = value.get("min")
            max_age = value.get("max")
            if min_age is not None:
                query = query.filter(models.User.age >= min_age)
            if max_age is not None:
                query = query.filter(models.User.age <= max_age)
        elif key == "gender":
            genders = _to_list(value)
            if genders:
                query = query.filter(models.User.gender.in_(genders))
        elif key == "distance_km":
            if requester.location_lat is None or requester.location_lng is None:
                continue
            try:
                max_km = float(value) if value is not None else None
            except (TypeError, ValueError):
                max_km = None
            if max_km is None:
                continue
            lat = requester.location_lat
            lng = requester.location_lng
            delta_lat = max_km / 111.0
            cos_lat = math.cos(math.radians(lat))
            delta_lng = max_km / (111.0 * cos_lat) if cos_lat else max_km / 111.0
            query = query.filter(
                and_(
                    models.User.location_lat.isnot(None),
                    models.User.location_lng.isnot(None),
                    models.User.location_lat >= lat - delta_lat,
                    models.User.location_lat <= lat + delta_lat,
                    models.User.location_lng >= lng - delta_lng,
                    models.User.location_lng <= lng + delta_lng,
                )
            )
    return query


@router.post("/requests", response_model=schemas.MatchRequestWithResults)
def create_match_request(
    *,
    db: Session = Depends(deps.get_db),
    payload: schemas.MatchRequestCreate,
    current_user: models.User = Depends(deps.get_current_user),
) -> Any:
    request = crud.match_request.create(db, requester_id=current_user.id, obj_in=payload)

    criteria_list = [criterion.model_dump() for criterion in payload.criteria] if payload.criteria else []
    query = (
        db.query(models.User)
        .filter(models.User.deleted_at.is_(None), models.User.id != current_user.id)
    )
    query = _apply_match_filters(query, criteria=criteria_list, requester=current_user)
    candidates = query.limit(MAX_MATCH_CANDIDATES).all()
    results: List[schemas.MatchCandidate] = []

    for candidate in candidates:
        if not is_profile_visible(candidate):
            continue
        match_count, total, score = compute_match_score(current_user, candidate, criteria_list)
        results.append(
            schemas.MatchCandidate(
                user=candidate,
                match_count=match_count,
                criteria_count=total,
                score=score,
            )
        )

    results.sort(
        key=lambda item: (
            item.match_count,
            item.score,
            item.user.last_active_at or item.user.created_at,
        ),
        reverse=True,
    )

    return schemas.MatchRequestWithResults(request=request, results=results)


@router.post("/requests/{request_id}/send/{user_id}", response_model=schemas.MatchInvite)
def send_match_request(
    *,
    db: Session = Depends(deps.get_db),
    request_id: int,
    user_id: int,
    current_user: models.User = Depends(deps.get_current_user),
) -> Any:
    request = crud.match_request.get(db, request_id=request_id)
    if not request or request.requester_id != current_user.id:
        raise HTTPException(status_code=404, detail="Match request not found.")
    if user_id == current_user.id:
        raise HTTPException(status_code=400, detail="Cannot send a request to yourself.")
    existing = crud.match_invite.get_existing(db, request_id=request_id, target_user_id=user_id)
    if existing:
        return existing
    invite = crud.match_invite.create(
        db,
        request_id=request_id,
        requester_id=current_user.id,
        target_user_id=user_id,
    )
    return invite
