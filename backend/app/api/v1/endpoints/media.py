from urllib.parse import unquote

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import RedirectResponse, Response
from jose import jwt
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


@router.get("/storage/signed/{object_key:path}")
def get_storage_signed_url(
    *,
    object_key: str,
    current_user=Depends(deps.get_current_user),
):
    decoded_key = unquote(object_key)
    if settings.SUPABASE_STORAGE_PUBLIC:
        return {
            "signed_url": storage.build_public_url(decoded_key),
            "expires_in": 0,
        }
    signed_url = storage.create_signed_url(decoded_key)
    return {
        "signed_url": signed_url,
        "expires_in": settings.SUPABASE_SIGNED_URL_EXPIRE_SECONDS,
    }


@router.get("/debug/storage")
def debug_storage_settings(current_user=Depends(deps.get_current_user)):
    service_role_key = settings.SUPABASE_SERVICE_ROLE_KEY or ""
    service_role_claims: dict[str, str | int | None] = {}
    if service_role_key:
        try:
            claims = jwt.get_unverified_claims(service_role_key)
            service_role_claims = {
                "iss": claims.get("iss"),
                "ref": claims.get("ref"),
                "role": claims.get("role"),
            }
        except Exception:
            service_role_claims = {"error": "invalid_jwt"}
    else:
        service_role_claims = {"error": "missing"}

    return {
        "storage_enabled": storage.supabase_storage_enabled(),
        "supabase_url": settings.SUPABASE_URL,
        "supabase_storage_bucket": settings.SUPABASE_STORAGE_BUCKET,
        "supabase_storage_public": settings.SUPABASE_STORAGE_PUBLIC,
        "supabase_signed_url_expires": settings.SUPABASE_SIGNED_URL_EXPIRE_SECONDS,
        "supabase_service_role": service_role_claims,
    }
