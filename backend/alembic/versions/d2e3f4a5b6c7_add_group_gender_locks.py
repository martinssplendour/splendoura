"""add group gender locks

Revision ID: d2e3f4a5b6c7
Revises: c1a2b3c4d5e6
Create Date: 2026-01-06 15:00:00.000000
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect


# revision identifiers, used by Alembic.
revision = "d2e3f4a5b6c7"
down_revision = "7a9b0c1d2e3f"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = inspect(bind)

    def has_column(table: str, column: str) -> bool:
        return column in {col["name"] for col in inspector.get_columns(table)}

    if not has_column("groups", "lock_male"):
        op.add_column(
            "groups",
            sa.Column(
                "lock_male",
                sa.Boolean(),
                server_default=sa.text("false"),
                nullable=False,
            ),
        )
    if not has_column("groups", "lock_female"):
        op.add_column(
            "groups",
            sa.Column(
                "lock_female",
                sa.Boolean(),
                server_default=sa.text("false"),
                nullable=False,
            ),
        )


def downgrade() -> None:
    bind = op.get_bind()
    inspector = inspect(bind)

    def has_column(table: str, column: str) -> bool:
        return column in {col["name"] for col in inspector.get_columns(table)}

    if has_column("groups", "lock_female"):
        op.drop_column("groups", "lock_female")
    if has_column("groups", "lock_male"):
        op.drop_column("groups", "lock_male")
