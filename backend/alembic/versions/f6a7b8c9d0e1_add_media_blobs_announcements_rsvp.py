"""add media blobs, announcements, and plan rsvps

Revision ID: f6a7b8c9d0e1
Revises: e4f5a6b7c8d9
Create Date: 2026-01-24 12:00:00.000000
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect


# revision identifiers, used by Alembic.
revision = "f6a7b8c9d0e1"
down_revision = "e4f5a6b7c8d9"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = inspect(bind)

    def has_table(name: str) -> bool:
        return name in inspector.get_table_names()

    if not has_table("media_blobs"):
        op.create_table(
            "media_blobs",
            sa.Column("id", sa.Integer(), primary_key=True),
            sa.Column("content_type", sa.String(), nullable=False),
            sa.Column("filename", sa.String(), nullable=True),
            sa.Column("data", sa.LargeBinary(), nullable=False),
            sa.Column("created_by", sa.Integer(), nullable=True),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=True),
            sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
            sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
            sa.ForeignKeyConstraint(["created_by"], ["users.id"]),
        )
        op.create_index("ix_media_blobs_created_by", "media_blobs", ["created_by"])

    if not has_table("group_announcements"):
        op.create_table(
            "group_announcements",
            sa.Column("id", sa.Integer(), primary_key=True),
            sa.Column("group_id", sa.Integer(), nullable=False),
            sa.Column("title", sa.String(), nullable=False),
            sa.Column("body", sa.Text(), nullable=True),
            sa.Column("created_by", sa.Integer(), nullable=False),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=True),
            sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
            sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
            sa.ForeignKeyConstraint(["group_id"], ["groups.id"]),
            sa.ForeignKeyConstraint(["created_by"], ["users.id"]),
        )
        op.create_index("ix_group_announcements_group_id", "group_announcements", ["group_id"])
        op.create_index("ix_group_announcements_created_by", "group_announcements", ["created_by"])

    if not has_table("group_plan_rsvps"):
        op.create_table(
            "group_plan_rsvps",
            sa.Column("id", sa.Integer(), primary_key=True),
            sa.Column("plan_id", sa.Integer(), nullable=False),
            sa.Column("user_id", sa.Integer(), nullable=False),
            sa.Column(
                "status",
                sa.Enum("going", "interested", "not_going", name="rsvpstatus"),
                nullable=False,
            ),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=True),
            sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
            sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
            sa.ForeignKeyConstraint(["plan_id"], ["group_plans.id"]),
            sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
            sa.UniqueConstraint("plan_id", "user_id", name="uq_group_plan_rsvp"),
        )
        op.create_index("ix_group_plan_rsvps_plan_id", "group_plan_rsvps", ["plan_id"])
        op.create_index("ix_group_plan_rsvps_user_id", "group_plan_rsvps", ["user_id"])


def downgrade() -> None:
    bind = op.get_bind()
    inspector = inspect(bind)

    def has_table(name: str) -> bool:
        return name in inspector.get_table_names()

    if has_table("group_plan_rsvps"):
        op.drop_index("ix_group_plan_rsvps_user_id", table_name="group_plan_rsvps")
        op.drop_index("ix_group_plan_rsvps_plan_id", table_name="group_plan_rsvps")
        op.drop_table("group_plan_rsvps")
        op.execute("DROP TYPE IF EXISTS rsvpstatus")

    if has_table("group_announcements"):
        op.drop_index("ix_group_announcements_created_by", table_name="group_announcements")
        op.drop_index("ix_group_announcements_group_id", table_name="group_announcements")
        op.drop_table("group_announcements")

    if has_table("media_blobs"):
        op.drop_index("ix_media_blobs_created_by", table_name="media_blobs")
        op.drop_table("media_blobs")
