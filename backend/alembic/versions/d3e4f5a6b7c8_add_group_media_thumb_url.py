"""add group media thumb url

Revision ID: d3e4f5a6b7c8
Revises: b7c8d9e0f1a2
Create Date: 2026-02-10 12:00:00.000000
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect


revision = "d3e4f5a6b7c8"
down_revision = "b7c8d9e0f1a2"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = inspect(bind)

    if "group_media" not in inspector.get_table_names():
        return

    columns = {col["name"] for col in inspector.get_columns("group_media")}
    if "thumb_url" not in columns:
        op.add_column("group_media", sa.Column("thumb_url", sa.String(), nullable=True))


def downgrade() -> None:
    bind = op.get_bind()
    inspector = inspect(bind)

    if "group_media" not in inspector.get_table_names():
        return

    columns = {col["name"] for col in inspector.get_columns("group_media")}
    if "thumb_url" in columns:
        op.drop_column("group_media", "thumb_url")
