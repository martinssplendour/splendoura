"""add performance indexes

Revision ID: f4c5d6e7f8a9
Revises: d3e4f5a6b7c8
Create Date: 2026-02-12 00:00:00.000000
"""

from alembic import op
import sqlalchemy as sa

revision = "f4c5d6e7f8a9"
down_revision = "d3e4f5a6b7c8"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_index("ix_groups_category", "groups", ["category"])
    op.create_index("ix_groups_activity_type", "groups", ["activity_type"])
    op.create_index("ix_groups_cost_type", "groups", ["cost_type"])
    op.create_index("ix_groups_created_at", "groups", ["created_at"])
    op.create_index(
        "ix_group_media_group_cover_deleted",
        "group_media",
        ["group_id", "is_cover", "deleted_at"],
    )
    op.create_index(
        "ix_membership_group_status_deleted",
        "membership",
        ["group_id", "join_status", "deleted_at"],
    )
    op.create_index(
        "ix_users_location_city_country",
        "users",
        ["location_city", "location_country"],
    )
    op.execute("CREATE INDEX IF NOT EXISTS ix_groups_tags_gin ON groups USING GIN ((tags::jsonb))")


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS ix_groups_tags_gin")
    op.drop_index("ix_users_location_city_country", table_name="users")
    op.drop_index("ix_membership_group_status_deleted", table_name="membership")
    op.drop_index("ix_group_media_group_cover_deleted", table_name="group_media")
    op.drop_index("ix_groups_created_at", table_name="groups")
    op.drop_index("ix_groups_cost_type", table_name="groups")
    op.drop_index("ix_groups_activity_type", table_name="groups")
    op.drop_index("ix_groups_category", table_name="groups")
