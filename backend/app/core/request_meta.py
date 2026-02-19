from __future__ import annotations

from ipaddress import ip_address

from fastapi import Request

from app.core.config import settings


def _normalize_ip(value: str | None) -> str | None:
    if not value:
        return None
    raw = value.strip()
    if not raw:
        return None
    if raw.lower() == "unknown":
        return None
    if raw.startswith('"') and raw.endswith('"'):
        raw = raw[1:-1].strip()
    try:
        return str(ip_address(raw))
    except ValueError:
        return None


def get_request_id(request: Request) -> str | None:
    for header_name in ("x-request-id", "rndr-id", "x-correlation-id"):
        value = (request.headers.get(header_name) or "").strip()
        if value:
            return value[:128]
    return None


def get_client_ip(request: Request) -> str | None:
    if settings.TRUST_PROXY_HEADERS:
        xff = request.headers.get("x-forwarded-for")
        if xff:
            first_hop = xff.split(",")[0].strip()
            normalized = _normalize_ip(first_hop)
            if normalized:
                return normalized

        for header_name in ("x-real-ip", "cf-connecting-ip"):
            normalized = _normalize_ip(request.headers.get(header_name))
            if normalized:
                return normalized

    if request.client and request.client.host:
        normalized = _normalize_ip(request.client.host)
        if normalized:
            return normalized
        return request.client.host[:64]

    return None
