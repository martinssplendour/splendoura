import argparse
import io
import os
import random
import re
import uuid
from datetime import datetime
from typing import Any

import httpx
from PIL import Image, ImageEnhance, ImageOps

from app.core.security import get_password_hash
from app.db.session import SessionLocal
from app.models.media import MediaBlob
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
BIOS = [
    "Demo profile for testing the app.",
    "Here to explore new cities and good food.",
    "Travel lover. Always down for a new adventure.",
    "Looking for friendly people to plan trips with.",
    "Planning my next beach escape.",
]
VACATION_KEYWORDS = [
    "beach",
    "mountain",
    "city skyline",
    "coast",
    "island",
    "sunset",
    "travel landscape",
]
PORTRAIT_KEYWORDS_FEMALE = [
    "woman portrait",
    "female portrait",
    "adult woman headshot",
    "smiling woman portrait",
]
PORTRAIT_KEYWORDS_MALE = [
    "man portrait",
    "male portrait",
    "adult man headshot",
    "smiling man portrait",
]


def _slugify(value: str) -> str:
    value = value.lower()
    value = re.sub(r"[^a-z0-9]+", ".", value)
    return value.strip(".") or "user"


def _unique_username(db, base: str) -> str:
    candidate = base
    counter = 1
    while db.query(User).filter(User.username == candidate).first():
        counter += 1
        candidate = f"{base}{counter}"
    return candidate


def _download_image(url: str) -> tuple[bytes, str]:
    response = httpx.get(url, timeout=20.0)
    response.raise_for_status()
    content_type = response.headers.get("Content-Type", "image/jpeg")
    return response.content, content_type


def _fetch_commons_image(keyword: str) -> dict[str, Any] | None:
    params = {
        "action": "query",
        "format": "json",
        "generator": "search",
        "gsrsearch": f"{keyword} filetype:bitmap",
        "gsrlimit": 15,
        "prop": "imageinfo",
        "iiprop": "url|extmetadata",
    }
    try:
        data = httpx.get(
            "https://commons.wikimedia.org/w/api.php", params=params, timeout=15.0
        ).json()
    except Exception:
        return None
    pages = list((data.get("query") or {}).get("pages", {}).values())
    random.shuffle(pages)
    for page in pages:
        imageinfo = (page.get("imageinfo") or [])
        if not imageinfo:
            continue
        info = imageinfo[0]
        meta = info.get("extmetadata") or {}
        license_name = (meta.get("LicenseShortName") or {}).get("value", "")
        license_url = (meta.get("LicenseUrl") or {}).get("value", "")
        if "CC0" in license_name or "Public domain" in license_name:
            return {
                "url": info.get("url"),
                "license": license_name,
                "license_url": license_url,
                "source": "Wikimedia Commons",
            }
    if pages:
        info = (pages[0].get("imageinfo") or [{}])[0]
        return {
            "url": info.get("url"),
            "license": "Unknown",
            "license_url": "",
            "source": "Wikimedia Commons",
        }
    return None


def _fetch_commons_portrait(gender: Gender) -> dict[str, Any] | None:
    keywords = PORTRAIT_KEYWORDS_MALE if gender == Gender.MALE else PORTRAIT_KEYWORDS_FEMALE
    random.shuffle(keywords)
    for keyword in keywords:
        meta = _fetch_commons_image(keyword)
        if meta and meta.get("url"):
            return meta
    return None


def _fetch_avatar(seed: str) -> dict[str, Any] | None:
    url = f"https://api.dicebear.com/9.x/adventurer/png?seed={seed}"
    return {
        "url": url,
        "license": "DiceBear",
        "license_url": "https://www.dicebear.com/license/",
        "source": "DiceBear",
    }


def _store_media(db, image_bytes: bytes, content_type: str, filename: str) -> str:
    blob = MediaBlob(
        content_type=content_type or "image/jpeg",
        filename=filename,
        data=image_bytes,
    )
    db.add(blob)
    db.flush()
    return f"/api/v1/media/{blob.id}"


def _augment_image(image_bytes: bytes) -> tuple[bytes, str] | None:
    try:
        image = Image.open(io.BytesIO(image_bytes)).convert("RGB")
    except Exception:
        return None
    width, height = image.size
    if width < 80 or height < 80:
        return None
    if random.random() < 0.5:
        image = ImageOps.mirror(image)
    crop_scale = random.uniform(0.85, 1.0)
    crop_w = int(width * crop_scale)
    crop_h = int(height * crop_scale)
    if crop_w > 0 and crop_h > 0 and crop_w < width and crop_h < height:
        left = random.randint(0, width - crop_w)
        top = random.randint(0, height - crop_h)
        image = image.crop((left, top, left + crop_w, top + crop_h)).resize((width, height))
    image = ImageEnhance.Brightness(image).enhance(random.uniform(0.9, 1.1))
    image = ImageEnhance.Contrast(image).enhance(random.uniform(0.9, 1.1))
    image = ImageEnhance.Color(image).enhance(random.uniform(0.9, 1.15))
    buffer = io.BytesIO()
    image.save(buffer, format="JPEG", quality=90)
    return buffer.getvalue(), "image/jpeg"


def seed_users(
    count: int,
    photos_per_user: int,
    portrait_count: int,
    seed_value: int | None,
    augment: bool,
) -> None:
    if seed_value is not None:
        random.seed(seed_value)
    password = os.getenv("SEED_DEMO_PASSWORD", "splendoura_demo_123")
    db = SessionLocal()
    created = 0
    try:
        for _ in range(count):
            gender = random.choice([Gender.MALE, Gender.FEMALE])
            first = random.choice(FIRST_NAMES_MALE if gender == Gender.MALE else FIRST_NAMES_FEMALE)
            last = random.choice(LAST_NAMES)
            full_name = f"{first} {last}"
            username = _unique_username(db, _slugify(f"{first}{last}"))
            email = f"{_slugify(full_name)}+demo-{uuid.uuid4().hex[:6]}@seeded.splendoura.local"

            if db.query(User).filter(User.email == email).first():
                continue

            user = User(
                email=email,
                username=username,
                hashed_password=get_password_hash(password),
                full_name=full_name,
                age=random.randint(21, 38),
                gender=gender,
                sexual_orientation=random.choice(["straight", "bisexual", "gay", "other"]),
                bio=random.choice(BIOS),
                interests=random.sample(INTERESTS, k=random.randint(3, 6)),
                verification_status=VerificationStatus.VERIFIED,
                verified_at=datetime.utcnow(),
                profile_details={
                    "seeded": True,
                    "seed_note": "Demo profile generated for empty-state content.",
                    "seed_password_hint": password,
                    "seed_email_tag": "demo",
                },
            )

            photos: list[str] = []
            attributions: list[dict[str, str]] = []
            raw_images: list[dict[str, Any]] = []

            for index in range(max(1, portrait_count)):
                portrait_meta = _fetch_commons_portrait(gender)
                if not portrait_meta or not portrait_meta.get("url"):
                    break
                try:
                    data, content_type = _download_image(portrait_meta["url"])
                    url = _store_media(db, data, content_type, f"{username}-portrait-{index}.jpg")
                    photos.append(url)
                    attributions.append(
                        {
                            "url": url,
                            "source": portrait_meta["source"],
                            "license": portrait_meta["license"],
                            "license_url": portrait_meta["license_url"],
                        }
                    )
                    raw_images.append(
                        {
                            "bytes": data,
                            "content_type": content_type,
                            "source": portrait_meta["source"],
                            "license": portrait_meta["license"],
                            "license_url": portrait_meta["license_url"],
                        }
                    )
                except Exception:
                    continue

            if not photos:
                avatar_meta = _fetch_avatar(username)
                if avatar_meta and avatar_meta.get("url"):
                    try:
                        data, content_type = _download_image(avatar_meta["url"])
                        url = _store_media(db, data, content_type, f"{username}-avatar.png")
                        photos.append(url)
                        attributions.append(
                            {
                                "url": url,
                                "source": avatar_meta["source"],
                                "license": avatar_meta["license"],
                                "license_url": avatar_meta["license_url"],
                            }
                        )
                        raw_images.append(
                            {
                                "bytes": data,
                                "content_type": content_type,
                                "source": avatar_meta["source"],
                                "license": avatar_meta["license"],
                                "license_url": avatar_meta["license_url"],
                            }
                        )
                    except Exception:
                        pass

            for _ in range(max(0, photos_per_user - len(photos))):
                keyword = random.choice(VACATION_KEYWORDS)
                meta = _fetch_commons_image(keyword)
                if not meta or not meta.get("url"):
                    continue
                try:
                    data, content_type = _download_image(meta["url"])
                    url = _store_media(db, data, content_type, f"{username}-{keyword}.jpg")
                    photos.append(url)
                    attributions.append(
                        {
                            "url": url,
                            "source": meta["source"],
                            "license": meta["license"],
                            "license_url": meta["license_url"],
                        }
                    )
                    raw_images.append(
                        {
                            "bytes": data,
                            "content_type": content_type,
                            "source": meta["source"],
                            "license": meta["license"],
                            "license_url": meta["license_url"],
                        }
                    )
                except Exception:
                    continue

            while augment and len(photos) < photos_per_user and raw_images:
                source = random.choice(raw_images)
                augmented = _augment_image(source["bytes"])
                if not augmented:
                    break
                data, content_type = augmented
                filename = f"{username}-variant-{uuid.uuid4().hex[:6]}.jpg"
                url = _store_media(db, data, content_type, filename)
                photos.append(url)
                attributions.append(
                    {
                        "url": url,
                        "source": source["source"],
                        "license": source["license"],
                        "license_url": source["license_url"],
                        "derived_from": "seeded",
                    }
                )

            if photos:
                user.profile_image_url = photos[0]
                user.profile_media = {
                    "photos": photos,
                    "photo_attribution": attributions,
                }

            db.add(user)
            db.commit()
            created += 1
        print(f"Seeded {created} demo users.")
    finally:
        db.close()


def main() -> None:
    parser = argparse.ArgumentParser(description="Seed demo users for Splendoura.")
    parser.add_argument("--count", type=int, default=20, help="Number of users to create.")
    parser.add_argument(
        "--photos-per-user",
        type=int,
        default=3,
        help="Number of profile photos per user.",
    )
    parser.add_argument(
        "--portrait-count",
        type=int,
        default=1,
        help="Number of portrait photos per user.",
    )
    parser.add_argument(
        "--augment",
        action="store_true",
        help="Generate augmented variations to reach the photo count.",
    )
    parser.add_argument("--seed", type=int, default=None, help="Random seed.")
    args = parser.parse_args()
    seed_users(args.count, args.photos_per_user, args.portrait_count, args.seed, args.augment)


if __name__ == "__main__":
    main()
