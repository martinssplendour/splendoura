# backend/app/api/v1/endpoints/groups.py
from collections import OrderedDict
from datetime import datetime, timezone
import base64
import json
import math
import os
import time
import uuid
from typing import Any, Dict, List
from fastapi import APIRouter, Body, Depends, File, Form, HTTPException, Response, UploadFile, status
from fastapi.encoders import jsonable_encoder
from sqlalchemy import func
from sqlalchemy.orm import Session

from app import crud, models, schemas
from app.api import deps
from app.core.push import get_group_member_ids, get_push_tokens, send_expo_push
from app.core.storage import (
    normalize_group_image_bytes,
    supabase_public_storage_enabled,
    supabase_storage_enabled,
    upload_bytes_to_supabase,
    upload_public_bytes_to_supabase,
    upload_public_image_with_thumbnail,
)
from app.models.group import AppliesTo, Group, GroupCategory, GroupRequirement, GroupStatus, GroupVisibility
from app.models.group_extras import (
    GroupAvailability,
    GroupAnnouncement,
    GroupMedia,
    GroupMediaType,
    GroupPin,
    GroupPlan,
    GroupPlanRSVP,
    GroupPoll,
    GroupPollOption,
    GroupPollVote,
    RSVPStatus,
)
from app.models.media import MediaBlob
from app.models.membership import JoinStatus, MembershipRole
from app.models.swipe_history import SwipeAction, SwipeHistory, SwipeTargetType

# 1. Initialize the router
router = APIRouter()

GROUP_FEED_CACHE_TTL = int(os.getenv("GROUP_FEED_CACHE_TTL", "600"))
GROUP_FEED_CACHE_MAX = int(os.getenv("GROUP_FEED_CACHE_MAX", "2000"))
_GROUP_FEED_CACHE: OrderedDict[str, tuple[float, list[dict], str | None]] = OrderedDict()


def _cache_key(prefix: str, user_id: int | None, params: dict[str, Any]) -> str:
    parts = [prefix, str(user_id or "anon")]
    for key in sorted(params):
        value = params[key]
        if isinstance(value, list):
            value = ",".join(str(item) for item in value)
        parts.append(f"{key}={value}")
    return "|".join(parts)


def _cache_get(key: str) -> tuple[list[dict], str | None] | None:
    if GROUP_FEED_CACHE_TTL <= 0:
        return None
    # Do not cache personalized discover feeds. They must reflect per-user swipe state immediately,
    # and in-process caching can go stale (and is not shared across multi-worker deployments).
    if key.startswith("discover|"):
        return None
    entry = _GROUP_FEED_CACHE.get(key)
    if not entry:
        return None
    ts, payload, next_cursor = entry
    if time.time() - ts > GROUP_FEED_CACHE_TTL:
        _GROUP_FEED_CACHE.pop(key, None)
        return None
    _GROUP_FEED_CACHE.move_to_end(key)
    return payload, next_cursor


def _cache_set(key: str, payload: list[dict], next_cursor: str | None) -> None:
    if GROUP_FEED_CACHE_TTL <= 0:
        return
    if key.startswith("discover|"):
        return
    _GROUP_FEED_CACHE[key] = (time.time(), payload, next_cursor)
    _GROUP_FEED_CACHE.move_to_end(key)
    while len(_GROUP_FEED_CACHE) > GROUP_FEED_CACHE_MAX:
        _GROUP_FEED_CACHE.popitem(last=False)


def _haversine_km(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    radius_km = 6371.0
    dlat = math.radians(lat2 - lat1)
    dlng = math.radians(lng2 - lng1)
    a = (
        math.sin(dlat / 2) ** 2
        + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlng / 2) ** 2
    )
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return radius_km * c


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _coerce_aware(value: datetime | None) -> datetime | None:
    if value is None:
        return None
    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)
    return value


def _encode_cursor(group: Group) -> str:
    created_at = _coerce_aware(group.created_at)
    payload = {
        "created_at": created_at.isoformat() if created_at else None,
        "id": group.id,
    }
    raw = json.dumps(payload).encode("utf-8")
    return base64.urlsafe_b64encode(raw).decode("utf-8").rstrip("=")


def _decode_cursor(value: str | None) -> tuple[datetime, int] | None:
    if not value:
        return None
    try:
        padded = value + "=" * (-len(value) % 4)
        payload = json.loads(base64.urlsafe_b64decode(padded.encode("utf-8")))
        created_at = payload.get("created_at")
        cursor_id = payload.get("id")
        if not created_at or cursor_id is None:
            return None
        if isinstance(created_at, str):
            created_at = created_at.replace("Z", "+00:00")
            created_at = datetime.fromisoformat(created_at)
        if isinstance(cursor_id, str):
            cursor_id = int(cursor_id)
        if not isinstance(created_at, datetime) or not isinstance(cursor_id, int):
            return None
        if created_at.tzinfo is None:
            created_at = created_at.replace(tzinfo=timezone.utc)
        return created_at, cursor_id
    except Exception:
        return None


def _record_swipe(
    db: Session,
    *,
    user_id: int,
    target_type: SwipeTargetType,
    target_id: int,
    action: SwipeAction,
) -> None:
    existing = (
        db.query(SwipeHistory)
        .filter(
            SwipeHistory.user_id == user_id,
            SwipeHistory.target_type == target_type,
            SwipeHistory.target_id == target_id,
        )
        .first()
    )
    if existing:
        existing.action = action
        db.add(existing)
    else:
        db.add(
            SwipeHistory(
                user_id=user_id,
                target_type=target_type,
                target_id=target_id,
                action=action,
            )
        )
    db.commit()


def _split_location_value(value: str | None) -> tuple[str | None, str | None]:
    if not value:
        return None, None
    parts = [part.strip() for part in value.split(",") if part.strip()]
    if not parts:
        return None, None
    city = parts[0]
    country = parts[-1] if len(parts) > 1 else None
    return city, country


def _sort_groups(groups: list[Group], sort: str | None) -> list[Group]:
    if sort == "recent":
        min_dt = datetime.min.replace(tzinfo=timezone.utc)
        return sorted(
            groups,
            key=lambda item: _coerce_aware(item.created_at) or min_dt,
            reverse=True,
        )
    if sort == "smart":
        def score(item: Group) -> float:
            remaining = 0
            if item.max_participants and item.approved_members is not None:
                remaining = max(item.max_participants - item.approved_members, 0)
            recency = 0.0
            if item.created_at:
                created_at = _coerce_aware(item.created_at)
                if created_at:
                    delta = _utcnow() - created_at
                    recency = max(0.0, 30.0 - delta.days)
            status_bonus = 10.0 if item.status == GroupStatus.OPEN else 0.0
            shared_bonus = len(item.shared_tags or []) * 2.0
            return status_bonus + remaining + recency + shared_bonus

        return sorted(groups, key=score, reverse=True)
    return groups


def _apply_group_lifecycle(group: Group, approved_count: int) -> None:
    end_date = _coerce_aware(group.end_date)
    if end_date and end_date < _utcnow():
        group.status = GroupStatus.COMPLETED
        return
    if group.max_participants and approved_count >= group.max_participants:
        group.status = GroupStatus.FULL


def _attach_group_stats(
    db: Session,
    groups: list[Group],
    *,
    current_user: models.User | None = None,
    lat: float | None = None,
    lng: float | None = None,
    include_labels: bool = False,
) -> None:
    if not groups:
        return
    group_ids = [group.id for group in groups]
    count_rows = (
        db.query(models.Membership.group_id, func.count(models.Membership.id))
        .filter(
            models.Membership.group_id.in_(group_ids),
            models.Membership.join_status == JoinStatus.APPROVED,
            models.Membership.deleted_at.is_(None),
        )
        .group_by(models.Membership.group_id)
        .all()
    )
    approved_counts = {group_id: count for group_id, count in count_rows}

    media_rows = (
        db.query(GroupMedia)
        .filter(
            GroupMedia.group_id.in_(group_ids),
            GroupMedia.deleted_at.is_(None),
        )
        .order_by(GroupMedia.is_cover.desc(), GroupMedia.created_at.asc())
        .all()
    )
    cover_map: dict[int, GroupMedia] = {}
    for media in media_rows:
        if media.group_id not in cover_map:
            cover_map[media.group_id] = media

    user_interests = set(current_user.interests or []) if current_user else set()
    for group in groups:
        approved_count = approved_counts.get(group.id, 0)
        _apply_group_lifecycle(group, approved_count)
        group.approved_members = approved_count
        cover = cover_map.get(group.id)
        group.cover_image_url = (cover.thumb_url or cover.url) if cover else None
        if include_labels and current_user:
            group_tags = set(group.tags or [])
            group.shared_tags = list(user_interests.intersection(group_tags))
            distance_km = None
            if (
                lat is not None
                and lng is not None
                and group.location_lat is not None
                and group.location_lng is not None
            ):
                distance_km = _haversine_km(lat, lng, group.location_lat, group.location_lng)
            labels = _build_discovery_labels(
                group=group,
                distance_km=distance_km,
                shared_tags=group.shared_tags,
            )
            group.discovery_labels = labels
            if labels:
                group.discovery_reason = " · ".join(labels)


def _require_group_member(db: Session, *, group_id: int, user_id: int) -> None:
    group = crud.group.get(db, id=group_id)
    if group and group.creator_id == user_id:
        return
    membership = db.query(models.Membership).filter(
        models.Membership.group_id == group_id,
        models.Membership.user_id == user_id,
        models.Membership.join_status == JoinStatus.APPROVED,
        models.Membership.deleted_at.is_(None),
    ).first()
    if not membership:
        raise HTTPException(status_code=403, detail="You must be an approved member to perform this action.")


@router.get("/", response_model=List[schemas.Group])
def read_groups(
    response: Response,
    db: Session = Depends(deps.get_db),
    creator_id: int | None = None,
    location: str | None = None,
    activity_type: str | None = None,
    category: str | None = None,
    cost_type: str | None = None,
    tags: str | None = None,
    search: str | None = None,
    lat: float | None = None,
    lng: float | None = None,
    radius_km: float | None = None,
    sort: str | None = "smart",
    gender: str | None = None,
    min_age: int | None = None,
    max_age: int | None = None,
    start_date: datetime | None = None,
    end_date: datetime | None = None,
    cursor: str | None = None,
    skip: int = 0,
    limit: int = 50,
) -> Any:
    """Retrieve groups."""
    tag_list = [t.strip() for t in tags.split(",")] if tags else None
    cursor_payload = _decode_cursor(cursor)
    page_limit = max(1, limit)
    fetch_limit = page_limit + 1
    cache_params = {
        "creator_id": creator_id,
        "location": location,
        "activity_type": activity_type,
        "category": category,
        "cost_type": cost_type,
        "tags": tag_list or [],
        "search": search,
        "lat": lat,
        "lng": lng,
        "radius_km": radius_km,
        "sort": sort,
        "gender": gender,
        "min_age": min_age,
        "max_age": max_age,
        "start_date": start_date.isoformat() if start_date else None,
        "end_date": end_date.isoformat() if end_date else None,
        "cursor": cursor or "",
        "limit": page_limit,
        "skip": skip if cursor_payload is None else 0,
    }
    cache_key = _cache_key("groups", None, cache_params)
    cached = _cache_get(cache_key)
    if cached:
        payload, cached_cursor = cached
        if cached_cursor:
            response.headers["X-Next-Cursor"] = cached_cursor
        return payload
    groups = crud.group.get_multi_filtered(
        db,
        creator_id=creator_id,
        exclude_direct=True,
        location=location,
        activity_type=activity_type,
        category=category,
        cost_type=cost_type,
        tags=tag_list,
        search=search,
        gender=gender,
        min_age=min_age,
        max_age=max_age,
        start_date=start_date,
        end_date=end_date,
        cursor=cursor_payload,
        skip=skip if cursor_payload is None else 0,
        limit=fetch_limit,
    )
    has_more = len(groups) > page_limit
    page_groups = groups[:page_limit]
    next_cursor = _encode_cursor(page_groups[-1]) if has_more and page_groups else None
    groups = page_groups
    if lat is not None and lng is not None and radius_km is not None:
        filtered = []
        for group in groups:
            if group.location_lat is None or group.location_lng is None:
                continue
            distance = _haversine_km(lat, lng, group.location_lat, group.location_lng)
            if distance <= radius_km:
                filtered.append(group)
        groups = filtered
    _attach_group_stats(db, groups)
    if sort == "recent":
        min_dt = datetime.min.replace(tzinfo=timezone.utc)
        groups = sorted(
            groups,
            key=lambda item: _coerce_aware(item.created_at) or min_dt,
            reverse=True,
        )
    elif sort == "smart":
        def score(item: Group) -> float:
            remaining = 0
            if item.max_participants and item.approved_members is not None:
                remaining = max(item.max_participants - item.approved_members, 0)
            recency = 0.0
            if item.created_at:
                created_at = _coerce_aware(item.created_at)
                if created_at:
                    delta = _utcnow() - created_at
                    recency = max(0.0, 30.0 - delta.days)
            status_bonus = 10.0 if item.status == GroupStatus.OPEN else 0.0
            return status_bonus + remaining + recency
        groups = sorted(groups, key=score, reverse=True)
    if next_cursor:
        response.headers["X-Next-Cursor"] = next_cursor
    _cache_set(cache_key, jsonable_encoder(groups), next_cursor)
    return groups

@router.post("/", response_model=schemas.Group, dependencies=[Depends(deps.rate_limit)])
def create_group(
    *,
    db: Session = Depends(deps.get_db),
    group_in: schemas.GroupCreate,
    current_user: models.User = Depends(deps.get_current_user),
) -> Any:
    """Create new group."""
    if not current_user.profile_image_url:
        raise HTTPException(status_code=403, detail="Upload a profile photo before creating a group.")
    if group_in.min_participants < 1:
        raise HTTPException(status_code=400, detail="Minimum participants must be at least 1.")
    if group_in.max_participants < group_in.min_participants:
        raise HTTPException(status_code=400, detail="Max participants must be >= min participants.")
    if group_in.category == GroupCategory.DATING and group_in.max_participants != 2:
        raise HTTPException(status_code=400, detail="Dating groups must have max participants set to 2.")
    group = crud.group.create_with_owner(db, obj_in=group_in, owner_id=current_user.id)
    crud.membership.create(
        db,
        obj_in=schemas.MembershipCreate(
            user_id=current_user.id,
            group_id=group.id,
            role=MembershipRole.CREATOR,
            join_status=JoinStatus.APPROVED,
        ),
    )
    return group

@router.get("/discover", response_model=List[schemas.Group])
def discover_groups(
    response: Response,
    db: Session = Depends(deps.get_db),
    current_user: models.User = Depends(deps.get_current_verified_user),
    location: str | None = None,
    activity_type: str | None = None,
    category: str | None = None,
    cost_type: str | None = None,
    creator_verified: bool | None = None,
    tags: str | None = None,
    search: str | None = None,
    lat: float | None = None,
    lng: float | None = None,
    radius_km: float | None = None,
    sort: str | None = "smart",
    cursor: str | None = None,
    skip: int = 0,
    limit: int = 50,
) -> Any:
    discovery = current_user.discovery_settings or {}
    global_mode = bool(discovery.get("global_mode")) if isinstance(discovery, dict) else False
    distance_pref_km = None
    if isinstance(discovery, dict):
        value = discovery.get("distance_km")
        try:
            distance_pref_km = float(value) if value is not None else None
        except (TypeError, ValueError):
            distance_pref_km = None
    effective_lat = lat if lat is not None else current_user.location_lat
    effective_lng = lng if lng is not None else current_user.location_lng

    tag_list = [t.strip() for t in tags.split(",")] if tags else None
    cursor_payload = _decode_cursor(cursor)
    page_limit = max(1, limit)
    fetch_limit = page_limit + 1
    cache_params = {
        "location": location,
        "activity_type": activity_type,
        "category": category,
        "cost_type": cost_type,
        "creator_verified": creator_verified,
        "tags": tag_list or [],
        "search": search,
        "lat": effective_lat,
        "lng": effective_lng,
        "radius_km": radius_km,
        "sort": sort,
        "cursor": cursor or "",
        "limit": page_limit,
        "skip": skip if cursor_payload is None else 0,
        "global_mode": global_mode,
        "distance_pref_km": distance_pref_km,
    }
    cache_key = _cache_key("discover", current_user.id, cache_params)
    cached = _cache_get(cache_key)
    if cached:
        payload, cached_cursor = cached
        if cached_cursor:
            response.headers["X-Next-Cursor"] = cached_cursor
        return payload
    groups = crud.group.get_multi_filtered(
        db,
        location=location,
        activity_type=activity_type,
        category=category,
        cost_type=cost_type,
        tags=tag_list,
        search=search,
        exclude_direct=True,
        exclude_swipe_user_id=current_user.id,
        exclude_creator_id=current_user.id,
        cursor=cursor_payload,
        skip=skip if cursor_payload is None else 0,
        limit=fetch_limit,
    )
    has_more = len(groups) > page_limit
    page_groups = groups[:page_limit]
    next_cursor = _encode_cursor(page_groups[-1]) if has_more and page_groups else None
    groups = page_groups
    if creator_verified is not None and groups:
        creator_ids = {group.creator_id for group in groups}
        creators = db.query(models.User).filter(
            models.User.id.in_(creator_ids),
            models.User.deleted_at.is_(None),
        ).all()
        creator_map = {creator.id: creator for creator in creators}
        filtered_groups: list[models.Group] = []
        for group in groups:
            creator = creator_map.get(group.creator_id)
            is_verified = bool((creator.profile_details or {}).get("id_verified")) if creator else False
            if creator_verified and not is_verified:
                continue
            if creator_verified is False and is_verified:
                continue
            filtered_groups.append(group)
        groups = filtered_groups
    user_interests = set(current_user.interests or [])
    if effective_lat is not None and effective_lng is not None and radius_km is not None:
        filtered = []
        for group in groups:
            if group.location_lat is None or group.location_lng is None:
                continue
            distance = _haversine_km(effective_lat, effective_lng, group.location_lat, group.location_lng)
            if distance <= radius_km:
                filtered.append(group)
        groups = filtered
    _attach_group_stats(
        db,
        groups,
        current_user=current_user,
        lat=effective_lat,
        lng=effective_lng,
        include_labels=True,
    )
    if not global_mode and radius_km is None:
        user_city = (current_user.location_city or "").strip().lower()
        user_country = (current_user.location_country or "").strip().lower()
        distance_groups: list[Group] = []
        city_groups: list[Group] = []
        country_groups: list[Group] = []
        rest_groups: list[Group] = []
        for group in groups:
            if (
                distance_pref_km is not None
                and effective_lat is not None
                and effective_lng is not None
                and group.location_lat is not None
                and group.location_lng is not None
            ):
                distance = _haversine_km(effective_lat, effective_lng, group.location_lat, group.location_lng)
                if distance <= distance_pref_km:
                    distance_groups.append(group)
                    continue
            group_city, group_country = _split_location_value(group.location)
            if user_city and group_city and group_city.strip().lower() == user_city:
                city_groups.append(group)
                continue
            if user_country and group_country and group_country.strip().lower() == user_country:
                country_groups.append(group)
                continue
            rest_groups.append(group)
        groups = (
            _sort_groups(distance_groups, sort)
            + _sort_groups(city_groups, sort)
            + _sort_groups(country_groups, sort)
            + _sort_groups(rest_groups, sort)
        )
    else:
        groups = _sort_groups(groups, sort)
    if next_cursor:
        response.headers["X-Next-Cursor"] = next_cursor
    _cache_set(cache_key, jsonable_encoder(groups), next_cursor)
    return groups

@router.get("/{id}", response_model=schemas.Group)
def read_group(
    *,
    db: Session = Depends(deps.get_db),
    id: int,
) -> Any:
    """Get group by ID."""
    group = crud.group.get(db, id=id)
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")
    approved_count = (
        db.query(models.Membership)
        .filter(
            models.Membership.group_id == group.id,
            models.Membership.join_status == JoinStatus.APPROVED,
            models.Membership.deleted_at.is_(None),
        )
        .count()
    )
    _apply_group_lifecycle(group, approved_count)
    group.approved_members = approved_count
    cover = db.query(GroupMedia).filter(
        GroupMedia.group_id == group.id,
        GroupMedia.is_cover.is_(True),
        GroupMedia.deleted_at.is_(None),
    ).first()
    if not cover:
        cover = db.query(GroupMedia).filter(
            GroupMedia.group_id == group.id,
            GroupMedia.deleted_at.is_(None),
        ).first()
    group.cover_image_url = (cover.thumb_url or cover.url) if cover else None
    return group


@router.post("/{id}/swipe", dependencies=[Depends(deps.rate_limit)])
def record_group_swipe(
    *,
    db: Session = Depends(deps.get_db),
    id: int,
    swipe_in: schemas.SwipeCreate = Body(...),
    current_user: models.User = Depends(deps.get_current_user),
) -> Any:
    group = crud.group.get(db, id=id)
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")
    _record_swipe(
        db,
        user_id=current_user.id,
        target_type=SwipeTargetType.GROUP,
        target_id=id,
        action=swipe_in.action,
    )
    return {"msg": "Swipe recorded"}


@router.delete("/{id}/swipe", dependencies=[Depends(deps.rate_limit)])
def undo_group_swipe(
    *,
    db: Session = Depends(deps.get_db),
    id: int,
    current_user: models.User = Depends(deps.get_current_user),
) -> Any:
    group = crud.group.get(db, id=id)
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")
    swipe = (
        db.query(SwipeHistory)
        .filter(
            SwipeHistory.user_id == current_user.id,
            SwipeHistory.target_type == SwipeTargetType.GROUP,
            SwipeHistory.target_id == id,
        )
        .first()
    )
    if swipe:
        db.delete(swipe)
        db.commit()
    return {"msg": "Swipe removed"}

@router.get("/{id}/approved-members", response_model=List[schemas.User])
def list_approved_members(
    *,
    db: Session = Depends(deps.get_db),
    id: int,
    current_user: models.User = Depends(deps.get_current_user),
) -> Any:
    group = crud.group.get(db, id=id)
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")
    members = (
        db.query(models.User)
        .join(models.Membership, models.Membership.user_id == models.User.id)
        .filter(
            models.Membership.group_id == id,
            models.Membership.join_status == JoinStatus.APPROVED,
            models.Membership.deleted_at.is_(None),
            models.User.deleted_at.is_(None),
        )
        .all()
    )
    return members

@router.put("/{id}", response_model=schemas.Group, dependencies=[Depends(deps.rate_limit)])
def update_group(
    *,
    db: Session = Depends(deps.get_db),
    id: int,
    group_in: schemas.GroupUpdate,
    current_user: models.User = Depends(deps.get_current_verified_user),
) -> Any:
    group = crud.group.get(db, id=id)
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")
    if group.status != GroupStatus.OPEN:
        raise HTTPException(status_code=403, detail="This group is not open for requests.")
    if group.visibility == GroupVisibility.INVITE_ONLY:
        raise HTTPException(status_code=403, detail="This group is invite-only.")
    if group.creator_id != current_user.id:
        raise HTTPException(status_code=403, detail="Only the creator can update this group")
    update_data = group_in.model_dump(exclude_unset=True)
    next_category = update_data.get("category", group.category)
    next_max = update_data.get("max_participants", group.max_participants)
    if next_category == GroupCategory.DATING and next_max != 2:
        raise HTTPException(status_code=400, detail="Dating groups must have max participants set to 2.")
    requirements = update_data.pop("requirements", None)
    for field, value in update_data.items():
        setattr(group, field, value)
    if requirements is not None:
        group.requirements.clear()
        for req in requirements:
            group.requirements.append(
                GroupRequirement(
                    applies_to=req.applies_to,
                    min_age=req.min_age,
                    max_age=req.max_age,
                    additional_requirements=req.additional_requirements,
                    consent_flags=req.consent_flags,
                )
            )
    db.add(group)
    db.commit()
    db.refresh(group)
    return group

@router.delete("/{id}", dependencies=[Depends(deps.rate_limit)])
def delete_group(
    *,
    db: Session = Depends(deps.get_db),
    id: int,
    current_user: models.User = Depends(deps.get_current_user),
) -> Any:
    group = crud.group.get(db, id=id)
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")
    if group.creator_id != current_user.id:
        raise HTTPException(status_code=403, detail="Only the creator can delete this group")
    group.deleted_at = _utcnow()
    db.add(group)
    db.commit()
    return {"msg": "Group deleted"}

# 2. The corrected Join Request logic
@router.post("/{id}/join", dependencies=[Depends(deps.rate_limit)])
async def request_to_join_group(
    id: int,
    join_in: schemas.JoinRequest = Body(...),
    db: Session = Depends(deps.get_db),
    current_user: models.User = Depends(deps.get_current_user)
):
    """Request to join a group with safety and requirement checks."""
    group = crud.group.get(db, id=id)
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")
    if not current_user.profile_image_url:
        raise HTTPException(status_code=403, detail="Upload a profile photo before requesting to join.")
        
    # Check if user is already a member or has a pending request
    existing_membership = crud.membership.get_by_user_and_group(
        db, user_id=current_user.id, group_id=id
    )
    if existing_membership:
        raise HTTPException(
            status_code=400, 
            detail="You have already requested to join or are a member."
        )

    # Check Gender/Age specific requirements
    gender_value = current_user.gender.value if hasattr(current_user.gender, "value") else current_user.gender
    if group.lock_male and gender_value == "male":
        raise HTTPException(status_code=403, detail="This group is closed to male members.")
    if group.lock_female and gender_value == "female":
        raise HTTPException(status_code=403, detail="This group is closed to female members.")
    req = db.query(GroupRequirement).filter(
        GroupRequirement.group_id == id,
        GroupRequirement.applies_to.in_([gender_value, AppliesTo.ALL]),
        GroupRequirement.deleted_at.is_(None),
    ).first()
    
    if req:
        if not (req.min_age <= current_user.age <= req.max_age):
            raise HTTPException(
                status_code=403, 
                detail=f"Age requirements not met. This group requires ages {req.min_age}-{req.max_age}."
            )

        for key, required in req.consent_flags.items():
            if required and not join_in.consent_flags.get(key):
                raise HTTPException(
                    status_code=403,
                    detail=f"Consent required for: {key}",
                )

    request_message = (join_in.request_message or "").strip()
    if request_message and len(request_message) > 500:
        raise HTTPException(status_code=400, detail="Join message must be 500 characters or less.")
    request_tier = (join_in.request_tier or "like").strip().lower()
    if request_tier not in {"like", "superlike"}:
        request_tier = "like"

    # Create membership with 'requested' status
    crud.membership.create(
        db,
        obj_in=schemas.MembershipCreate(
            group_id=id, 
            user_id=current_user.id, 
            join_status=JoinStatus.REQUESTED,
            request_message=request_message or None,
            request_tier=request_tier,
        )
    )
    _record_swipe(
        db,
        user_id=current_user.id,
        target_type=SwipeTargetType.GROUP,
        target_id=id,
        action=SwipeAction.SUPERLIKE if request_tier == "superlike" else SwipeAction.LIKE,
    )

    creator_tokens = get_push_tokens(db, [group.creator_id])
    if creator_tokens:
        preview = request_message if request_message else "Tap to review their request."
        body = preview if len(preview) <= 120 else f"{preview[:117]}..."
        send_expo_push(
            creator_tokens,
            title=f"New join request for {group.title}",
            body=body,
            data={"type": "join_request", "group_id": id, "user_id": current_user.id},
        )
    
    return {"msg": "Join request sent. Awaiting creator approval."}

@router.post("/{id}/approve/{user_id}", dependencies=[Depends(deps.rate_limit)])
def approve_member(
    *,
    db: Session = Depends(deps.get_db),
    id: int,
    user_id: int,
    current_user: models.User = Depends(deps.get_current_verified_user),
) -> Any:
    group = crud.group.get(db, id=id)
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")
    if group.creator_id != current_user.id:
        raise HTTPException(status_code=403, detail="Only the creator can approve members")
    membership = crud.membership.get_by_user_and_group(db, user_id=user_id, group_id=id)
    if not membership:
        raise HTTPException(status_code=404, detail="Membership request not found")
    crud.membership.update_status(db, membership, JoinStatus.APPROVED)
    approved_count = (
        db.query(models.Membership)
        .filter(
            models.Membership.group_id == id,
            models.Membership.join_status == JoinStatus.APPROVED,
            models.Membership.deleted_at.is_(None),
        )
        .count()
    )
    if group.max_participants and approved_count >= group.max_participants:
        group.status = GroupStatus.FULL
        db.add(group)
        db.commit()
    tokens = get_push_tokens(db, [user_id])
    if tokens:
        send_expo_push(
            tokens,
            title="It's a match!",
            body=f"You've been accepted into {group.title}.",
            data={"type": "join_approved", "group_id": id},
        )
    return {"msg": "Member approved"}


def _build_discovery_labels(
    *,
    group: Group,
    distance_km: float | None,
    shared_tags: list[str] | None,
) -> list[str]:
    labels: list[str] = []
    now = _utcnow()
    updated_at = _coerce_aware(group.updated_at) if group.updated_at else None
    created_at = _coerce_aware(group.created_at) if group.created_at else None
    if updated_at and (now - updated_at).total_seconds() <= 60 * 60 * 3:
        labels.append("Active now")
    if distance_km is not None and distance_km <= 25:
        labels.append("Near you")
    if created_at and (now - created_at).days <= 7:
        labels.append("New in your area" if distance_km is not None else "New")
    if shared_tags:
        labels.append("Similar interests")
    return labels

@router.post("/{id}/reject/{user_id}", dependencies=[Depends(deps.rate_limit)])
def reject_member(
    *,
    db: Session = Depends(deps.get_db),
    id: int,
    user_id: int,
    current_user: models.User = Depends(deps.get_current_verified_user),
) -> Any:
    group = crud.group.get(db, id=id)
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")
    if group.creator_id != current_user.id:
        raise HTTPException(status_code=403, detail="Only the creator can reject members")
    membership = crud.membership.get_by_user_and_group(db, user_id=user_id, group_id=id)
    if not membership:
        raise HTTPException(status_code=404, detail="Membership request not found")
    crud.membership.update_status(db, membership, JoinStatus.REJECTED)
    return {"msg": "Member rejected"}

@router.get("/{id}/members", response_model=List[schemas.Membership])
def list_group_members(
    *,
    db: Session = Depends(deps.get_db),
    id: int,
    current_user: models.User = Depends(deps.get_current_verified_user),
) -> Any:
    group = crud.group.get(db, id=id)
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")
    if group.creator_id != current_user.id:
        raise HTTPException(status_code=403, detail="Only the creator can view members")
    return crud.membership.list_members_by_group(db, group_id=id)

@router.post("/{id}/leave", dependencies=[Depends(deps.rate_limit)])
def leave_group(
    *,
    db: Session = Depends(deps.get_db),
    id: int,
    current_user: models.User = Depends(deps.get_current_verified_user),
) -> Any:
    membership = crud.membership.get_by_user_and_group(db, user_id=current_user.id, group_id=id)
    if not membership:
        raise HTTPException(status_code=404, detail="Membership not found")
    membership.deleted_at = _utcnow()
    db.add(membership)
    db.commit()
    return {"msg": "Left group"}

@router.post("/{id}/remove/{user_id}", dependencies=[Depends(deps.rate_limit)])
def remove_member(
    *,
    db: Session = Depends(deps.get_db),
    id: int,
    user_id: int,
    current_user: models.User = Depends(deps.get_current_verified_user),
) -> Any:
    group = crud.group.get(db, id=id)
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")
    if group.creator_id != current_user.id:
        raise HTTPException(status_code=403, detail="Only the creator can remove members")
    membership = crud.membership.get_by_user_and_group(db, user_id=user_id, group_id=id)
    if not membership:
        raise HTTPException(status_code=404, detail="Membership not found")
    membership.deleted_at = _utcnow()
    membership.join_status = JoinStatus.REJECTED
    db.add(membership)
    db.commit()
    return {"msg": "Member removed"}


@router.get("/{id}/media", response_model=List[schemas.GroupMedia])
def list_group_media(
    *,
    db: Session = Depends(deps.get_db),
    id: int,
) -> Any:
    return (
        db.query(GroupMedia)
        .filter(GroupMedia.group_id == id, GroupMedia.deleted_at.is_(None))
        .order_by(GroupMedia.created_at.asc())
        .all()
    )


@router.post("/{id}/media", response_model=schemas.GroupMedia, dependencies=[Depends(deps.rate_limit)])
def upload_group_media(
    *,
    db: Session = Depends(deps.get_db),
    id: int,
    file: UploadFile = File(...),
    is_cover: bool = Form(default=False),
    current_user: models.User = Depends(deps.get_current_verified_user),
) -> Any:
    group = crud.group.get(db, id=id)
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")
    if group.creator_id != current_user.id:
        raise HTTPException(status_code=403, detail="Only the creator can upload media")
    content_type = file.content_type or ""
    if not (content_type.startswith("image/") or content_type.startswith("video/")):
        raise HTTPException(status_code=400, detail="Only image or video uploads are allowed.")
    file_bytes = file.file.read()
    media_type = GroupMediaType.VIDEO if content_type.startswith("video/") else GroupMediaType.IMAGE
    upload_filename = file.filename
    if media_type == GroupMediaType.IMAGE:
        try:
            file_bytes, content_type = normalize_group_image_bytes(file_bytes, target_size=1024)
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid image file.")
        stem = os.path.splitext(file.filename or "group-image")[0] or "group-image"
        upload_filename = f"{stem}.jpg"
    if is_cover:
        db.query(GroupMedia).filter(
            GroupMedia.group_id == id,
            GroupMedia.is_cover.is_(True),
            GroupMedia.deleted_at.is_(None),
        ).update({GroupMedia.is_cover: False})
    thumb_url = None
    if supabase_public_storage_enabled():
        if media_type == GroupMediaType.IMAGE:
            url, thumb_url = upload_public_image_with_thumbnail(
                prefix=f"groups/{id}",
                filename=upload_filename,
                content_type=content_type,
                data=file_bytes,
            )
        else:
            url = upload_public_bytes_to_supabase(
                prefix=f"groups/{id}",
                filename=upload_filename,
                content_type=content_type,
                data=file_bytes,
            )
    elif supabase_storage_enabled():
        url = upload_bytes_to_supabase(
            prefix=f"groups/{id}",
            filename=upload_filename,
            content_type=content_type,
            data=file_bytes,
            public=False,
        )
    elif media_type == GroupMediaType.IMAGE:
        blob = MediaBlob(
            content_type=content_type or "image/jpeg",
            filename=upload_filename,
            data=file_bytes,
            created_by=current_user.id,
        )
        db.add(blob)
        db.flush()
        url = f"/api/v1/media/{blob.id}"
    else:
        uploads_dir = os.path.join(os.getcwd(), "uploads", "groups")
        os.makedirs(uploads_dir, exist_ok=True)
        ext = os.path.splitext(upload_filename or "")[1] or ".bin"
        filename = f"{uuid.uuid4().hex}{ext}"
        filepath = os.path.join(uploads_dir, filename)
        with open(filepath, "wb") as buffer:
            buffer.write(file_bytes)
        url = f"/uploads/groups/{filename}"
    media = GroupMedia(
        group_id=id,
        uploader_id=current_user.id,
        url=url,
        thumb_url=thumb_url,
        media_type=media_type,
        is_cover=is_cover,
    )
    db.add(media)
    db.commit()
    db.refresh(media)
    return media


@router.delete("/{id}/media/{media_id}", dependencies=[Depends(deps.rate_limit)])
def delete_group_media(
    *,
    db: Session = Depends(deps.get_db),
    id: int,
    media_id: int,
    current_user: models.User = Depends(deps.get_current_verified_user),
) -> Any:
    group = crud.group.get(db, id=id)
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")
    if group.creator_id != current_user.id:
        raise HTTPException(status_code=403, detail="Only the creator can delete media")
    media = (
        db.query(GroupMedia)
        .filter(
            GroupMedia.id == media_id,
            GroupMedia.group_id == id,
            GroupMedia.deleted_at.is_(None),
        )
        .first()
    )
    if not media:
        raise HTTPException(status_code=404, detail="Media not found")
    if media.url and media.url.startswith("/api/v1/media/"):
        try:
            blob_id = int(media.url.split("/api/v1/media/")[1])
            blob = db.query(MediaBlob).filter(MediaBlob.id == blob_id).first()
            if blob:
                blob.deleted_at = _utcnow()
                db.add(blob)
        except (ValueError, IndexError):
            pass
    media.deleted_at = _utcnow()
    media.is_cover = False
    db.add(media)
    db.commit()
    return {"msg": "Media removed"}


@router.get("/{id}/availability", response_model=List[schemas.GroupAvailability])
def list_group_availability(
    *,
    db: Session = Depends(deps.get_db),
    id: int,
    current_user: models.User = Depends(deps.get_current_verified_user),
) -> Any:
    _require_group_member(db, group_id=id, user_id=current_user.id)
    return (
        db.query(GroupAvailability)
        .filter(GroupAvailability.group_id == id, GroupAvailability.deleted_at.is_(None))
        .order_by(GroupAvailability.day_of_week.asc())
        .all()
    )


@router.post("/{id}/availability", response_model=List[schemas.GroupAvailability], dependencies=[Depends(deps.rate_limit)])
def set_group_availability(
    *,
    db: Session = Depends(deps.get_db),
    id: int,
    slots: List[schemas.GroupAvailabilityCreate] = Body(...),
    current_user: models.User = Depends(deps.get_current_verified_user),
) -> Any:
    _require_group_member(db, group_id=id, user_id=current_user.id)
    db.query(GroupAvailability).filter(
        GroupAvailability.group_id == id,
        GroupAvailability.deleted_at.is_(None),
    ).update({GroupAvailability.deleted_at: _utcnow()})
    created = []
    for slot in slots:
        record = GroupAvailability(
            group_id=id,
            day_of_week=slot.day_of_week,
            slot=slot.slot,
            created_by=current_user.id,
        )
        db.add(record)
        created.append(record)
    db.commit()
    for record in created:
        db.refresh(record)
    return created


@router.get("/{id}/plans", response_model=List[schemas.GroupPlan])
def list_group_plans(
    *,
    db: Session = Depends(deps.get_db),
    id: int,
    current_user: models.User = Depends(deps.get_current_verified_user),
) -> Any:
    _require_group_member(db, group_id=id, user_id=current_user.id)
    return (
        db.query(GroupPlan)
        .filter(GroupPlan.group_id == id, GroupPlan.deleted_at.is_(None))
        .order_by(GroupPlan.created_at.desc())
        .all()
    )


@router.post("/{id}/plans", response_model=schemas.GroupPlan, dependencies=[Depends(deps.rate_limit)])
def create_group_plan(
    *,
    db: Session = Depends(deps.get_db),
    id: int,
    plan_in: schemas.GroupPlanCreate,
    current_user: models.User = Depends(deps.get_current_verified_user),
) -> Any:
    _require_group_member(db, group_id=id, user_id=current_user.id)
    if plan_in.pinned:
        db.query(GroupPlan).filter(
            GroupPlan.group_id == id,
            GroupPlan.pinned.is_(True),
            GroupPlan.deleted_at.is_(None),
        ).update({GroupPlan.pinned: False})
    plan = GroupPlan(
        group_id=id,
        title=plan_in.title,
        details=plan_in.details,
        scheduled_at=plan_in.scheduled_at,
        location_name=plan_in.location_name,
        location_lat=plan_in.location_lat,
        location_lng=plan_in.location_lng,
        pinned=plan_in.pinned,
        created_by=current_user.id,
    )
    db.add(plan)
    db.commit()
    db.refresh(plan)
    recipient_ids = [
        user_id for user_id in get_group_member_ids(db, id) if user_id != current_user.id
    ]
    tokens = get_push_tokens(db, recipient_ids)
    if tokens:
        group = crud.group.get(db, id=id)
        send_expo_push(
            tokens,
            title=f"New plan in {group.title if group else 'your group'}",
            body=plan.title,
            data={"type": "plan", "group_id": id, "plan_id": plan.id},
        )
    return plan


@router.post("/{id}/plans/{plan_id}/pin", response_model=schemas.GroupPlan, dependencies=[Depends(deps.rate_limit)])
def pin_group_plan(
    *,
    db: Session = Depends(deps.get_db),
    id: int,
    plan_id: int,
    current_user: models.User = Depends(deps.get_current_verified_user),
) -> Any:
    _require_group_member(db, group_id=id, user_id=current_user.id)
    plan = db.query(GroupPlan).filter(
        GroupPlan.id == plan_id,
        GroupPlan.group_id == id,
        GroupPlan.deleted_at.is_(None),
    ).first()
    if not plan:
        raise HTTPException(status_code=404, detail="Plan not found")
    db.query(GroupPlan).filter(
        GroupPlan.group_id == id,
        GroupPlan.pinned.is_(True),
        GroupPlan.deleted_at.is_(None),
    ).update({GroupPlan.pinned: False})
    plan.pinned = True
    db.add(plan)
    db.commit()
    db.refresh(plan)
    return plan

@router.post("/{id}/plans/{plan_id}/remind", dependencies=[Depends(deps.rate_limit)])
def remind_group_plan(
    *,
    db: Session = Depends(deps.get_db),
    id: int,
    plan_id: int,
    current_user: models.User = Depends(deps.get_current_verified_user),
) -> Any:
    _require_group_member(db, group_id=id, user_id=current_user.id)
    group = crud.group.get(db, id=id)
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")
    if group.creator_id != current_user.id:
        raise HTTPException(status_code=403, detail="Only the creator can send reminders")
    plan = db.query(GroupPlan).filter(
        GroupPlan.id == plan_id,
        GroupPlan.group_id == id,
        GroupPlan.deleted_at.is_(None),
    ).first()
    if not plan:
        raise HTTPException(status_code=404, detail="Plan not found")
    recipient_ids = [
        user_id for user_id in get_group_member_ids(db, id) if user_id != current_user.id
    ]
    tokens = get_push_tokens(db, recipient_ids)
    if tokens:
        send_expo_push(
            tokens,
            title=f"Reminder: {plan.title}",
            body=f"{group.title} · {plan.scheduled_at.isoformat() if plan.scheduled_at else 'Time TBD'}",
            data={"type": "plan_reminder", "group_id": id, "plan_id": plan.id},
        )
    return {"msg": "Reminder sent"}


@router.get("/{id}/plans/rsvps", response_model=Dict[int, schemas.GroupPlanRSVPSummary])
def list_plan_rsvps(
    *,
    db: Session = Depends(deps.get_db),
    id: int,
    current_user: models.User = Depends(deps.get_current_verified_user),
) -> Any:
    _require_group_member(db, group_id=id, user_id=current_user.id)
    plans = (
        db.query(GroupPlan.id)
        .filter(GroupPlan.group_id == id, GroupPlan.deleted_at.is_(None))
        .all()
    )
    plan_ids = [row[0] for row in plans]
    if not plan_ids:
        return {}
    rsvps = (
        db.query(GroupPlanRSVP)
        .filter(
            GroupPlanRSVP.plan_id.in_(plan_ids),
            GroupPlanRSVP.deleted_at.is_(None),
        )
        .all()
    )
    summary: Dict[int, schemas.GroupPlanRSVPSummary] = {
        plan_id: schemas.GroupPlanRSVPSummary() for plan_id in plan_ids
    }
    for rsvp in rsvps:
        entry = summary.get(rsvp.plan_id)
        if not entry:
            continue
        if rsvp.status == RSVPStatus.GOING:
            entry.going += 1
        elif rsvp.status == RSVPStatus.INTERESTED:
            entry.interested += 1
        elif rsvp.status == RSVPStatus.NOT_GOING:
            entry.not_going += 1
        if rsvp.user_id == current_user.id:
            entry.user_status = rsvp.status
    return summary


@router.post("/{id}/plans/{plan_id}/rsvp", response_model=schemas.GroupPlanRSVPSummary, dependencies=[Depends(deps.rate_limit)])
def rsvp_group_plan(
    *,
    db: Session = Depends(deps.get_db),
    id: int,
    plan_id: int,
    rsvp_in: schemas.GroupPlanRSVPCreate,
    current_user: models.User = Depends(deps.get_current_verified_user),
) -> Any:
    _require_group_member(db, group_id=id, user_id=current_user.id)
    plan = db.query(GroupPlan).filter(
        GroupPlan.id == plan_id,
        GroupPlan.group_id == id,
        GroupPlan.deleted_at.is_(None),
    ).first()
    if not plan:
        raise HTTPException(status_code=404, detail="Plan not found")
    group = crud.group.get(db, id=id)
    existing = db.query(GroupPlanRSVP).filter(
        GroupPlanRSVP.plan_id == plan_id,
        GroupPlanRSVP.user_id == current_user.id,
    ).first()
    if existing:
        existing.status = rsvp_in.status
        existing.deleted_at = None
        db.add(existing)
    else:
        db.add(
            GroupPlanRSVP(
                plan_id=plan_id,
                user_id=current_user.id,
                status=rsvp_in.status,
            )
        )
    db.commit()
    if group and group.creator_id != current_user.id:
        tokens = get_push_tokens(db, [group.creator_id])
        if tokens:
            send_expo_push(
                tokens,
                title=f"RSVP update in {group.title}",
                body=f"{current_user.full_name} marked {rsvp_in.status.value.replace('_', ' ')}",
                data={"type": "rsvp", "group_id": id, "plan_id": plan_id},
            )
    return list_plan_rsvps(db=db, id=id, current_user=current_user).get(plan_id, schemas.GroupPlanRSVPSummary())


@router.get("/{id}/announcements", response_model=List[schemas.GroupAnnouncement])
def list_group_announcements(
    *,
    db: Session = Depends(deps.get_db),
    id: int,
    current_user: models.User = Depends(deps.get_current_verified_user),
) -> Any:
    _require_group_member(db, group_id=id, user_id=current_user.id)
    return (
        db.query(GroupAnnouncement)
        .filter(GroupAnnouncement.group_id == id, GroupAnnouncement.deleted_at.is_(None))
        .order_by(GroupAnnouncement.created_at.desc())
        .all()
    )


@router.post("/{id}/announcements", response_model=schemas.GroupAnnouncement, dependencies=[Depends(deps.rate_limit)])
def create_group_announcement(
    *,
    db: Session = Depends(deps.get_db),
    id: int,
    announcement_in: schemas.GroupAnnouncementCreate,
    current_user: models.User = Depends(deps.get_current_verified_user),
) -> Any:
    _require_group_member(db, group_id=id, user_id=current_user.id)
    group = crud.group.get(db, id=id)
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")
    if group.creator_id != current_user.id:
        raise HTTPException(status_code=403, detail="Only the creator can send announcements")
    announcement = GroupAnnouncement(
        group_id=id,
        title=announcement_in.title,
        body=announcement_in.body,
        created_by=current_user.id,
    )
    db.add(announcement)
    db.commit()
    db.refresh(announcement)
    recipient_ids = [
        user_id for user_id in get_group_member_ids(db, id) if user_id != current_user.id
    ]
    tokens = get_push_tokens(db, recipient_ids)
    if tokens:
        send_expo_push(
            tokens,
            title=f"Announcement in {group.title}",
            body=announcement.title,
            data={"type": "announcement", "group_id": id, "announcement_id": announcement.id},
        )
    return announcement


@router.get("/{id}/polls", response_model=List[schemas.GroupPoll])
def list_group_polls(
    *,
    db: Session = Depends(deps.get_db),
    id: int,
    current_user: models.User = Depends(deps.get_current_verified_user),
) -> Any:
    _require_group_member(db, group_id=id, user_id=current_user.id)
    polls = (
        db.query(GroupPoll)
        .filter(GroupPoll.group_id == id, GroupPoll.deleted_at.is_(None))
        .order_by(GroupPoll.created_at.desc())
        .all()
    )
    for poll in polls:
        options = (
            db.query(GroupPollOption)
            .filter(GroupPollOption.poll_id == poll.id, GroupPollOption.deleted_at.is_(None))
            .all()
        )
        for option in options:
            option.vote_count = (
                db.query(GroupPollVote)
                .filter(
                    GroupPollVote.poll_id == poll.id,
                    GroupPollVote.option_id == option.id,
                    GroupPollVote.deleted_at.is_(None),
                )
                .count()
            )
        poll.options = options
    return polls


@router.post("/{id}/polls", response_model=schemas.GroupPoll, dependencies=[Depends(deps.rate_limit)])
def create_group_poll(
    *,
    db: Session = Depends(deps.get_db),
    id: int,
    poll_in: schemas.GroupPollCreate,
    current_user: models.User = Depends(deps.get_current_verified_user),
) -> Any:
    _require_group_member(db, group_id=id, user_id=current_user.id)
    if len(poll_in.options) < 2:
        raise HTTPException(status_code=400, detail="Provide at least two options.")
    poll = GroupPoll(
        group_id=id,
        question=poll_in.question,
        is_multi=poll_in.is_multi,
        closes_at=poll_in.closes_at,
        created_by=current_user.id,
    )
    db.add(poll)
    db.flush()
    for option in poll_in.options:
        db.add(GroupPollOption(poll_id=poll.id, label=option))
    db.commit()
    db.refresh(poll)
    recipient_ids = [
        user_id for user_id in get_group_member_ids(db, id) if user_id != current_user.id
    ]
    tokens = get_push_tokens(db, recipient_ids)
    if tokens:
        group = crud.group.get(db, id=id)
        send_expo_push(
            tokens,
            title=f"New poll in {group.title if group else 'your group'}",
            body=poll.question,
            data={"type": "poll", "group_id": id, "poll_id": poll.id},
        )
    return poll


@router.post("/{id}/polls/{poll_id}/vote", dependencies=[Depends(deps.rate_limit)])
def vote_group_poll(
    *,
    db: Session = Depends(deps.get_db),
    id: int,
    poll_id: int,
    vote_in: schemas.GroupPollVote,
    current_user: models.User = Depends(deps.get_current_verified_user),
) -> Any:
    _require_group_member(db, group_id=id, user_id=current_user.id)
    poll = db.query(GroupPoll).filter(
        GroupPoll.id == poll_id,
        GroupPoll.group_id == id,
        GroupPoll.deleted_at.is_(None),
    ).first()
    if not poll or not poll.is_active:
        raise HTTPException(status_code=404, detail="Poll not found")
    if not poll.is_multi and len(vote_in.option_ids) > 1:
        raise HTTPException(status_code=400, detail="This poll only allows one choice.")
    if not poll.is_multi:
        db.query(GroupPollVote).filter(
            GroupPollVote.poll_id == poll_id,
            GroupPollVote.user_id == current_user.id,
        ).delete()
    for option_id in vote_in.option_ids:
        db.add(GroupPollVote(poll_id=poll_id, option_id=option_id, user_id=current_user.id))
    db.commit()
    return {"msg": "Vote recorded"}


@router.post("/{id}/polls/{poll_id}/close", dependencies=[Depends(deps.rate_limit)])
def close_group_poll(
    *,
    db: Session = Depends(deps.get_db),
    id: int,
    poll_id: int,
    current_user: models.User = Depends(deps.get_current_verified_user),
) -> Any:
    _require_group_member(db, group_id=id, user_id=current_user.id)
    poll = db.query(GroupPoll).filter(
        GroupPoll.id == poll_id,
        GroupPoll.group_id == id,
        GroupPoll.deleted_at.is_(None),
    ).first()
    if not poll:
        raise HTTPException(status_code=404, detail="Poll not found")
    poll.is_active = False
    db.add(poll)
    db.commit()
    return {"msg": "Poll closed"}


@router.get("/{id}/pins", response_model=List[schemas.GroupPin])
def list_group_pins(
    *,
    db: Session = Depends(deps.get_db),
    id: int,
    current_user: models.User = Depends(deps.get_current_verified_user),
) -> Any:
    _require_group_member(db, group_id=id, user_id=current_user.id)
    return (
        db.query(GroupPin)
        .filter(GroupPin.group_id == id, GroupPin.deleted_at.is_(None))
        .order_by(GroupPin.created_at.desc())
        .all()
    )


@router.post("/{id}/pins", response_model=schemas.GroupPin, dependencies=[Depends(deps.rate_limit)])
def create_group_pin(
    *,
    db: Session = Depends(deps.get_db),
    id: int,
    pin_in: schemas.GroupPinCreate,
    current_user: models.User = Depends(deps.get_current_verified_user),
) -> Any:
    _require_group_member(db, group_id=id, user_id=current_user.id)
    pin = GroupPin(
        group_id=id,
        title=pin_in.title,
        description=pin_in.description,
        lat=pin_in.lat,
        lng=pin_in.lng,
        created_by=current_user.id,
    )
    db.add(pin)
    db.commit()
    db.refresh(pin)
    return pin
