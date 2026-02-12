import argparse
import base64
import os
import random
import uuid
from datetime import datetime, timedelta
from typing import Any

import httpx

from app.core.security import get_password_hash
from app.core.storage import upload_public_image_with_thumbnail
from app.db.session import SessionLocal
from app.models.group import CostType, Group, GroupCategory, GroupStatus, GroupVisibility
from app.models.group_extras import GroupMedia, GroupMediaType
from app.models.user import Gender, User, VerificationStatus


FIRST_NAMES_MALE = [
    "Alex",
    "Daniel",
    "Ethan",
    "Gabriel",
    "James",
    "Leo",
    "Liam",
    "Marcus",
    "Nathan",
    "Oliver",
    "Theo",
    "Victor",
]
FIRST_NAMES_FEMALE = [
    "Ava",
    "Bella",
    "Chloe",
    "Elena",
    "Grace",
    "Hannah",
    "Isla",
    "Luna",
    "Maya",
    "Nora",
    "Sofia",
    "Zoe",
]
LAST_NAMES = [
    "Brown",
    "Carter",
    "Davis",
    "Evans",
    "Hughes",
    "Johnson",
    "Miller",
    "Smith",
    "Taylor",
    "Walker",
    "Wilson",
]

INTERESTS = [
    "travel",
    "foodie",
    "hiking",
    "photography",
    "beach",
    "music",
    "fitness",
    "coffee",
    "art",
    "culture",
    "nightlife",
    "wellness",
]

DEMO_EMAIL_DOMAIN = os.getenv("DEMO_EMAIL_DOMAIN", "demo.splendoure.com")

GROUP_ACTIVITY_TYPES = [
    "vacation",
    "clubbing",
    "outing",
    "date night",
    "hiking",
    "beach day",
    "city tour",
    "food crawl",
    "festival",
    "picnic",
]

GROUP_SCENARIOS = {
    GroupCategory.MUTUAL_BENEFITS.value: [
        {
            "activity": "luxury trip",
            "title": "Luxury getaway to {city}",
            "description": (
                "Mutual benefits: I’m covering flights and a luxury stay in {city}. "
                "Looking for a companion who enjoys great company and is open to a respectful arrangement."
            ),
            "prompt": "luxury hotel, resort lounge, upscale travel",
            "offerings": ["flights", "hotel", "dinner"],
            "expectations": ["mutual respect", "discretion", "great company"],
            "tags": ["luxury", "travel", "arrangement"],
        },
        {
            "activity": "exclusive dinner",
            "title": "Exclusive dinner + city night in {city}",
            "description": (
                "Mutual benefits: I’ll handle an upscale dinner and a night out in {city}. "
                "Seeking a confident companion for an elegant evening and a mutual arrangement."
            ),
            "prompt": "fine dining, skyline, elegant nightlife",
            "offerings": ["dinner", "drinks", "ride"],
            "expectations": ["mutual respect", "style", "discretion"],
            "tags": ["fine dining", "nightlife", "arrangement"],
        },
        {
            "activity": "shopping day",
            "title": "Shopping + spa day in {city}",
            "description": (
                "Mutual benefits: I’ll cover a shopping and spa day in {city}. "
                "Looking for a companion who values a clear, respectful arrangement."
            ),
            "prompt": "luxury shopping, spa day, elegant city",
            "offerings": ["shopping", "spa", "lunch"],
            "expectations": ["mutual respect", "clear expectations"],
            "tags": ["shopping", "spa", "arrangement"],
        },
        {
            "activity": "yacht day",
            "title": "Yacht day on the coast",
            "description": (
                "Mutual benefits: Private yacht day with sunset views. "
                "Seeking a fun companion for a classy day with a mutual arrangement."
            ),
            "prompt": "yacht, ocean, sunset, luxury day",
            "offerings": ["yacht", "drinks", "photos"],
            "expectations": ["mutual respect", "good vibes"],
            "tags": ["yacht", "luxury", "arrangement"],
        },
    ],
    GroupCategory.FRIENDSHIP.value: [
        {
            "activity": "hiking",
            "title": "Hiking crew in {city}",
            "description": (
                "Friendship group: weekend hikes and outdoor adventures. "
                "Costs shared, great company guaranteed."
            ),
            "prompt": "friends hiking, scenic trail, outdoors",
            "offerings": ["shared costs", "snacks"],
            "expectations": ["be respectful", "show up on time"],
            "tags": ["hiking", "outdoors", "friends"],
        },
        {
            "activity": "group trip",
            "title": "Group trip to {city}",
            "description": (
                "Friendship group: planning a group trip with shared costs and shared memories."
            ),
            "prompt": "friends traveling, city exploration, group trip",
            "offerings": ["shared costs", "photos"],
            "expectations": ["be respectful", "share costs"],
            "tags": ["travel", "friends", "group"],
        },
        {
            "activity": "beach day",
            "title": "Beach day squad",
            "description": (
                "Friendship group: beach day, sun, and good vibes. Bring snacks and share costs."
            ),
            "prompt": "friends at beach, sunny day, fun",
            "offerings": ["shared costs", "snacks"],
            "expectations": ["be respectful", "good vibes"],
            "tags": ["beach", "friends"],
        },
        {
            "activity": "food crawl",
            "title": "Food crawl in {city}",
            "description": (
                "Friendship group: try multiple spots in {city}. Everyone pays their share."
            ),
            "prompt": "friends eating, city food crawl, casual dining",
            "offerings": ["shared costs", "photos"],
            "expectations": ["be respectful", "split costs"],
            "tags": ["food", "friends", "city"],
        },
    ],
    GroupCategory.DATING.value: [
        {
            "activity": "date night",
            "title": "Rooftop date night in {city}",
            "description": (
                "Dating group: classy rooftop dinner with views. Let’s keep it fun and respectful."
            ),
            "prompt": "rooftop dinner, city lights, romantic date",
            "offerings": ["dinner", "drinks"],
            "expectations": ["be respectful", "good conversation"],
            "tags": ["dating", "rooftop", "dinner"],
        },
        {
            "activity": "coffee date",
            "title": "Coffee + bookshop date in {city}",
            "description": (
                "Dating group: relaxed coffee date and a bookshop stroll."
            ),
            "prompt": "coffee shop, cozy, romantic casual date",
            "offerings": ["coffee"],
            "expectations": ["be respectful", "good conversation"],
            "tags": ["dating", "coffee", "casual"],
        },
        {
            "activity": "museum date",
            "title": "Museum + gallery date",
            "description": (
                "Dating group: art museum date with a calm vibe and good conversation."
            ),
            "prompt": "art museum, gallery, date night",
            "offerings": ["tickets"],
            "expectations": ["be respectful", "curious vibe"],
            "tags": ["dating", "museum", "art"],
        },
        {
            "activity": "sunset picnic",
            "title": "Sunset picnic in {city}",
            "description": (
                "Dating group: picnic at sunset with a view. Easygoing and romantic."
            ),
            "prompt": "sunset picnic, park, romantic date",
            "offerings": ["snacks"],
            "expectations": ["be respectful", "good vibes"],
            "tags": ["dating", "picnic", "sunset"],
        },
    ],
}

PROFILE_SCENES = [
    "candid outdoor photo, natural light",
    "beach day photo, relaxed vibe",
    "city nightlife photo, stylish outfit",
    "coffee shop photo, casual look",
    "festival photo, colorful background",
    "hiking trail photo, outdoors",
    "gym or fitness photo, athletic look",
    "street style photo, urban background",
    "travel photo with landmarks",
    "club photo with neon lights",
]

PROFILE_SHOTS = [
    "full-body photo",
    "three-quarter body photo",
    "lifestyle portrait",
    "group photo with friends, subject is clearly visible",
]

DEFAULT_LOCATIONS: list[tuple[str, str, float | None, float | None]] = [
    ("Cape Town", "South Africa", -33.9249, 18.4241),
    ("Ibiza", "Spain", 38.9067, 1.4206),
    ("Lagos", "Nigeria", 6.5244, 3.3792),
    ("Paris", "France", 48.8566, 2.3522),
    ("Dubai", "UAE", 25.2048, 55.2708),
    ("Santorini", "Greece", 36.3932, 25.4615),
    ("Bali", "Indonesia", -8.65, 115.2167),
    ("London", "United Kingdom", 51.5074, -0.1278),
    ("Barcelona", "Spain", 41.3874, 2.1686),
    ("New York", "USA", 40.7128, -74.0060),
    ("Miami", "USA", 25.7617, -80.1918),
]

GROUP_DESCRIPTION_TEMPLATES = [
    "Demo group for {activity}. Let’s plan something fun together.",
    "Looking for people who love {activity}. Demo group to test the app.",
    "Demo group: {activity} crew. Join if you’re interested!",
]


def _log_image(message: str) -> None:
    if os.getenv("SEED_DEMO_LOG_IMAGES", "").lower() in {"1", "true", "yes"}:
        print(message)


def _truncate_log(value: str, limit: int = 500) -> str:
    if len(value) <= limit:
        return value
    return f"{value[:limit]}..."


def _unique_username(db, base: str) -> str:
    candidate = base
    counter = 1
    while db.query(User).filter(User.username == candidate).first():
        counter += 1
        candidate = f"{base}{counter}"
    return candidate


def _pick_gender(gender_mode: str) -> Gender:
    if gender_mode == "male":
        return Gender.MALE
    if gender_mode == "female":
        return Gender.FEMALE
    return random.choice([Gender.MALE, Gender.FEMALE])


def _pick_age(min_age: int, max_age: int) -> int:
    min_age = max(min_age, 18)
    max_age = max(max_age, min_age)
    return random.randint(min_age, max_age)


def _pick_category(category_mode: str) -> str:
    if category_mode in {
        GroupCategory.FRIENDSHIP.value,
        GroupCategory.MUTUAL_BENEFITS.value,
        GroupCategory.DATING.value,
    }:
        return category_mode
    return random.choice(
        [
            GroupCategory.FRIENDSHIP.value,
            GroupCategory.MUTUAL_BENEFITS.value,
            GroupCategory.DATING.value,
        ]
    )


def _is_demo_user(user: User) -> bool:
    details = user.profile_details or {}
    if isinstance(details, dict) and details.get("demo_profile") is True:
        return True
    email = (user.email or "").lower()
    if "+demo-" in email or email.endswith(f"@{DEMO_EMAIL_DOMAIN}"):
        return True
    return False


def _is_demo_group(group: Group, demo_user_ids: set[int]) -> bool:
    tags = group.tags or []
    if isinstance(tags, list) and "demo" in tags:
        return True
    return group.creator_id in demo_user_ids


def _split_location(label: str | None) -> tuple[str, str]:
    if not label:
        return "", ""
    parts = [part.strip() for part in label.split(",") if part.strip()]
    if len(parts) >= 2:
        return parts[0], parts[1]
    if parts:
        return parts[0], ""
    return "", ""


def _parse_locations(raw: str | None) -> list[tuple[str, str, float | None, float | None]]:
    if not raw:
        return DEFAULT_LOCATIONS
    fallback = {
        (city.lower(), country.lower()): (lat, lng)
        for city, country, lat, lng in DEFAULT_LOCATIONS
    }
    parsed: list[tuple[str, str, float | None, float | None]] = []
    for entry in raw.split(";"):
        entry = entry.strip()
        if not entry:
            continue
        if "|" in entry:
            parts = [part.strip() for part in entry.split("|")]
        elif "," in entry:
            parts = [part.strip() for part in entry.split(",")]
        else:
            continue
        if len(parts) < 2:
            continue
        city = parts[0]
        country = parts[1]
        lat = None
        lng = None
        if len(parts) >= 4:
            try:
                lat = float(parts[2])
            except (TypeError, ValueError):
                lat = None
            try:
                lng = float(parts[3])
            except (TypeError, ValueError):
                lng = None
        else:
            lat, lng = fallback.get((city.lower(), country.lower()), (None, None))
        if city and country:
            parsed.append((city, country, lat, lng))
    return parsed or DEFAULT_LOCATIONS


def _openai_image(prompt: str) -> tuple[bytes, str] | None:
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        return None
    model = os.getenv("OPENAI_IMAGE_MODEL", "gpt-image-1")
    payload = {
        "model": model,
        "prompt": prompt,
        "size": "1024x1024",
    }
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
    }
    try:
        response = httpx.post(
            "https://api.openai.com/v1/images/generations",
            json=payload,
            headers=headers,
            timeout=60.0,
        )
    except Exception as exc:
        _log_image(f"[openai] request failed: {exc}")
        return None
    if response.status_code >= 400:
        _log_image(
            f"[openai] {response.status_code} {_truncate_log(response.text)}"
        )
        return None
    try:
        data = response.json()
    except Exception as exc:
        _log_image(f"[openai] invalid JSON response: {exc}")
        return None
    entry = (data.get("data") or [{}])[0]
    b64 = entry.get("b64_json")
    if b64:
        return base64.b64decode(b64), "image/png"
    url = entry.get("url")
    if url:
        try:
            image_response = httpx.get(url, timeout=30.0)
            image_response.raise_for_status()
            content_type = image_response.headers.get("Content-Type", "image/png")
            return image_response.content, content_type
        except Exception as exc:
            _log_image(f"[openai] failed to download image url: {exc}")
            return None
    _log_image("[openai] missing image data in response")
    return None


def _gemini_image(prompt: str) -> tuple[bytes, str] | None:
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        return None
    model = os.getenv("GEMINI_IMAGE_MODEL", "gemini-2.5-flash-image")
    url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"
    payload = {
        "contents": [{"parts": [{"text": prompt}]}],
        "generationConfig": {
            "responseModalities": ["IMAGE"],
        },
    }
    headers = {"x-goog-api-key": api_key, "Content-Type": "application/json"}
    try:
        response = httpx.post(url, json=payload, headers=headers, timeout=60.0)
    except Exception as exc:
        _log_image(f"[gemini] request failed: {exc}")
        return None
    if response.status_code >= 400:
        _log_image(
            f"[gemini] {response.status_code} {_truncate_log(response.text)}"
        )
        return None
    try:
        data = response.json()
    except Exception as exc:
        _log_image(f"[gemini] invalid JSON response: {exc}")
        return None
    candidates = data.get("candidates") or []
    for candidate in candidates:
        parts = (candidate.get("content") or {}).get("parts") or []
        for part in parts:
            inline = part.get("inlineData") or part.get("inline_data") or {}
            b64 = inline.get("data")
            mime = inline.get("mimeType") or inline.get("mime_type") or "image/png"
            if b64:
                return base64.b64decode(b64), mime
    _log_image(f"[gemini] missing image data in response: {_truncate_log(str(data))}")
    return None


def _provider_sequence(provider_mode: str) -> list[str]:
    available = []
    if os.getenv("OPENAI_API_KEY"):
        available.append("openai")
    if os.getenv("GEMINI_API_KEY"):
        available.append("gemini")
    if provider_mode in ("openai", "gemini"):
        return [provider_mode] if provider_mode in available else []
    return available


def _generate_image(prompt: str, provider_mode: str, round_index: int) -> tuple[bytes, str] | None:
    providers = _provider_sequence(provider_mode)
    if not providers:
        _log_image("No image providers available (set OPENAI_API_KEY and/or GEMINI_API_KEY).")
        return None
    provider = providers[round_index % len(providers)]
    if provider == "openai":
        return _openai_image(prompt) or (_gemini_image(prompt) if "gemini" in providers else None)
    return _gemini_image(prompt) or (_openai_image(prompt) if "openai" in providers else None)


def _store_public_image(
    *,
    data: bytes,
    content_type: str,
    prefix: str,
    filename: str,
) -> tuple[str, str | None]:
    return upload_public_image_with_thumbnail(
        prefix=prefix,
        filename=filename,
        content_type=content_type,
        data=data,
    )


def _portrait_prompt(gender: Gender, age: int) -> str:
    gender_text = "male" if gender == Gender.MALE else "female"
    scene = random.choice(PROFILE_SCENES)
    shot = random.choice(PROFILE_SHOTS)
    return (
        f"Photorealistic {shot} of an adult {gender_text}, age {age}, {scene}, "
        "natural skin texture, high detail, realistic lighting."
    )


def _group_prompt(activity: str, city: str, country: str, title: str | None = None) -> str:
    if title:
        return (
            f"High-quality photo that matches the group theme '{title}'. "
            f"{activity} setting in {city}, {country}. "
            "Vibrant, inviting, real-life style."
        )
    return (
        f"High-quality photo of a {activity} location in {city}, {country}. "
        "Vibrant, inviting, real-life style."
    )


def seed_demo_profiles(
    *,
    db,
    count: int,
    photos_per_user: int,
    gender_mode: str,
    min_age: int,
    max_age: int,
    locations: list[tuple[str, str, float | None, float | None]],
    provider_mode: str,
    seed_value: int | None,
) -> list[User]:
    if seed_value is not None:
        random.seed(seed_value)
    password = os.getenv("SEED_DEMO_PASSWORD", "splendoura_demo_123")
    created_users: list[User] = []
    created_count = 0
    round_index = 0

    for _ in range(count):
        gender = _pick_gender(gender_mode)
        first = random.choice(FIRST_NAMES_MALE if gender == Gender.MALE else FIRST_NAMES_FEMALE)
        last = random.choice(LAST_NAMES)
        full_name = f"{first} {last}"
        username = _unique_username(db, f"{first.lower()}{last.lower()}")
        email = f"{username}+demo-{uuid.uuid4().hex[:6]}@{DEMO_EMAIL_DOMAIN}"

        if db.query(User).filter(User.email == email).first():
            continue

        age = _pick_age(min_age, max_age)
        city, country, lat, lng = random.choice(locations)
        user = User(
            email=email,
            username=username,
            hashed_password=get_password_hash(password),
            full_name=full_name,
            age=age,
            gender=gender,
            sexual_orientation=random.choice(["straight", "bisexual", "gay", "other"]),
            bio="Demo profile.",
            interests=random.sample(INTERESTS, k=random.randint(3, 6)),
            location_city=city,
            location_country=country,
            location_lat=lat,
            location_lng=lng,
            verification_status=VerificationStatus.VERIFIED,
            verified_at=datetime.utcnow(),
            profile_details={
                "demo_profile": True,
                "demo_label": "Demo profile",
            },
        )

        photos: list[str] = []
        thumbs: dict[str, str] = {}
        for index in range(photos_per_user):
            prompt = _portrait_prompt(gender, age)
            generated = _generate_image(prompt, provider_mode, round_index)
            round_index += 1
            if not generated:
                _log_image(f"[profile:{username}] image generation failed for photo {index + 1}/{photos_per_user}")
                continue
            data, content_type = generated
            try:
                url, thumb_url = _store_public_image(
                    data=data,
                    content_type=content_type,
                    prefix=f"users/{username}",
                    filename=f"{username}-portrait-{index}.png",
                )
            except Exception as exc:
                _log_image(f"[profile:{username}] upload failed for photo {index + 1}/{photos_per_user}: {exc}")
                continue
            photos.append(url)
            if thumb_url:
                thumbs[url] = thumb_url
            _log_image(f"[profile:{username}] uploaded photo {index + 1}/{photos_per_user}: {url}")

        if photos:
            user.profile_image_url = photos[0]
            user.profile_media = {
                "photos": photos,
                "photo_thumbs": thumbs,
                "photo_verified": False,
                "profile_image_thumb_url": thumbs.get(photos[0]) if thumbs else None,
            }

        db.add(user)
        db.commit()
        db.refresh(user)
        created_users.append(user)
        created_count += 1
        print(f"Created demo profile {created_count}/{count}: {user.full_name} (@{user.username})")

    return created_users


def seed_demo_groups(
    *,
    db,
    creators: list[User],
    count: int,
    category_mode: str,
    locations: list[tuple[str, str, float | None, float | None]],
    provider_mode: str,
    seed_value: int | None,
) -> int:
    if seed_value is not None:
        random.seed(seed_value + 1)
    if not creators:
        return 0
    created = 0
    round_index = 0

    for _ in range(count):
        creator = random.choice(creators)
        city, country, lat, lng = random.choice(locations)
        category = _pick_category(category_mode)
        scenario = random.choice(GROUP_SCENARIOS.get(category, [])) if GROUP_SCENARIOS else None
        activity = scenario["activity"] if scenario else random.choice(GROUP_ACTIVITY_TYPES)
        max_participants = 2 if category == GroupCategory.DATING.value else random.randint(4, 12)
        if scenario:
            title = scenario["title"].format(city=city, country=country)
            description = scenario["description"].format(city=city, country=country)
        else:
            title = f"{activity.title()} in {city}"
            description = random.choice(GROUP_DESCRIPTION_TEMPLATES).format(activity=activity)

        group = Group(
            creator_id=creator.id,
            title=title,
            description=description,
            activity_type=activity,
            location=f"{city}, {country}",
            location_lat=lat,
            location_lng=lng,
            destination=city,
            start_date=datetime.utcnow() + timedelta(days=random.randint(3, 60)),
            end_date=datetime.utcnow() + timedelta(days=random.randint(61, 90)),
            min_participants=1,
            max_participants=max_participants,
            category=category,
            cost_type=random.choice(
                [CostType.FREE.value, CostType.SHARED.value, CostType.FULLY_PAID_BY_CREATOR.value]
            ),
            visibility=GroupVisibility.PUBLIC,
            status=GroupStatus.OPEN,
            tags=[activity] + (scenario.get("tags", []) if scenario else []),
            expectations=scenario.get("expectations") if scenario else ["be respectful", "show up on time"],
            offerings=scenario.get("offerings") if scenario else (["drinks", "tickets"] if random.random() < 0.5 else ["photos"]),
        )
        db.add(group)
        db.flush()

        prompt = _group_prompt(activity, city, country, title)
        generated = _generate_image(prompt, provider_mode, round_index)
        round_index += 1
        if generated:
            data, content_type = generated
            try:
                url, thumb_url = _store_public_image(
                    data=data,
                    content_type=content_type,
                    prefix=f"groups/{group.id}",
                    filename=f"group-{group.id}-cover.png",
                )
            except Exception as exc:
                _log_image(f"[group:{group.id}] upload failed: {exc}")
            else:
                media = GroupMedia(
                    group_id=group.id,
                    uploader_id=creator.id,
                    url=url,
                    thumb_url=thumb_url,
                    media_type=GroupMediaType.IMAGE,
                    is_cover=True,
                )
                db.add(media)
                _log_image(f"[group:{group.id}] uploaded cover: {url}")
        else:
            _log_image(f"[group:{group.id}] image generation failed.")

        db.commit()
        created += 1
        print(f"Created demo group {created}/{count}: {group.title}")

    return created


def backfill_demo_profiles(
    *,
    db,
    photos_per_user: int,
    provider_mode: str,
    seed_value: int | None,
) -> int:
    if seed_value is not None:
        random.seed(seed_value + 2)
    updated = 0
    round_index = 0
    users = db.query(User).filter(User.deleted_at.is_(None)).all()
    for user in users:
        if not _is_demo_user(user):
            continue
        media = user.profile_media or {}
        existing_photos = media.get("photos") if isinstance(media, dict) else None
        if existing_photos:
            continue
        gender = user.gender or _pick_gender("random")
        age = user.age or _pick_age(21, 38)
        photos: list[str] = []
        thumbs: dict[str, str] = {}
        for index in range(photos_per_user):
            prompt = _portrait_prompt(gender, age)
            generated = _generate_image(prompt, provider_mode, round_index)
            round_index += 1
            if not generated:
                _log_image(
                    f"[profile:{user.username}] image generation failed for photo {index + 1}/{photos_per_user}"
                )
                continue
            data, content_type = generated
            try:
                url, thumb_url = _store_public_image(
                    data=data,
                    content_type=content_type,
                    prefix=f"users/{user.username or user.id}",
                    filename=f"{user.username or user.id}-portrait-{index}.png",
                )
            except Exception as exc:
                _log_image(
                    f"[profile:{user.username}] upload failed for photo {index + 1}/{photos_per_user}: {exc}"
                )
                continue
            photos.append(url)
            if thumb_url:
                thumbs[url] = thumb_url
            _log_image(
                f"[profile:{user.username}] uploaded photo {index + 1}/{photos_per_user}: {url}"
            )
        if photos:
            user.profile_image_url = photos[0]
            user.profile_media = {
                "photos": photos,
                "photo_thumbs": thumbs,
                "photo_verified": False,
                "profile_image_thumb_url": thumbs.get(photos[0]) if thumbs else None,
            }
            db.add(user)
            db.commit()
            updated += 1
            print(f"Backfilled demo profile media: {user.full_name} (@{user.username})")
    return updated


def backfill_demo_groups(
    *,
    db,
    provider_mode: str,
    seed_value: int | None,
) -> int:
    if seed_value is not None:
        random.seed(seed_value + 3)
    updated = 0
    round_index = 0
    demo_user_ids = {
        user.id for user in db.query(User).filter(User.deleted_at.is_(None)).all() if _is_demo_user(user)
    }
    groups = db.query(Group).filter(Group.deleted_at.is_(None)).all()
    for group in groups:
        if not _is_demo_group(group, demo_user_ids):
            continue
        cover = db.query(GroupMedia).filter(
            GroupMedia.group_id == group.id,
            GroupMedia.is_cover.is_(True),
            GroupMedia.deleted_at.is_(None),
        ).first()
        if cover:
            continue
        activity = group.activity_type or "outing"
        city, country = _split_location(group.location)
        if not city:
            city = "a city"
        if not country:
            country = "a country"
        prompt_detail = group.description or group.title
        prompt = _group_prompt(activity, city, country, prompt_detail)
        generated = _generate_image(prompt, provider_mode, round_index)
        round_index += 1
        if not generated:
            _log_image(f"[group:{group.id}] image generation failed.")
            continue
        data, content_type = generated
        try:
            url, thumb_url = _store_public_image(
                data=data,
                content_type=content_type,
                prefix=f"groups/{group.id}",
                filename=f"group-{group.id}-cover.png",
            )
        except Exception as exc:
            _log_image(f"[group:{group.id}] upload failed: {exc}")
            continue
        media = GroupMedia(
            group_id=group.id,
            uploader_id=group.creator_id,
            url=url,
            thumb_url=thumb_url,
            media_type=GroupMediaType.IMAGE,
            is_cover=True,
        )
        db.add(media)
        db.commit()
        updated += 1
        _log_image(f"[group:{group.id}] uploaded cover: {url}")
        print(f"Backfilled demo group media: {group.title}")
    return updated


def main() -> None:
    parser = argparse.ArgumentParser(description="Seed demo profiles and groups with AI images.")
    parser.add_argument("--profiles", type=int, default=20, help="Number of demo profiles.")
    parser.add_argument("--groups", type=int, default=10, help="Number of demo groups.")
    parser.add_argument(
        "--group-category",
        type=str,
        default="random",
        help="Group category: friendship, mutual_benefits, dating, or random.",
    )
    parser.add_argument(
        "--gender",
        type=str,
        default="random",
        help="Profile gender: male, female, or random.",
    )
    parser.add_argument("--age-min", type=int, default=21, help="Minimum age (18+).")
    parser.add_argument("--age-max", type=int, default=38, help="Maximum age.")
    parser.add_argument(
        "--profile-locations",
        type=str,
        default="",
        help="Semicolon-separated list of City|Country or City|Country|lat|lng for profile locations.",
    )
    parser.add_argument(
        "--photos-per-user",
        type=int,
        default=3,
        help="Profile photos per user.",
    )
    parser.add_argument(
        "--provider",
        type=str,
        default="auto",
        help="Image provider: openai, gemini, or auto.",
    )
    parser.add_argument(
        "--backfill",
        action="store_true",
        help="Backfill missing demo media instead of creating new demo content.",
    )
    parser.add_argument(
        "--backfill-profiles",
        action="store_true",
        help="Backfill demo profile images only.",
    )
    parser.add_argument(
        "--backfill-groups",
        action="store_true",
        help="Backfill demo group cover images only.",
    )
    parser.add_argument("--seed", type=int, default=None, help="Random seed.")
    args = parser.parse_args()

    db = SessionLocal()
    try:
        do_profiles = args.backfill or args.backfill_profiles
        do_groups = args.backfill or args.backfill_groups
        if do_profiles or do_groups:
            updated_profiles = (
                backfill_demo_profiles(
                    db=db,
                    photos_per_user=args.photos_per_user,
                    provider_mode=args.provider,
                    seed_value=args.seed,
                )
                if do_profiles
                else 0
            )
            updated_groups = (
                backfill_demo_groups(
                    db=db,
                    provider_mode=args.provider,
                    seed_value=args.seed,
                )
                if do_groups
                else 0
            )
            print(f"Backfilled demo media: profiles={updated_profiles}, groups={updated_groups}.")
        else:
            location_pool = _parse_locations(args.profile_locations)
            users = seed_demo_profiles(
                db=db,
                count=args.profiles,
                photos_per_user=args.photos_per_user,
                gender_mode=args.gender,
                min_age=args.age_min,
                max_age=args.age_max,
                locations=location_pool,
                provider_mode=args.provider,
                seed_value=args.seed,
            )
            created_groups = seed_demo_groups(
                db=db,
                creators=users,
                count=args.groups,
                category_mode=args.group_category,
                locations=location_pool,
                provider_mode=args.provider,
                seed_value=args.seed,
            )
            print(f"Seeded {len(users)} demo profiles and {created_groups} demo groups.")
    finally:
        db.close()


if __name__ == "__main__":
    main()
