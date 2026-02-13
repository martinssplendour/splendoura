"""add direct threads

Revision ID: e8f9a0b1c2d3
Revises: d7e8f9a0b1c2
Create Date: 2026-02-13 00:00:00.000000
"""

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "e8f9a0b1c2d3"
down_revision = "d7e8f9a0b1c2"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "direct_threads",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("user_a_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("user_b_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("group_id", sa.Integer(), sa.ForeignKey("groups.id"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.UniqueConstraint("user_a_id", "user_b_id", name="uq_direct_threads_users"),
    )
    op.create_index("ix_direct_threads_user_a_id", "direct_threads", ["user_a_id"])
    op.create_index("ix_direct_threads_user_b_id", "direct_threads", ["user_b_id"])
    op.create_index("ix_direct_threads_group_id", "direct_threads", ["group_id"])


def downgrade() -> None:
    op.drop_index("ix_direct_threads_group_id", table_name="direct_threads")
    op.drop_index("ix_direct_threads_user_b_id", table_name="direct_threads")
    op.drop_index("ix_direct_threads_user_a_id", table_name="direct_threads")
    op.drop_table("direct_threads")
