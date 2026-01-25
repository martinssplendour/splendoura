from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import Response
from sqlalchemy.orm import Session

from app.api import deps
from app.models.media import MediaBlob

router = APIRouter()


@router.get("/media/{media_id}")
def get_media(
    *,
    db: Session = Depends(deps.get_db),
    media_id: int,
) -> Response:
    media = (
        db.query(MediaBlob)
        .filter(MediaBlob.id == media_id, MediaBlob.deleted_at.is_(None))
        .first()
    )
    if not media:
        raise HTTPException(status_code=404, detail="Media not found")
    headers = {"Cache-Control": "public, max-age=86400"}
    return Response(content=media.data, media_type=media.content_type, headers=headers)
