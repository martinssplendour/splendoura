#!/usr/bin/env sh
set -e

PORT="${PORT:-8000}"
WORKERS="${WEB_CONCURRENCY:-4}"
LOG_LEVEL="${LOG_LEVEL:-info}"

echo "Running database migrations..."
python - <<'PY'
from sqlalchemy import inspect
from alembic.config import Config
from alembic import command

from app.db.session import engine
from app.models import base

inspector = inspect(engine)
tables = inspector.get_table_names()
if "alembic_version" not in tables:
    print("Alembic version table not found. Bootstrapping schema...")
    base.Base.metadata.create_all(bind=engine)
    cfg = Config("alembic.ini")
    command.stamp(cfg, "head")
PY
alembic upgrade head

echo "Starting API server..."
exec gunicorn app.main:app \
  -k uvicorn.workers.UvicornWorker \
  -b 0.0.0.0:${PORT} \
  --workers "${WORKERS}" \
  --timeout 120 \
  --keep-alive 65 \
  --access-logfile - \
  --error-logfile - \
  --log-level "${LOG_LEVEL}"
