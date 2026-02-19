from __future__ import annotations

import json
import logging
import os
import random
import time
import uuid
from datetime import datetime, timedelta, timezone

from fastapi import FastAPI, Request, Response
from prometheus_client import CONTENT_TYPE_LATEST, CollectorRegistry, Counter, Gauge, Histogram, generate_latest
from prometheus_client import multiprocess

from app.core.config import settings
from app.core.request_meta import get_client_ip, get_request_id
from app.db.session import SessionLocal
from app.models.request_event import RequestEvent

logger = logging.getLogger("app.request")

HTTP_REQUESTS_TOTAL = Counter(
    "splendoura_http_requests_total",
    "Total number of HTTP requests received.",
    ["method", "route", "status_code"],
)
HTTP_REQUEST_DURATION_SECONDS = Histogram(
    "splendoura_http_request_duration_seconds",
    "HTTP request latency in seconds.",
    ["method", "route"],
    buckets=(0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2, 5, 10),
)
HTTP_REQUESTS_IN_PROGRESS = Gauge(
    "splendoura_http_requests_in_progress",
    "Current number of requests being processed.",
    multiprocess_mode="livesum",
)

_request_event_store_enabled = True


def _truncate(value: str | None, limit: int) -> str | None:
    if value is None:
        return None
    value = value.strip()
    if not value:
        return None
    return value[:limit]


def _route_label(request: Request) -> str:
    route = request.scope.get("route")
    route_path = getattr(route, "path", None)
    if route_path:
        return str(route_path)
    return request.url.path


def _new_request_id() -> str:
    return uuid.uuid4().hex


def _metrics_payload() -> bytes:
    multiproc_dir = os.getenv("PROMETHEUS_MULTIPROC_DIR")
    if multiproc_dir:
        registry = CollectorRegistry()
        multiprocess.MultiProcessCollector(registry)
        return generate_latest(registry)
    return generate_latest()


def _metrics_authorized(request: Request) -> bool:
    token = settings.METRICS_BEARER_TOKEN
    if not token:
        return True
    auth = (request.headers.get("authorization") or "").strip()
    return auth == f"Bearer {token}"


def _sample_request_event() -> bool:
    sample_rate = settings.REQUEST_ANALYTICS_SAMPLE_RATE
    if sample_rate <= 0:
        return False
    if sample_rate >= 1:
        return True
    return random.random() <= sample_rate


def _should_store_request_event(path: str) -> bool:
    if not settings.REQUEST_ANALYTICS_ENABLED:
        return False
    if path == "/metrics":
        return False
    if settings.REQUEST_ANALYTICS_API_ONLY and not path.startswith("/api/"):
        return False
    return _sample_request_event()


def _store_request_event(payload: dict[str, object]) -> None:
    global _request_event_store_enabled
    if not _request_event_store_enabled:
        return

    try:
        with SessionLocal() as db:
            db.add(
                RequestEvent(
                    request_id=payload.get("request_id"),  # type: ignore[arg-type]
                    method=payload["method"],  # type: ignore[arg-type]
                    path=payload["path"],  # type: ignore[arg-type]
                    route=payload.get("route"),  # type: ignore[arg-type]
                    status_code=payload["status_code"],  # type: ignore[arg-type]
                    duration_ms=payload["duration_ms"],  # type: ignore[arg-type]
                    client_ip=payload.get("client_ip"),  # type: ignore[arg-type]
                    user_id=payload.get("user_id"),  # type: ignore[arg-type]
                    user_agent=payload.get("user_agent"),  # type: ignore[arg-type]
                    referer=payload.get("referer"),  # type: ignore[arg-type]
                    query_string=payload.get("query_string"),  # type: ignore[arg-type]
                    is_error=payload["is_error"],  # type: ignore[arg-type]
                )
            )
            db.commit()
    except Exception:
        _request_event_store_enabled = False
        logger.exception("request_event_storage_disabled_after_failure")


def register_observability(app: FastAPI) -> None:
    @app.middleware("http")
    async def request_observability_middleware(request: Request, call_next):
        path = request.url.path
        if path == "/metrics":
            return await call_next(request)

        started = time.perf_counter()
        request_id = get_request_id(request) or _new_request_id()
        request.state.request_id = request_id
        request.state.client_ip = get_client_ip(request)

        route = path
        status_code = 500
        response: Response | None = None
        HTTP_REQUESTS_IN_PROGRESS.inc()
        try:
            response = await call_next(request)
            status_code = int(response.status_code)
            route = _route_label(request)
            response.headers.setdefault("X-Request-ID", request_id)
            return response
        finally:
            elapsed_seconds = max(time.perf_counter() - started, 0.0)
            HTTP_REQUESTS_IN_PROGRESS.dec()
            method = request.method.upper()
            HTTP_REQUESTS_TOTAL.labels(
                method=method,
                route=route,
                status_code=str(status_code),
            ).inc()
            HTTP_REQUEST_DURATION_SECONDS.labels(
                method=method,
                route=route,
            ).observe(elapsed_seconds)

            duration_ms = int(round(elapsed_seconds * 1000))
            payload: dict[str, object] = {
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "request_id": request_id,
                "method": method,
                "path": _truncate(path, 512) or path[:512],
                "route": _truncate(route, 512),
                "status_code": status_code,
                "duration_ms": duration_ms,
                "client_ip": _truncate(getattr(request.state, "client_ip", None), 64),
                "user_id": getattr(request.state, "user_id", None),
                "user_agent": _truncate(request.headers.get("user-agent"), 512),
                "referer": _truncate(request.headers.get("referer"), 512),
                "query_string": _truncate(request.url.query, 1024),
                "is_error": status_code >= 500,
            }
            logger.info(json.dumps(payload, separators=(",", ":")))

            if _should_store_request_event(path):
                _store_request_event(payload)

    @app.get("/metrics", include_in_schema=False)
    async def metrics(request: Request):
        if not settings.METRICS_ENABLED:
            return Response(status_code=404)
        if not _metrics_authorized(request):
            return Response(status_code=401, headers={"WWW-Authenticate": "Bearer"})
        return Response(content=_metrics_payload(), media_type=CONTENT_TYPE_LATEST)

    @app.on_event("startup")
    def prune_old_request_events() -> None:
        if not settings.REQUEST_ANALYTICS_ENABLED:
            return
        retention_days = settings.REQUEST_ANALYTICS_RETENTION_DAYS
        if retention_days <= 0:
            return
        cutoff = datetime.now(timezone.utc) - timedelta(days=retention_days)
        try:
            with SessionLocal() as db:
                db.query(RequestEvent).filter(RequestEvent.created_at < cutoff).delete(synchronize_session=False)
                db.commit()
        except Exception:
            logger.exception("request_event_retention_prune_failed")
