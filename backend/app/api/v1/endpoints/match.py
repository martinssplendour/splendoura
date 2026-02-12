import math
from typing import Any, List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import and_
from sqlalchemy.orm import Session

from app import crud, models, schemas
from app.api import deps
from app.core.matching import compute_match_score, is_profile_visible, _haversine_km

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


def _extract_distance_km(criteria: list[dict]) -> float | None:
    for criterion in criteria:
        if str(criterion.get("key") or "") == "distance_km":
            value = criterion.get("value")
            try:
                return float(value) if value is not None else None
            except (TypeError, ValueError):
                return None
    return None


def _extract_discovery_distance_km(settings: Any) -> float | None:
    if not isinstance(settings, dict):
        return None
    value = settings.get("distance_km")
    try:
        return float(value) if value is not None else None
    except (TypeError, ValueError):
        return None


def _strip_distance_criteria(criteria: list[dict]) -> list[dict]:
    return [criterion for criterion in criteria if str(criterion.get("key") or "") != "distance_km"]


def _apply_distance_filter(
    query,
    *,
    requester: models.User,
    max_km: float,
):
    if requester.location_lat is None or requester.location_lng is None:
        return query
    lat = requester.location_lat
    lng = requester.location_lng
    delta_lat = max_km / 111.0
    cos_lat = math.cos(math.radians(lat))
    delta_lng = max_km / (111.0 * cos_lat) if cos_lat else max_km / 111.0
    return query.filter(
        and_(
            models.User.location_lat.isnot(None),
            models.User.location_lng.isnot(None),
            models.User.location_lat >= lat - delta_lat,
            models.User.location_lat <= lat + delta_lat,
            models.User.location_lng >= lng - delta_lng,
            models.User.location_lng <= lng + delta_lng,
        )
    )


def _apply_match_filters(
    query,
    *,
    criteria: list[dict],
    requester: models.User,
    include_distance: bool = False,
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
        elif key == "distance_km" and include_distance:
            try:
                max_km = float(value) if value is not None else None
            except (TypeError, ValueError):
                max_km = None
            if max_km is not None:
                query = _apply_distance_filter(query, requester=requester, max_km=max_km)
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
    base_query = (
        db.query(models.User)
        .filter(models.User.deleted_at.is_(None), models.User.id != current_user.id)
    )
    base_query = _apply_match_filters(
        base_query,
        criteria=criteria_list,
        requester=current_user,
        include_distance=False,
    )

    discovery = current_user.discovery_settings or {}
    global_mode = bool(discovery.get("global_mode")) if isinstance(discovery, dict) else False
    distance_km_filter = _extract_distance_km(criteria_list)
    distance_km_pref = _extract_discovery_distance_km(discovery)
    distance_km_for_tier = distance_km_filter or distance_km_pref

    candidates: list[models.User] = []
    tier = "global"
    if not global_mode and distance_km_filter and current_user.location_lat is not None and current_user.location_lng is not None:
        query = _apply_distance_filter(base_query, requester=current_user, max_km=distance_km_filter)
        distance_candidates = query.limit(MAX_MATCH_CANDIDATES).all()
        if distance_candidates:
            within_distance = []
            for candidate in distance_candidates:
                if candidate.location_lat is None or candidate.location_lng is None:
                    continue
                distance = _haversine_km(
                    current_user.location_lat,
                    current_user.location_lng,
                    candidate.location_lat,
                    candidate.location_lng,
                )
                if distance <= distance_km_filter:
                    within_distance.append(candidate)
            if within_distance:
                candidates = within_distance
                tier = "distance"
    if not candidates and not global_mode and current_user.location_city:
        candidates = (
            base_query.filter(models.User.location_city == current_user.location_city)
            .limit(MAX_MATCH_CANDIDATES)
            .all()
        )
        if candidates:
            tier = "city"
    if not candidates and not global_mode and current_user.location_country:
        candidates = (
            base_query.filter(models.User.location_country == current_user.location_country)
            .limit(MAX_MATCH_CANDIDATES)
            .all()
        )
        if candidates:
            tier = "country"
    if not candidates:
        candidates = base_query.limit(MAX_MATCH_CANDIDATES).all()
        tier = "global" if distance_km_filter else "mixed"
    results: List[schemas.MatchCandidate] = []

    scoring_criteria = criteria_list
    if tier in {"city", "country", "global"} and distance_km_filter is not None:
        scoring_criteria = _strip_distance_criteria(criteria_list)

    for candidate in candidates:
        if not is_profile_visible(candidate):
            continue
        match_count, total, score = compute_match_score(current_user, candidate, scoring_criteria)
        results.append(
            schemas.MatchCandidate(
                user=candidate,
                match_count=match_count,
                criteria_count=total,
                score=score,
            )
        )

    if tier == "distance" and current_user.location_lat is not None and current_user.location_lng is not None:
        def distance_key(item: schemas.MatchCandidate) -> float:
            if item.user.location_lat is None or item.user.location_lng is None:
                return float("inf")
            return _haversine_km(
                current_user.location_lat,
                current_user.location_lng,
                item.user.location_lat,
                item.user.location_lng,
            )

        results.sort(
            key=lambda item: (
                distance_key(item),
                -item.match_count,
                -item.score,
                item.user.last_active_at or item.user.created_at,
            )
        )
    elif not global_mode:
        user_city = (current_user.location_city or "").strip().lower()
        user_country = (current_user.location_country or "").strip().lower()

        def tier_key(item: schemas.MatchCandidate) -> tuple[int, float]:
            if (
                distance_km_for_tier is not None
                and current_user.location_lat is not None
                and current_user.location_lng is not None
                and item.user.location_lat is not None
                and item.user.location_lng is not None
            ):
                distance = _haversine_km(
                    current_user.location_lat,
                    current_user.location_lng,
                    item.user.location_lat,
                    item.user.location_lng,
                )
                if distance <= distance_km_for_tier:
                    return (0, distance)
            if user_city and (item.user.location_city or "").strip().lower() == user_city:
                return (1, float("inf"))
            if user_country and (item.user.location_country or "").strip().lower() == user_country:
                return (2, float("inf"))
            return (3, float("inf"))

        def tier_sort_key(item: schemas.MatchCandidate) -> tuple:
            tier, distance = tier_key(item)
            return (
                tier,
                distance,
                -item.match_count,
                -item.score,
                item.user.last_active_at or item.user.created_at,
            )

        results.sort(key=tier_sort_key)
    else:
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
