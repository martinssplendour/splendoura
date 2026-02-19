# Render + Supabase Production Setup

This repo is ready to deploy on Render (Docker) with a Supabase Postgres database.

## Backend (Render)
1. Create a new Render Web Service and connect this repo.
2. Use the included `render.yaml` (Blueprint) or set:
   - **Root Directory**: `backend`
   - **Environment**: Docker
3. Copy values from `backend/.env.production` into Render env vars and fill in:
   - `DATABASE_URL` (Supabase connection string with `?sslmode=require`)
   - `JWT_SECRET`, `ADMIN_EMAIL`, `ADMIN_USERNAME`, `ADMIN_PASSWORD`
   - `CORS_ORIGINS` (your production web domains)
   - `FRONTEND_BASE_URL` (your web app base URL for reset links)
   - `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`
   - `SUPABASE_STORAGE_BUCKET` (private bucket for signed media like verification)
   - `SUPABASE_STORAGE_PUBLIC=false`
   - `SUPABASE_PUBLIC_STORAGE_BUCKET` (public bucket for profile + group images)
   - Optional: `SUPABASE_PUBLIC_STORAGE_CACHE_CONTROL`, `SUPABASE_PUBLIC_THUMBNAIL_MAX_SIZE`
   - `SMTP_HOST`, `SMTP_PORT`, `SMTP_USERNAME`, `SMTP_PASSWORD`, `SMTP_USE_TLS`, `SMTP_USE_SSL`, `SMTP_FROM`
   - Optional: `SENTRY_DSN` (error reporting)
4. Deploy. The container runs `alembic upgrade head` on startup via `backend/entrypoint.sh`.

Render will provide a `PORT` env var automatically. The API listens on that value.

## Render Observability Baseline
Use these for phase 1 visibility before external tools:

1. In Render service settings, enable:
   - Logs
   - Service Metrics
   - (Optional) Log Streams to your SIEM/log platform
   - (Optional) Metrics Streams
2. Set environment variables:
   - `FORWARDED_ALLOW_IPS=*`
   - `TRUST_PROXY_HEADERS=true`
   - `METRICS_ENABLED=true`
   - `METRICS_BEARER_TOKEN=<long-random-secret>`
   - `REQUEST_ANALYTICS_ENABLED=true`
   - `REQUEST_ANALYTICS_API_ONLY=true`
   - `REQUEST_ANALYTICS_SAMPLE_RATE=0.5`
   - `REQUEST_ANALYTICS_RETENTION_DAYS=30`
3. Scrape backend Prometheus endpoint:
   - `GET /metrics`
   - Include header: `Authorization: Bearer <METRICS_BEARER_TOKEN>` if token is set.
4. Build baseline alerts:
   - 5xx rate spike
   - p95 latency degradation
   - container memory near limit
   - request volume anomalies

## Supabase (Database)
1. Create a Supabase project.
2. Grab the **Session** connection string from Supabase and format it as:
   - `postgresql+psycopg2://postgres:<PASSWORD>@<HOST>:5432/postgres?sslmode=require`
3. Put it in `DATABASE_URL` on Render.

## Supabase (Storage Buckets)
Create two buckets:
1. `public-media` (Public) for profile + group images.
2. `private-media` (Private) for verification and sensitive uploads.

Make sure `SUPABASE_PUBLIC_STORAGE_BUCKET` points to the public bucket, and
`SUPABASE_STORAGE_BUCKET` points to the private bucket.

## Mobile (EAS Production Builds)
1. Update `mobile/.env.production`:
   - `EXPO_PUBLIC_API_BASE_URL=https://api.yourdomain.com/api/v1`
2. Build:
   - `npx eas build --profile production --platform android`
   - `npx eas build --profile production --platform ios`

## Push Notifications (Production)
The app uses Expo push tokens already. For production delivery:
1. Android: Create a Firebase project and upload the FCM key to Expo.
2. iOS: Create an APNs key and upload it to Expo.

## Ops Notes
- Keep `AUTO_CREATE_TABLES=false` in production.
- Bytea image storage can grow fast. Enable Supabase backups and monitor storage.
- Make sure HTTPS and your API domain are set up before launch.

## One-off Media Migration (Public Bucket + Thumbnails)
If you already have profile/group images stored in private storage, run this once to
copy them to the public bucket and generate thumbnails:
```
cd backend
python scripts/migrate_private_images_to_public.py
```
This does **not** run automatically on deploy.
