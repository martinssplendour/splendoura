import json
from datetime import datetime, timezone
from typing import Iterable
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, status
from jose import JWTError
from sqlalchemy.orm import Session

from app import crud, models
from app.core.config import settings
from app.core import security
from app.core.realtime import realtime_manager
from app.db.session import SessionLocal
from app.models.auth_session import UserRefreshSession
from app.models.membership import JoinStatus
from app.models.user import VerificationStatus
from app.models.message import GroupMessageRead

router = APIRouter()


def _get_current_user(db: Session, token: str) -> models.User | None:
    try:
        payload = security.decode_token(token, expected_type="access")
        user_id = payload.get("sub")
        session_id = payload.get("sid")
        if not user_id:
            return None
        if not session_id:
            return None
    except JWTError:
        return None
    try:
        user_id_int = int(user_id)
    except (TypeError, ValueError):
        return None
    session = (
        db.query(UserRefreshSession)
        .filter(
            UserRefreshSession.id == session_id,
            UserRefreshSession.user_id == user_id_int,
            UserRefreshSession.revoked_at.is_(None),
            UserRefreshSession.expires_at > datetime.now(timezone.utc),
        )
        .first()
    )
    if not session:
        return None
    return crud.user.get(db, id=user_id_int)


def _is_group_member(db: Session, group_id: int, user_id: int) -> bool:
    group = crud.group.get(db, id=group_id)
    if not group or group.deleted_at is not None:
        return False
    if group.creator_id == user_id:
        return True
    membership = db.query(models.Membership).filter(
        models.Membership.group_id == group_id,
        models.Membership.user_id == user_id,
        models.Membership.join_status == JoinStatus.APPROVED,
        models.Membership.deleted_at.is_(None),
    ).first()
    return membership is not None


def _normalize_ids(values: Iterable[object]) -> list[int]:
    ids: list[int] = []
    for value in values:
        try:
            ids.append(int(value))
        except (TypeError, ValueError):
            continue
    return ids


def _record_reads(db: Session, group_id: int, user_id: int, message_ids: list[int]) -> list[int]:
    if not message_ids:
        return []
    valid_ids = (
        db.query(models.GroupMessage.id)
        .filter(
            models.GroupMessage.group_id == group_id,
            models.GroupMessage.id.in_(message_ids),
            models.GroupMessage.deleted_at.is_(None),
        )
        .all()
    )
    valid_set = {row[0] for row in valid_ids}
    if not valid_set:
        return []
    existing = (
        db.query(GroupMessageRead.message_id)
        .filter(
            GroupMessageRead.user_id == user_id,
            GroupMessageRead.message_id.in_(list(valid_set)),
        )
        .all()
    )
    existing_set = {row[0] for row in existing}
    new_ids = [message_id for message_id in valid_set if message_id not in existing_set]
    for message_id in new_ids:
        db.add(GroupMessageRead(message_id=message_id, user_id=user_id))
    if new_ids:
        db.commit()
    return new_ids


def _extract_token_from_subprotocol(websocket: WebSocket) -> tuple[str | None, str | None]:
    raw = websocket.headers.get("sec-websocket-protocol") or ""
    if not raw:
        return None, None
    offered = [part.strip() for part in raw.split(",") if part.strip()]
    for protocol in offered:
        if protocol.startswith("bearer."):
            return protocol[len("bearer."):], protocol
    return None, None


@router.websocket("/ws/groups/{group_id}")
async def group_realtime(websocket: WebSocket, group_id: int) -> None:
    token = websocket.query_params.get("token")
    accepted_subprotocol = None
    if not token:
        token, accepted_subprotocol = _extract_token_from_subprotocol(websocket)
    if not token:
        token = websocket.cookies.get(settings.AUTH_ACCESS_COOKIE_NAME)
    if not token:
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
        return
    db = SessionLocal()
    try:
        user = _get_current_user(db, token)
        if (
            not user
            or (settings.REQUIRE_VERIFICATION and user.verification_status != VerificationStatus.VERIFIED)
            or not _is_group_member(db, group_id, user.id)
        ):
            await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
            return
        await realtime_manager.connect(group_id, websocket, subprotocol=accepted_subprotocol)
        while True:
            raw = await websocket.receive_text()
            try:
                payload = json.loads(raw)
            except json.JSONDecodeError:
                continue
            event_type = payload.get("type")
            if event_type == "typing":
                await realtime_manager.broadcast(
                    group_id,
                    {
                        "type": "typing",
                        "user_id": user.id,
                        "is_typing": bool(payload.get("is_typing")),
                    },
                )
            elif event_type == "read":
                message_ids = _normalize_ids(payload.get("message_ids", []))
                recorded = _record_reads(db, group_id, user.id, message_ids)
                if recorded:
                    await realtime_manager.broadcast(
                        group_id,
                        {"type": "read", "user_id": user.id, "message_ids": recorded},
                    )
    except WebSocketDisconnect:
        pass
    finally:
        await realtime_manager.disconnect(group_id, websocket)
        db.close()
