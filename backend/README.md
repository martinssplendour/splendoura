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
