"""add group messages

Revision ID: 9b1f4a8c7d2e
Revises: 2d4a1b7b5c9a
Create Date: 2026-01-06 00:35:00.000000
"""

from alembic import op
import sqlalchemy as sa

revision = "9b1f4a8c7d2e"
down_revision = "2d4a1b7b5c9a"
branch_labels = None
depends_on = None

def upgrade() -> None:
    op.create_table(
        "group_messages",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("group_id", sa.Integer(), sa.ForeignKey("groups.id"), index=True),
        sa.Column("sender_id", sa.Integer(), sa.ForeignKey("users.id"), index=True),
        sa.Column("content", sa.Text(), nullable=True),
        sa.Column("attachment_url", sa.String(), nullable=True),
        sa.Column("attachment_type", sa.String(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
    )

def downgrade() -> None:
    op.drop_table("group_messages")
