import json
import logging
import urllib.request
from typing import Iterable

from sqlalchemy.orm import Session

from app import models
from app.models.membership import JoinStatus
from app.models.push_token import UserPushToken
from app.models.user import UserRole

logger = logging.getLogger(__name__)

EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send"
MAX_EXPO_CHUNK = 100


def _chunk(values: list[dict], size: int) -> Iterable[list[dict]]:
    for index in range(0, len(values), size):
        yield values[index : index + size]


def get_group_member_ids(db: Session, group_id: int) -> list[int]:
    rows = (
        db.query(models.Membership.user_id)
        .filter(
            models.Membership.group_id == group_id,
            models.Membership.join_status == JoinStatus.APPROVED,
            models.Membership.deleted_at.is_(None),
        )
        .all()
    )
    return [row[0] for row in rows]


def get_push_tokens(db: Session, user_ids: Iterable[int]) -> list[str]:
    ids = [int(value) for value in user_ids if value is not None]
    if not ids:
        return []
    rows = db.query(UserPushToken.token).filter(UserPushToken.user_id.in_(ids)).all()
    return list({row[0] for row in rows if row[0]})


def send_expo_push(
    tokens: list[str],
    *,
    title: str,
    body: str,
    data: dict | None = None,
) -> None:
    if not tokens:
        return
    payloads = []
    for token in tokens:
        if not token:
            continue
        payloads.append(
            {
                "to": token,
                "title": title,
                "body": body,
                "data": data or {},
            }
        )
    for chunk in _chunk(payloads, MAX_EXPO_CHUNK):
        payload_bytes = json.dumps(chunk, default=str).encode("utf-8")
        request = urllib.request.Request(
            EXPO_PUSH_URL,
            data=payload_bytes,
            headers={"Content-Type": "application/json"},
            method="POST",
        )
        try:
            with urllib.request.urlopen(request, timeout=10) as response:
                response.read()
        except Exception as exc:
            logger.warning("Expo push send failed: %s", exc)


def notify_admins_new_user(db: Session, new_user: models.User) -> None:
    admin_rows = (
        db.query(models.User.id)
        .filter(
            models.User.role == UserRole.ADMIN,
            models.User.deleted_at.is_(None),
            models.User.id != new_user.id,
        )
        .all()
    )
    admin_ids = [row[0] for row in admin_rows]
    if not admin_ids:
        return
    tokens = get_push_tokens(db, admin_ids)
    if not tokens:
        return
    label = new_user.full_name or new_user.username or new_user.email
    send_expo_push(
        tokens,
        title="New user signup",
        body=f"{label} just joined Splendoura.",
        data={"type": "new_user_signup", "user_id": new_user.id},
    )
