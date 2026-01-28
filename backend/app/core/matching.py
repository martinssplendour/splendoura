from __future__ import annotations

import enum
import math
from typing import Any, Iterable

from app.models.user import User


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


def _to_list(value: Any) -> list:
    if value is None:
        return []
    if isinstance(value, list):
        return [item for item in value if item is not None]
    if isinstance(value, str):
        return [item.strip() for item in value.split(",") if item.strip()]
    return [value]


def _to_float(value: Any) -> float | None:
    if value is None:
        return None
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def _normalize_text(value: Any) -> str:
    if isinstance(value, enum.Enum):
        return str(value.value).strip().lower()
    return str(value).strip().lower()


def _get_profile_detail(user: User, key: str) -> Any:
    details = user.profile_details or {}
    return details.get(key)


def _get_discovery_setting(user: User, key: str) -> Any:
    settings = user.discovery_settings or {}
    return settings.get(key)


def _match_range(candidate_value: Any, criteria_value: Any) -> bool:
    candidate = _to_float(candidate_value)
    if candidate is None:
        return False
    if not isinstance(criteria_value, dict):
        return False
    min_value = _to_float(criteria_value.get("min"))
    max_value = _to_float(criteria_value.get("max"))
    if min_value is None and max_value is None:
        return False
    if min_value is not None and candidate < min_value:
        return False
    if max_value is not None and candidate > max_value:
        return False
    return True


def _match_in(candidate_value: Any, criteria_value: Any) -> bool:
    if candidate_value is None:
        return False
    candidates = [_normalize_text(candidate_value)]
    wanted = [_normalize_text(value) for value in _to_list(criteria_value)]
    if not wanted:
        return False
    return any(value in candidates for value in wanted)


def _match_overlap(candidate_value: Any, criteria_value: Any) -> bool:
    candidate_list = [_normalize_text(item) for item in _to_list(candidate_value)]
    wanted = [_normalize_text(item) for item in _to_list(criteria_value)]
    if not candidate_list or not wanted:
        return False
    return bool(set(candidate_list) & set(wanted))


def _match_text(candidate_value: Any, criteria_value: Any) -> bool:
    if candidate_value is None:
        return False
    candidate_text = _normalize_text(candidate_value)
    wanted = [_normalize_text(item) for item in _to_list(criteria_value)]
    if not wanted:
        return False
    return any(value in candidate_text for value in wanted)


def _match_distance(requester: User, candidate: User, criteria_value: Any) -> bool:
    max_km = None
    if isinstance(criteria_value, dict):
        max_km = _to_float(criteria_value.get("km") or criteria_value.get("max_km"))
    else:
        max_km = _to_float(criteria_value)
    if max_km is None:
        return False
    if requester.location_lat is None or requester.location_lng is None:
        return False
    if candidate.location_lat is None or candidate.location_lng is None:
        return False
    distance = _haversine_km(
        requester.location_lat,
        requester.location_lng,
        candidate.location_lat,
        candidate.location_lng,
    )
    return distance <= max_km


def _match_verified(candidate: User, criteria_value: Any) -> bool:
    wanted = _normalize_text(criteria_value)
    if wanted in ("any", "", "all"):
        return True
    is_verified = candidate.verification_status == "verified"
    return is_verified if wanted in ("verified", "true", "yes") else not is_verified


def matches_criterion(requester: User, candidate: User, criterion: dict) -> bool:
    key = str(criterion.get("key") or "")
    value = criterion.get("value")
    if not key:
        return False

    if key == "age_range":
        return _match_range(candidate.age, value)
    if key == "distance_km":
        return _match_distance(requester, candidate, value)
    if key == "height_range":
        return _match_range(_get_profile_detail(candidate, "height_cm"), value)
    if key == "weight_range":
        return _match_range(_get_profile_detail(candidate, "weight_kg"), value)
    if key == "income_range":
        return _match_range(_get_profile_detail(candidate, "income"), value)

    if key == "gender":
        return _match_in(candidate.gender, value)
    if key == "sexual_orientation":
        return _match_in(candidate.sexual_orientation, value)
    if key == "education_level":
        return _match_in(_get_profile_detail(candidate, "education_level"), value)
    if key == "religion":
        return _match_in(_get_profile_detail(candidate, "religion"), value)
    if key == "political_views":
        return _match_in(_get_profile_detail(candidate, "political_views"), value)
    if key == "smoking":
        return _match_in(_get_profile_detail(candidate, "smoking"), value)
    if key == "drinking":
        return _match_in(_get_profile_detail(candidate, "drinking"), value)
    if key == "diet":
        return _match_in(_get_profile_detail(candidate, "diet"), value)
    if key == "sleep_habits":
        return _match_in(_get_profile_detail(candidate, "sleep_habits"), value)
    if key == "social_energy":
        return _match_in(_get_profile_detail(candidate, "social_energy"), value)
    if key == "fitness_level":
        return _match_in(
            _get_profile_detail(candidate, "workout_habits")
            or _get_profile_detail(candidate, "workout"),
            value,
        )
    if key == "relationship_preference":
        return _match_in(_get_profile_detail(candidate, "relationship_preference"), value)
    if key == "casual_dating":
        return _match_in(_get_profile_detail(candidate, "casual_dating"), value)
    if key == "kink_friendly":
        return _match_in(_get_profile_detail(candidate, "kink_friendly"), value)
    if key == "has_children":
        return _match_in(_get_profile_detail(candidate, "has_children"), value)
    if key == "wants_children":
        return _match_in(_get_profile_detail(candidate, "wants_children"), value)
    if key == "personality_type":
        return _match_in(_get_profile_detail(candidate, "personality_type"), value)
    if key == "zodiac_sign":
        return _match_in(_get_profile_detail(candidate, "zodiac_sign"), value)
    if key == "ethnicity":
        return _match_in(_get_profile_detail(candidate, "ethnicity"), value)
    if key == "body_type":
        return _match_in(_get_profile_detail(candidate, "body_type"), value)
    if key == "hair_color":
        return _match_in(_get_profile_detail(candidate, "hair_color"), value)
    if key == "eye_color":
        return _match_in(_get_profile_detail(candidate, "eye_color"), value)
    if key == "income_bracket":
        return _match_in(_get_profile_detail(candidate, "income_bracket"), value)
    if key == "career_field":
        return _match_text(_get_profile_detail(candidate, "job_title"), value) or _match_text(
            _get_profile_detail(candidate, "company"), value
        )
    if key == "location_city":
        return _match_in(candidate.location_city, value)
    if key == "location_country":
        return _match_in(candidate.location_country, value)
    if key == "travel_frequency":
        return _match_in(_get_profile_detail(candidate, "travel_frequency"), value)
    if key == "communication_style":
        return _match_in(_get_profile_detail(candidate, "communication_style"), value)
    if key == "love_languages":
        return _match_overlap(_get_profile_detail(candidate, "love_languages"), value)
    if key == "languages":
        return _match_overlap(_get_profile_detail(candidate, "languages"), value)
    if key == "interests":
        return _match_overlap(candidate.interests, value)
    if key == "pets":
        return _match_overlap(_get_profile_detail(candidate, "pets"), value)
    if key == "availability_windows":
        return _match_overlap(_get_profile_detail(candidate, "availability_windows"), value)
    if key == "verified_status":
        return _match_verified(candidate, value)

    return False


def is_profile_visible(user: User) -> bool:
    if user.deleted_at is not None:
        return False
    visibility = _get_discovery_setting(user, "profile_visibility")
    if visibility is False:
        return False
    if _get_discovery_setting(user, "incognito_mode") is True:
        return False
    return True


def compute_match_score(
    requester: User, candidate: User, criteria: Iterable[dict]
) -> tuple[int, int, float]:
    criteria_list = list(criteria)
    if not criteria_list:
        return 0, 0, 0.0
    match_count = 0
    for criterion in criteria_list:
        if matches_criterion(requester, candidate, criterion):
            match_count += 1
    total = len(criteria_list)
    score = match_count / total if total else 0.0
    return match_count, total, score
