"""add profile image url

Revision ID: 2d4a1b7b5c9a
Revises: c71378706e38
Create Date: 2026-01-06 00:10:00.000000
"""

from alembic import op
import sqlalchemy as sa

revision = "2d4a1b7b5c9a"
down_revision = "c71378706e38"
branch_labels = None
depends_on = None

def upgrade() -> None:
    op.add_column("users", sa.Column("profile_image_url", sa.String(), nullable=True))

def downgrade() -> None:
    op.drop_column("users", "profile_image_url")
