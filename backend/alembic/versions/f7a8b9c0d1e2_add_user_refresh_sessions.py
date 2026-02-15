"""add user refresh sessions

Revision ID: f7a8b9c0d1e2
Revises: e8f9a0b1c2d3
Create Date: 2026-02-15 00:00:00.000000
"""

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "f7a8b9c0d1e2"
down_revision = "e8f9a0b1c2d3"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "user_refresh_sessions",
        sa.Column("id", sa.String(length=64), primary_key=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("token_hash", sa.String(length=128), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("revoked_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("replaced_by_session_id", sa.String(length=64), nullable=True),
        sa.Column("last_used_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("ip_address", sa.String(length=64), nullable=True),
        sa.Column("user_agent", sa.String(length=512), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index(
        "ix_user_refresh_sessions_user_id",
        "user_refresh_sessions",
        ["user_id"],
    )
    op.create_index(
        "ix_user_refresh_sessions_expires_at",
        "user_refresh_sessions",
        ["expires_at"],
    )
    op.create_index(
        "ix_user_refresh_sessions_revoked_at",
        "user_refresh_sessions",
        ["revoked_at"],
    )


def downgrade() -> None:
    op.drop_index("ix_user_refresh_sessions_revoked_at", table_name="user_refresh_sessions")
    op.drop_index("ix_user_refresh_sessions_expires_at", table_name="user_refresh_sessions")
    op.drop_index("ix_user_refresh_sessions_user_id", table_name="user_refresh_sessions")
    op.drop_table("user_refresh_sessions")

