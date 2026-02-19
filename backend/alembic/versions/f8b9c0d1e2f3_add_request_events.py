"""add request events analytics table

Revision ID: f8b9c0d1e2f3
Revises: f7a8b9c0d1e2
Create Date: 2026-02-19 00:00:00.000000
"""

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "f8b9c0d1e2f3"
down_revision = "f7a8b9c0d1e2"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    if not inspector.has_table("request_events"):
        op.create_table(
            "request_events",
            sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
            sa.Column("request_id", sa.String(length=128), nullable=True),
            sa.Column("method", sa.String(length=16), nullable=False),
            sa.Column("path", sa.String(length=512), nullable=False),
            sa.Column("route", sa.String(length=512), nullable=True),
            sa.Column("status_code", sa.Integer(), nullable=False),
            sa.Column("duration_ms", sa.Integer(), nullable=False),
            sa.Column("client_ip", sa.String(length=64), nullable=True),
            sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=True),
            sa.Column("user_agent", sa.String(length=512), nullable=True),
            sa.Column("referer", sa.String(length=512), nullable=True),
            sa.Column("query_string", sa.String(length=1024), nullable=True),
            sa.Column("is_error", sa.Boolean(), nullable=False, server_default=sa.false()),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        )

    op.execute(
        sa.text(
            "CREATE INDEX IF NOT EXISTS ix_request_events_created_at ON request_events (created_at)"
        )
    )
    op.execute(
        sa.text(
            "CREATE INDEX IF NOT EXISTS ix_request_events_client_ip_created_at ON request_events (client_ip, created_at)"
        )
    )
    op.execute(
        sa.text(
            "CREATE INDEX IF NOT EXISTS ix_request_events_path_created_at ON request_events (path, created_at)"
        )
    )
    op.execute(
        sa.text(
            "CREATE INDEX IF NOT EXISTS ix_request_events_status_code_created_at ON request_events (status_code, created_at)"
        )
    )
    op.execute(
        sa.text(
            "CREATE INDEX IF NOT EXISTS ix_request_events_user_id_created_at ON request_events (user_id, created_at)"
        )
    )
    op.execute(
        sa.text(
            "CREATE INDEX IF NOT EXISTS ix_request_events_request_id ON request_events (request_id)"
        )
    )


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS ix_request_events_request_id")
    op.execute("DROP INDEX IF EXISTS ix_request_events_user_id_created_at")
    op.execute("DROP INDEX IF EXISTS ix_request_events_status_code_created_at")
    op.execute("DROP INDEX IF EXISTS ix_request_events_path_created_at")
    op.execute("DROP INDEX IF EXISTS ix_request_events_client_ip_created_at")
    op.execute("DROP INDEX IF EXISTS ix_request_events_created_at")
    op.execute("DROP TABLE IF EXISTS request_events")
