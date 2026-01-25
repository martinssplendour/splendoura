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
   - Optional: `SENTRY_DSN` (error reporting)
4. Deploy. The container runs `alembic upgrade head` on startup via `backend/entrypoint.sh`.

Render will provide a `PORT` env var automatically. The API listens on that value.

## Supabase (Database)
1. Create a Supabase project.
2. Grab the **Session** connection string from Supabase and format it as:
   - `postgresql+psycopg2://postgres:<PASSWORD>@<HOST>:5432/postgres?sslmode=require`
3. Put it in `DATABASE_URL` on Render.

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
