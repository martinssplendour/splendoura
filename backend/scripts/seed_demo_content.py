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
    "Garcia",
    "Hughes",
    "Johnson",
    "Khan",
    "Miller",
    "Nguyen",
    "Patel",
    "Smith",
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

LOCATIONS = [
    ("Cape Town", "South Africa"),
    ("Ibiza", "Spain"),
    ("Lagos", "Nigeria"),
    ("Paris", "France"),
    ("Dubai", "UAE"),
    ("Santorini", "Greece"),
    ("Bali", "Indonesia"),
    ("London", "United Kingdom"),
    ("Barcelona", "Spain"),
    ("New York", "USA"),
    ("Miami", "USA"),
]

GROUP_DESCRIPTION_TEMPLATES = [
    "Demo group for {activity}. Let’s plan something fun together.",
    "Looking for people who love {activity}. Demo group to test the app.",
    "Demo group: {activity} crew. Join if you’re interested!",
]


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


def _openai_image(prompt: str) -> tuple[bytes, str] | None:
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        return None
    model = os.getenv("OPENAI_IMAGE_MODEL", "gpt-image-1")
    payload = {
        "model": model,
        "prompt": prompt,
        "size": "1024x1024",
        "response_format": "b64_json",
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
        response.raise_for_status()
        data = response.json()
        b64 = (data.get("data") or [{}])[0].get("b64_json")
        if not b64:
            return None
        return base64.b64decode(b64), "image/png"
    except Exception:
        return None


def _gemini_image(prompt: str) -> tuple[bytes, str] | None:
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        return None
    model = os.getenv("GEMINI_IMAGE_MODEL", "gemini-2.5-flash-image")
    url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"
    payload = {"contents": [{"parts": [{"text": prompt}]}]}
    headers = {"x-goog-api-key": api_key, "Content-Type": "application/json"}
    try:
        response = httpx.post(url, json=payload, headers=headers, timeout=60.0)
        response.raise_for_status()
        data = response.json()
        candidates = data.get("candidates") or []
        for candidate in candidates:
            parts = (candidate.get("content") or {}).get("parts") or []
            for part in parts:
                inline = part.get("inline_data") or {}
                b64 = inline.get("data")
                mime = inline.get("mime_type") or "image/png"
                if b64:
                    return base64.b64decode(b64), mime
    except Exception:
        return None
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
    return (
        f"Photorealistic portrait of an adult {gender_text}, age {age}, "
        "studio lighting, natural skin texture, high detail, neutral background."
    )


def _group_prompt(activity: str, city: str, country: str) -> str:
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
    provider_mode: str,
    seed_value: int | None,
) -> list[User]:
    if seed_value is not None:
        random.seed(seed_value)
    password = os.getenv("SEED_DEMO_PASSWORD", "splendoura_demo_123")
    created_users: list[User] = []
    round_index = 0

    for _ in range(count):
        gender = _pick_gender(gender_mode)
        first = random.choice(FIRST_NAMES_MALE if gender == Gender.MALE else FIRST_NAMES_FEMALE)
        last = random.choice(LAST_NAMES)
        full_name = f"{first} {last}"
        username = _unique_username(db, f"{first.lower()}{last.lower()}")
        email = f"{username}+demo-{uuid.uuid4().hex[:6]}@seeded.splendoura.local"

        if db.query(User).filter(User.email == email).first():
            continue

        age = _pick_age(min_age, max_age)
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
                continue
            data, content_type = generated
            url, thumb_url = _store_public_image(
                data=data,
                content_type=content_type,
                prefix=f"users/{username}",
                filename=f"{username}-portrait-{index}.png",
            )
            photos.append(url)
            if thumb_url:
                thumbs[url] = thumb_url

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

    return created_users


def seed_demo_groups(
    *,
    db,
    creators: list[User],
    count: int,
    category_mode: str,
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
        activity = random.choice(GROUP_ACTIVITY_TYPES)
        city, country = random.choice(LOCATIONS)
        category = _pick_category(category_mode)
        max_participants = 2 if category == GroupCategory.DATING.value else random.randint(4, 12)
        title = f"{activity.title()} in {city}"
        description = random.choice(GROUP_DESCRIPTION_TEMPLATES).format(activity=activity)

        group = Group(
            creator_id=creator.id,
            title=title,
            description=description,
            activity_type=activity,
            location=f"{city}, {country}",
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
            tags=["demo", activity],
            expectations=["be respectful", "show up on time"],
            offerings=["drinks", "tickets"] if random.random() < 0.5 else ["photos"],
        )
        db.add(group)
        db.flush()

        prompt = _group_prompt(activity, city, country)
        generated = _generate_image(prompt, provider_mode, round_index)
        round_index += 1
        if generated:
            data, content_type = generated
            url, thumb_url = _store_public_image(
                data=data,
                content_type=content_type,
                prefix=f"groups/{group.id}",
                filename=f"group-{group.id}-cover.png",
            )
            media = GroupMedia(
                group_id=group.id,
                uploader_id=creator.id,
                url=url,
                thumb_url=thumb_url,
                media_type=GroupMediaType.IMAGE,
                is_cover=True,
            )
            db.add(media)

        db.commit()
        created += 1

    return created


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
    parser.add_argument("--seed", type=int, default=None, help="Random seed.")
    args = parser.parse_args()

    db = SessionLocal()
    try:
        users = seed_demo_profiles(
            db=db,
            count=args.profiles,
            photos_per_user=args.photos_per_user,
            gender_mode=args.gender,
            min_age=args.age_min,
            max_age=args.age_max,
            provider_mode=args.provider,
            seed_value=args.seed,
        )
        created_groups = seed_demo_groups(
            db=db,
            creators=users,
            count=args.groups,
            category_mode=args.group_category,
            provider_mode=args.provider,
            seed_value=args.seed,
        )
        print(f"Seeded {len(users)} demo profiles and {created_groups} demo groups.")
    finally:
        db.close()


if __name__ == "__main__":
    main()
