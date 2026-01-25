"""add group category

Revision ID: 7a9b0c1d2e3f
Revises: 3f4b5c6d7e8f
Create Date: 2026-01-08 00:00:00.000000
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect


# revision identifiers, used by Alembic.
revision = "7a9b0c1d2e3f"
down_revision = "3f4b5c6d7e8f"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = inspect(bind)
    columns = {col["name"] for col in inspector.get_columns("groups")}

    if "category" not in columns:
        op.add_column(
            "groups",
            sa.Column("category", sa.String(), nullable=False, server_default="friendship"),
        )


def downgrade() -> None:
    bind = op.get_bind()
    inspector = inspect(bind)
    columns = {col["name"] for col in inspector.get_columns("groups")}

    if "category" in columns:
        op.drop_column("groups", "category")
