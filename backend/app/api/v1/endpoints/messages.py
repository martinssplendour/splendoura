import io
import json
import os
import tempfile
import uuid
from datetime import datetime
import anyio
from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, Form
from sqlalchemy.orm import Session
from PIL import Image
from nudenet import NudeDetector

from app import crud, models, schemas
from app.core.config import settings
from app.models.media import MediaBlob
from app.models.membership import JoinStatus
from app.models.message import GroupMessageRead
from app.api import deps
from app.core.push import get_group_member_ids, get_push_tokens, send_expo_push
from app.core.realtime import realtime_manager, serialize_message
from app.core.storage import supabase_storage_enabled, upload_bytes_to_supabase

router = APIRouter()

_nudenet_detector = None


def _estimate_nudity_score_bytes(image_bytes: bytes) -> float:
    try:
        image = Image.open(io.BytesIO(image_bytes)).convert("RGB")
        image.thumbnail((96, 96))
        pixels = list(image.getdata())
        if not pixels:
            return 0.0
        skin = 0
        for r, g, b in pixels:
            max_c = max(r, g, b)
            min_c = min(r, g, b)
            if (
                r > 95
                and g > 40
                and b > 20
                and (max_c - min_c) > 15
                and abs(r - g) > 15
                and r > g
                and r > b
            ):
                skin += 1
        return skin / len(pixels)
    except Exception:
        return 0.0


def _get_nudenet_detector():
    global _nudenet_detector
    if _nudenet_detector is None:
        _nudenet_detector = NudeDetector()
    return _nudenet_detector


def _detect_nudity(image_bytes: bytes) -> dict | None:
    provider = getattr(settings, "NUDITY_PROVIDER", "nudenet")
    if provider in {"nudenet", "open_source"}:
        detector = _get_nudenet_detector()
        threshold = float(getattr(settings, "NUDITY_MIN_CONFIDENCE", 0.35))
        if threshold > 1:
            threshold = threshold / 100.0
        try:
            with tempfile.NamedTemporaryFile(delete=False, suffix=".jpg") as temp:
                temp.write(image_bytes)
                temp_path = temp.name
            try:
                results = detector.detect(temp_path)
            finally:
                os.unlink(temp_path)
            max_score = 0.0
            is_explicit = False
            explicit_labels = {
                "exposed_anus",
                "exposed_breast_f",
                "exposed_breast_m",
                "exposed_buttocks",
                "exposed_genitalia_f",
                "exposed_genitalia_m",
                "exposed_torso",
            }
            for item in results or []:
                label = (item.get("class") or "").lower()
                score = float(item.get("score") or 0.0)
                max_score = max(max_score, score)
                if label in explicit_labels and score >= threshold:
                    is_explicit = True
            return {
                "contains_nudity": is_explicit,
                "score": round(max_score, 3),
                "provider": "nudenet",
            }
        except Exception:
            return None
    return None

def require_group_member(
    db: Session,
    *,
    group_id: int,
    user_id: int,
) -> None:
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
        raise HTTPException(status_code=403, detail="You must be an approved member to access chat.")

@router.get("/{id}/messages", response_model=list[schemas.GroupMessage])
def list_messages(
    *,
    db: Session = Depends(deps.get_db),
    id: int,
    since: datetime | None = None,
    before: datetime | None = None,
    limit: int | None = None,
    current_user: models.User = Depends(deps.get_current_user),
):
    require_group_member(db, group_id=id, user_id=current_user.id)
    query = db.query(models.GroupMessage).filter(
        models.GroupMessage.group_id == id,
        models.GroupMessage.deleted_at.is_(None),
    )
    if since:
        query = query.filter(models.GroupMessage.created_at > since)
    if before:
        query = query.filter(models.GroupMessage.created_at < before)

    messages: list[models.GroupMessage]
    if limit and limit > 0:
        if since:
            messages = (
                query.order_by(models.GroupMessage.created_at.asc())
                .limit(limit)
                .all()
            )
        else:
            messages = (
                query.order_by(models.GroupMessage.created_at.desc())
                .limit(limit)
                .all()
            )
            messages.reverse()
    else:
        messages = query.order_by(models.GroupMessage.created_at.asc()).all()
    if not messages:
        return messages
    message_ids = [message.id for message in messages]
    read_rows = (
        db.query(GroupMessageRead.message_id, GroupMessageRead.user_id)
        .filter(GroupMessageRead.message_id.in_(message_ids))
        .all()
    )
    read_map: dict[int, list[int]] = {}
    for message_id, user_id in read_rows:
        read_map.setdefault(message_id, []).append(user_id)
    for message in messages:
        message.read_by = read_map.get(message.id, [])
    return messages

@router.post("/{id}/messages", response_model=schemas.GroupMessage, dependencies=[Depends(deps.rate_limit)])
def create_message(
    *,
    db: Session = Depends(deps.get_db),
    id: int,
    content: str | None = Form(default=None),
    file: UploadFile | None = File(default=None),
    message_type: str | None = Form(default=None),
    metadata: str | None = Form(default=None),
    current_user: models.User = Depends(deps.get_current_user),
):
    require_group_member(db, group_id=id, user_id=current_user.id)
    if not content and not file:
        raise HTTPException(status_code=400, detail="Message content or file is required.")

    attachment_url = None
    attachment_type = None
    nudity_info = None
    if file:
        attachment_type = file.content_type or "application/octet-stream"
        file_bytes = file.file.read()
        if attachment_type.startswith("image/"):
            detection = _detect_nudity(file_bytes)
            if detection is None:
                score = _estimate_nudity_score_bytes(file_bytes)
                detection = {
                    "contains_nudity": score >= 0.35,
                    "score": round(score, 3),
                    "provider": "heuristic",
                }
            nudity_info = detection
        if supabase_storage_enabled():
            attachment_url = upload_bytes_to_supabase(
                prefix=f"messages/{id}",
                filename=file.filename,
                content_type=attachment_type,
                data=file_bytes,
                public=False,
            )
        elif attachment_type.startswith("image/"):
            blob = MediaBlob(
                content_type=attachment_type,
                filename=file.filename,
                data=file_bytes,
                created_by=current_user.id,
            )
            db.add(blob)
            db.flush()
            attachment_url = f"/api/v1/media/{blob.id}"
        else:
            uploads_dir = os.path.join(os.getcwd(), "uploads", "messages")
            os.makedirs(uploads_dir, exist_ok=True)
            ext = os.path.splitext(file.filename or "")[1] or ".bin"
            filename = f"{uuid.uuid4().hex}{ext}"
            filepath = os.path.join(uploads_dir, filename)
            with open(filepath, "wb") as buffer:
                buffer.write(file_bytes)
            attachment_url = f"/uploads/messages/{filename}"

    parsed_metadata = None
    if metadata:
        try:
            parsed_metadata = json.loads(metadata)
        except json.JSONDecodeError:
            raise HTTPException(status_code=400, detail="Invalid metadata JSON.")
    if nudity_info:
        if parsed_metadata is None:
            parsed_metadata = {}
        parsed_metadata["nudity"] = nudity_info
    resolved_type = message_type
    if not resolved_type:
        resolved_type = "file" if file else "text"
    message = models.GroupMessage(
        group_id=id,
        sender_id=current_user.id,
        content=content,
        attachment_url=attachment_url,
        attachment_type=attachment_type,
        message_type=resolved_type,
        meta=parsed_metadata,
    )
    db.add(message)
    db.commit()
    db.refresh(message)
    anyio.from_thread.run(
        realtime_manager.broadcast,
        id,
        {"type": "message:new", "message": serialize_message(message, read_by=[])},
    )
    group = crud.group.get(db, id=id)
    recipient_ids = [
        user_id for user_id in get_group_member_ids(db, id) if user_id != current_user.id
    ]
    tokens = get_push_tokens(db, recipient_ids)
    if tokens:
        if content:
            preview = content.strip()
            body = preview if len(preview) <= 120 else f"{preview[:117]}..."
        elif attachment_type and attachment_type.startswith("image/"):
            body = "Sent a photo."
        else:
            body = "Sent an attachment."
        send_expo_push(
            tokens,
            title=group.title if group else "New message",
            body=body,
            data={"type": "message", "group_id": id, "message_id": message.id},
        )
    return message


@router.post("/{id}/messages/read", dependencies=[Depends(deps.rate_limit)])
def mark_messages_read(
    *,
    db: Session = Depends(deps.get_db),
    id: int,
    payload: schemas.GroupMessageReadRequest,
    current_user: models.User = Depends(deps.get_current_user),
):
    require_group_member(db, group_id=id, user_id=current_user.id)
    message_ids = payload.message_ids
    if not message_ids:
        return {"msg": "No messages to update"}
    valid_ids = (
        db.query(models.GroupMessage.id)
        .filter(
            models.GroupMessage.group_id == id,
            models.GroupMessage.id.in_(message_ids),
            models.GroupMessage.deleted_at.is_(None),
        )
        .all()
    )
    valid_set = {row[0] for row in valid_ids}
    if not valid_set:
        return {"msg": "No messages found"}
    existing = (
        db.query(GroupMessageRead.message_id)
        .filter(
            GroupMessageRead.user_id == current_user.id,
            GroupMessageRead.message_id.in_(list(valid_set)),
        )
        .all()
    )
    existing_set = {row[0] for row in existing}
    new_ids = [message_id for message_id in valid_set if message_id not in existing_set]
    for message_id in new_ids:
        db.add(GroupMessageRead(message_id=message_id, user_id=current_user.id))
    if new_ids:
        db.commit()
        anyio.from_thread.run(
            realtime_manager.broadcast,
            id,
            {"type": "read", "user_id": current_user.id, "message_ids": new_ids},
        )
    return {"msg": "Read receipts updated"}
