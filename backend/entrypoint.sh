#!/usr/bin/env sh
set -e

PORT="${PORT:-8000}"
WORKERS="${WEB_CONCURRENCY:-4}"
LOG_LEVEL="${LOG_LEVEL:-info}"

echo "Running database migrations..."
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
