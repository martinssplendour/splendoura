"""add profile details and settings

Revision ID: 3f4b5c6d7e8f
Revises: c1a2b3c4d5e6
Create Date: 2026-01-06 03:30:00.000000
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect


# revision identifiers, used by Alembic.
revision = "3f4b5c6d7e8f"
down_revision = "c1a2b3c4d5e6"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = inspect(bind)
    columns = {col["name"] for col in inspector.get_columns("users")}

    if "profile_details" not in columns:
        op.add_column("users", sa.Column("profile_details", sa.JSON(), nullable=True))
    if "discovery_settings" not in columns:
        op.add_column("users", sa.Column("discovery_settings", sa.JSON(), nullable=True))
    if "profile_media" not in columns:
        op.add_column("users", sa.Column("profile_media", sa.JSON(), nullable=True))


def downgrade() -> None:
    bind = op.get_bind()
    inspector = inspect(bind)
    columns = {col["name"] for col in inspector.get_columns("users")}

    if "profile_media" in columns:
        op.drop_column("users", "profile_media")
    if "discovery_settings" in columns:
        op.drop_column("users", "discovery_settings")
    if "profile_details" in columns:
        op.drop_column("users", "profile_details")
