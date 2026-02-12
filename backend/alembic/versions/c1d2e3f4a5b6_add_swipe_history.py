"""add swipe history

Revision ID: c1d2e3f4a5b6
Revises: f4c5d6e7f8a9
Create Date: 2026-02-12 00:00:00.000000
"""

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = "c1d2e3f4a5b6"
down_revision = "f4c5d6e7f8a9"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "swipe_history",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column(
            "target_type",
            sa.Enum(
                "group",
                "profile",
                name="swipetargettype",
            ),
            nullable=False,
        ),
        sa.Column("target_id", sa.Integer(), nullable=False),
        sa.Column(
            "action",
            sa.Enum(
                "like",
                "nope",
                "superlike",
                "view",
                name="swipeaction",
            ),
            nullable=False,
        ),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.UniqueConstraint("user_id", "target_type", "target_id", name="uq_swipe_history_user_target"),
    )
    op.create_index("ix_swipe_history_user_id", "swipe_history", ["user_id"])
    op.create_index("ix_swipe_history_target_id", "swipe_history", ["target_id"])
    op.create_index("ix_swipe_history_target_type", "swipe_history", ["target_type"])


def downgrade() -> None:
    op.drop_index("ix_swipe_history_target_type", table_name="swipe_history")
    op.drop_index("ix_swipe_history_target_id", table_name="swipe_history")
    op.drop_index("ix_swipe_history_user_id", table_name="swipe_history")
    op.drop_table("swipe_history")
    op.execute("DROP TYPE IF EXISTS swipeaction")
    op.execute("DROP TYPE IF EXISTS swipetargettype")
