"""add membership request details and last active

Revision ID: e4f5a6b7c8d9
Revises: d2e3f4a5b6c7
Create Date: 2026-01-24 03:00:00.000000
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect


# revision identifiers, used by Alembic.
revision = "e4f5a6b7c8d9"
down_revision = "d2e3f4a5b6c7"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = inspect(bind)

    def has_column(table: str, column: str) -> bool:
        return column in {col["name"] for col in inspector.get_columns(table)}

    if not has_column("memberships", "request_message"):
        op.add_column("memberships", sa.Column("request_message", sa.Text(), nullable=True))
    if not has_column("memberships", "request_tier"):
        op.add_column("memberships", sa.Column("request_tier", sa.String(), nullable=True))
    if not has_column("users", "last_active_at"):
        op.add_column("users", sa.Column("last_active_at", sa.DateTime(timezone=True), nullable=True))


def downgrade() -> None:
    bind = op.get_bind()
    inspector = inspect(bind)

    def has_column(table: str, column: str) -> bool:
        return column in {col["name"] for col in inspector.get_columns(table)}

    if has_column("users", "last_active_at"):
        op.drop_column("users", "last_active_at")
    if has_column("memberships", "request_tier"):
        op.drop_column("memberships", "request_tier")
    if has_column("memberships", "request_message"):
        op.drop_column("memberships", "request_message")
