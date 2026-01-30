from urllib.parse import unquote

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import RedirectResponse, Response
from sqlalchemy.orm import Session

from app.api import deps
from app.core import storage
from app.core.config import settings
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


@router.get("/storage/{object_key:path}")
def get_storage_object(
    *,
    object_key: str,
    current_user=Depends(deps.get_current_user),
):
    decoded_key = unquote(object_key)
    if settings.SUPABASE_STORAGE_PUBLIC:
        return RedirectResponse(storage.build_public_url(decoded_key))
    signed_url = storage.create_signed_url(decoded_key)
    return RedirectResponse(signed_url)
