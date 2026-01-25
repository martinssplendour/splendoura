import json
from typing import Iterable
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, status
from jose import JWTError, jwt
from sqlalchemy.orm import Session

from app import crud, models
from app.core.config import settings
from app.core.realtime import realtime_manager
from app.db.session import SessionLocal
from app.models.membership import JoinStatus
from app.models.user import VerificationStatus
from app.models.message import GroupMessageRead

router = APIRouter()


def _get_current_user(db: Session, token: str) -> models.User | None:
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        user_id = payload.get("sub")
        if not user_id:
            return None
    except JWTError:
        return None
    return crud.user.get(db, id=int(user_id))


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


@router.websocket("/ws/groups/{group_id}")
async def group_realtime(websocket: WebSocket, group_id: int) -> None:
    token = websocket.query_params.get("token")
    if not token:
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
        return
    db = SessionLocal()
    try:
        user = _get_current_user(db, token)
        if (
            not user
            or user.verification_status != VerificationStatus.VERIFIED
            or not _is_group_member(db, group_id, user.id)
        ):
            await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
            return
        await realtime_manager.connect(group_id, websocket)
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
