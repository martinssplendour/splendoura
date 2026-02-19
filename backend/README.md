# Splendoura Backend

FastAPI + PostgreSQL backend for the social group platform.

## Setup

1. Create and activate a virtualenv.
2. Install dependencies:

```bash
pip install -r requirements.txt
```

3. Configure environment variables in `backend/.env`:

```
DATABASE_URL=postgresql+psycopg2://postgres:password@localhost:5432/splendoura
JWT_SECRET=change_me
ACCESS_TOKEN_EXPIRE_MINUTES=30
REFRESH_TOKEN_EXPIRE_MINUTES=43200
RATE_LIMIT_PER_MINUTE=60
```

4. Run migrations:

```bash
alembic -c backend/alembic.ini revision --autogenerate -m "initial"
alembic -c backend/alembic.ini upgrade head
```

5. Run the app:

```bash
uvicorn app.main:app --reload
```

## Observability

The backend now includes an observability baseline:

- JSON request logs (with request ID, route, status, latency, client IP).
- Prometheus metrics endpoint at `GET /metrics`.
- Request-event persistence for admin analytics (`request_events` table).
- Admin analytics APIs:
  - `GET /api/v1/admin/analytics/overview`
  - `GET /api/v1/admin/analytics/ip-usage`

Recommended environment variables:

```env
FORWARDED_ALLOW_IPS=*
TRUST_PROXY_HEADERS=true
METRICS_ENABLED=true
METRICS_BEARER_TOKEN=replace-with-random-token
REQUEST_ANALYTICS_ENABLED=true
REQUEST_ANALYTICS_API_ONLY=true
REQUEST_ANALYTICS_SAMPLE_RATE=0.5
REQUEST_ANALYTICS_RETENTION_DAYS=30
```

To enable DB schema updates for analytics, run:

```bash
alembic -c backend/alembic.ini upgrade head
```

### Local Prometheus + Grafana

This repo now includes a local monitoring stack:

- Prometheus config: `ops/prometheus/prometheus.yml`
- Alert rules: `ops/prometheus/alerts.yml`
- Grafana provisioning: `ops/grafana/provisioning/`
- Auto-loaded dashboard: `ops/grafana/provisioning/dashboards/json/splendoura-observability.json`

Start the full stack from repo root:

```bash
docker compose up -d --build
```

Or start only monitoring services (after backend is running):

```bash
docker compose up -d prometheus grafana
```

Access:

- Prometheus: `http://localhost:9090`
- Grafana: `http://localhost:3001` (default login `admin` / `admin`)
- Nginx app entrypoint: `http://localhost:8080`

Prometheus scrapes backend metrics from `backend:8000/metrics` on the Docker network.
If you set `METRICS_BEARER_TOKEN` on backend, update scrape auth in `ops/prometheus/prometheus.yml`.

For production scraping (already configured as `job="splendoura-prod"`), add your token locally:

```bash
mkdir -p ops/prometheus/secrets
echo -n "<METRICS_BEARER_TOKEN>" > ops/prometheus/secrets/prod_metrics_token
docker compose up -d prometheus
```

## API Overview

Auth:
- `POST /api/v1/auth/register`
- `POST /api/v1/auth/login`
- `POST /api/v1/auth/refresh`

Users:
- `GET /api/v1/users/me`
- `PUT /api/v1/users/me`
- `GET /api/v1/users/{id}`

Groups:
- `POST /api/v1/groups`
- `GET /api/v1/groups`
- `GET /api/v1/groups/{id}`
- `PUT /api/v1/groups/{id}`
- `DELETE /api/v1/groups/{id}`
- `POST /api/v1/groups/{id}/join`
- `POST /api/v1/groups/{id}/approve/{user_id}`
- `POST /api/v1/groups/{id}/reject/{user_id}`
- `GET /api/v1/groups/{id}/members`

Reports:
- `POST /api/v1/reports`
- `GET /api/v1/reports` (admin only)
