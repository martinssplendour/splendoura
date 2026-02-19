"""add swipe history

Revision ID: c1d2e3f4a5b6
Revises: f4c5d6e7f8a9
Create Date: 2026-02-12 00:00:00.000000
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = "c1d2e3f4a5b6"
down_revision = "f4c5d6e7f8a9"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    swipe_target_type = postgresql.ENUM(
        "group",
        "profile",
        name="swipetargettype",
        create_type=False,
    )
    swipe_action_type = postgresql.ENUM(
        "like",
        "nope",
        "superlike",
        "view",
        name="swipeaction",
        create_type=False,
    )

    swipe_target_type.create(bind, checkfirst=True)
    swipe_action_type.create(bind, checkfirst=True)

    if not inspector.has_table("swipe_history"):
        op.create_table(
            "swipe_history",
            sa.Column("id", sa.Integer(), primary_key=True),
            sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
            sa.Column(
                "target_type",
                swipe_target_type,
                nullable=False,
            ),
            sa.Column("target_id", sa.Integer(), nullable=False),
            sa.Column(
                "action",
                swipe_action_type,
                nullable=False,
            ),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
            sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
            sa.UniqueConstraint("user_id", "target_type", "target_id", name="uq_swipe_history_user_target"),
        )

    op.execute(
        sa.text(
            "CREATE INDEX IF NOT EXISTS ix_swipe_history_user_id ON swipe_history (user_id)"
        )
    )
    op.execute(
        sa.text(
            "CREATE INDEX IF NOT EXISTS ix_swipe_history_target_id ON swipe_history (target_id)"
        )
    )
    op.execute(
        sa.text(
            "CREATE INDEX IF NOT EXISTS ix_swipe_history_target_type ON swipe_history (target_type)"
        )
    )


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS ix_swipe_history_target_type")
    op.execute("DROP INDEX IF EXISTS ix_swipe_history_target_id")
    op.execute("DROP INDEX IF EXISTS ix_swipe_history_user_id")
    op.execute("DROP TABLE IF EXISTS swipe_history")
    op.execute("DROP TYPE IF EXISTS swipeaction")
    op.execute("DROP TYPE IF EXISTS swipetargettype")
