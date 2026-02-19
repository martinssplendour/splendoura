from datetime import datetime

from pydantic import BaseModel


class AnalyticsTopPath(BaseModel):
    path: str
    requests: int
    errors_4xx: int
    errors_5xx: int
    avg_latency_ms: float | None = None


class AnalyticsIpUsage(BaseModel):
    ip_address: str
    requests: int
    unique_users: int
    errors_4xx: int
    errors_5xx: int
    avg_latency_ms: float | None = None
    last_seen_at: datetime | None = None


class AnalyticsOverview(BaseModel):
    window_days: int
    total_requests: int
    unique_ips: int
    total_4xx: int
    total_5xx: int
    error_rate: float
    avg_latency_ms: float | None = None
    active_refresh_sessions: int
    top_paths: list[AnalyticsTopPath]
    top_ips: list[AnalyticsIpUsage]
