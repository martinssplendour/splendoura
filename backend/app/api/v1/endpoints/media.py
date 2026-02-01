import hashlib
from urllib.parse import quote, unquote

import httpx

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
    service_role_hash: str | None = None
    if service_role_key:
        try:
            claims = jwt.get_unverified_claims(service_role_key)
            service_role_claims = {
                "iss": claims.get("iss"),
                "ref": claims.get("ref"),
                "role": claims.get("role"),
            }
            digest = hashlib.sha256(service_role_key.encode("utf-8")).hexdigest()
            service_role_hash = digest[:12]
        except Exception:
            service_role_claims = {"error": "invalid_jwt"}
            service_role_hash = None
    else:
        service_role_claims = {"error": "missing"}
        service_role_hash = None

    return {
        "storage_enabled": storage.supabase_storage_enabled(),
        "supabase_url": settings.SUPABASE_URL,
        "supabase_storage_bucket": settings.SUPABASE_STORAGE_BUCKET,
        "supabase_storage_public": settings.SUPABASE_STORAGE_PUBLIC,
        "supabase_signed_url_expires": settings.SUPABASE_SIGNED_URL_EXPIRE_SECONDS,
        "supabase_service_role": service_role_claims,
        "supabase_service_role_key_hash": service_role_hash,
    }


@router.get("/debug/storage/sign")
def debug_storage_sign(
    *,
    object_key: str,
    full_response: bool = False,
    current_user=Depends(deps.get_current_user),
):
    if not storage.supabase_storage_enabled():
        raise HTTPException(status_code=400, detail="Supabase storage is not configured.")

    decoded_key = unquote(object_key)
    base_url = (settings.SUPABASE_URL or "").rstrip("/")
    bucket = settings.SUPABASE_STORAGE_BUCKET or ""
    encoded_key = quote(decoded_key, safe="/")
    sign_url = f"{base_url}/storage/v1/object/sign/{bucket}/{encoded_key}"
    payload = {"expiresIn": settings.SUPABASE_SIGNED_URL_EXPIRE_SECONDS}
    service_key = settings.SUPABASE_SERVICE_ROLE_KEY or ""
    digest = hashlib.sha256(service_key.encode("utf-8")).hexdigest() if service_key else ""

    headers = {
        "Authorization": f"Bearer {service_key}",
        "apikey": service_key,
        "Content-Type": "application/json",
    }
    headers_redacted = {
        "Authorization": "Bearer ***",
        "apikey": "***",
        "Content-Type": "application/json",
    }

    with httpx.Client(timeout=20) as client:
        response = client.post(sign_url, json=payload, headers=headers)

    body = response.text or ""
    if not full_response and len(body) > 2000:
        body = body[:2000] + "...(truncated)"

    return {
        "decoded_key": decoded_key,
        "encoded_key": encoded_key,
        "sign_url": sign_url,
        "bucket": bucket,
        "payload": payload,
        "request_headers": headers_redacted,
        "service_role_key_hash": digest[:12] if digest else None,
        "supabase_status": response.status_code,
        "supabase_body": body,
        "supabase_body_truncated": not full_response and body.endswith("...(truncated)"),
    }
