"""add discovery trust features

Revision ID: c1a2b3c4d5e6
Revises: 9b1f4a8c7d2e
Create Date: 2026-01-06 01:30:00.000000
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision = "c1a2b3c4d5e6"
down_revision = "9b1f4a8c7d2e"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = inspect(bind)

    def has_table(name: str) -> bool:
        return inspector.has_table(name)

    def has_column(table: str, column: str) -> bool:
        return column in {col["name"] for col in inspector.get_columns(table)}

    if not has_column("users", "username"):
        op.add_column("users", sa.Column("username", sa.String(), nullable=True))
    if not has_column("users", "profile_video_url"):
        op.add_column("users", sa.Column("profile_video_url", sa.String(), nullable=True))
    if not has_column("users", "interests"):
        op.add_column("users", sa.Column("interests", sa.JSON(), nullable=True))
    if not has_column("users", "badges"):
        op.add_column("users", sa.Column("badges", sa.JSON(), nullable=True))
    if not has_column("users", "reputation_score"):
        op.add_column(
            "users",
            sa.Column("reputation_score", sa.Float(), server_default="0", nullable=False),
        )
    if not has_column("users", "safety_score"):
        op.add_column(
            "users",
            sa.Column("safety_score", sa.Float(), server_default="0", nullable=False),
        )
    if not has_column("users", "verification_requested_at"):
        op.add_column(
            "users",
            sa.Column("verification_requested_at", sa.DateTime(timezone=True), nullable=True),
        )
    if not has_column("users", "verified_at"):
        op.add_column("users", sa.Column("verified_at", sa.DateTime(timezone=True), nullable=True))
    op.execute(
        "CREATE UNIQUE INDEX IF NOT EXISTS ix_users_username ON users (username)"
    )

    if not has_column("groups", "location_lat"):
        op.add_column("groups", sa.Column("location_lat", sa.Float(), nullable=True))
    if not has_column("groups", "location_lng"):
        op.add_column("groups", sa.Column("location_lng", sa.Float(), nullable=True))
    if not has_column("groups", "tags"):
        op.add_column("groups", sa.Column("tags", sa.JSON(), nullable=True))
    if not has_column("groups", "creator_intro"):
        op.add_column("groups", sa.Column("creator_intro", sa.Text(), nullable=True))
    if not has_column("groups", "creator_intro_video_url"):
        op.add_column("groups", sa.Column("creator_intro_video_url", sa.String(), nullable=True))

    op.execute(
        "DO $$ BEGIN "
        "CREATE TYPE groupmediatype AS ENUM ('image', 'video'); "
        "EXCEPTION WHEN duplicate_object THEN null; "
        "END $$;"
    )
    media_enum = postgresql.ENUM("image", "video", name="groupmediatype", create_type=False)
    if not has_table("group_media"):
        op.create_table(
            "group_media",
            sa.Column("id", sa.Integer(), nullable=False),
            sa.Column("group_id", sa.Integer(), nullable=True),
            sa.Column("uploader_id", sa.Integer(), nullable=True),
            sa.Column("url", sa.String(), nullable=False),
            sa.Column("media_type", media_enum, nullable=True),
            sa.Column("is_cover", sa.Boolean(), nullable=True),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
            sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
            sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
            sa.ForeignKeyConstraint(["group_id"], ["groups.id"]),
            sa.ForeignKeyConstraint(["uploader_id"], ["users.id"]),
            sa.PrimaryKeyConstraint("id"),
        )
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_group_media_group_id ON group_media (group_id)"
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_group_media_uploader_id ON group_media (uploader_id)"
    )

    if not has_table("group_availability"):
        op.create_table(
            "group_availability",
            sa.Column("id", sa.Integer(), nullable=False),
            sa.Column("group_id", sa.Integer(), nullable=True),
            sa.Column("day_of_week", sa.Integer(), nullable=False),
            sa.Column("slot", sa.String(), nullable=False),
            sa.Column("created_by", sa.Integer(), nullable=True),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
            sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
            sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
            sa.ForeignKeyConstraint(["created_by"], ["users.id"]),
            sa.ForeignKeyConstraint(["group_id"], ["groups.id"]),
            sa.PrimaryKeyConstraint("id"),
            sa.UniqueConstraint("group_id", "day_of_week", "slot", name="uq_group_slot"),
        )
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_group_availability_group_id ON group_availability (group_id)"
    )

    if not has_table("group_plans"):
        op.create_table(
            "group_plans",
            sa.Column("id", sa.Integer(), nullable=False),
            sa.Column("group_id", sa.Integer(), nullable=True),
            sa.Column("title", sa.String(), nullable=False),
            sa.Column("details", sa.Text(), nullable=True),
            sa.Column("scheduled_at", sa.DateTime(timezone=True), nullable=True),
            sa.Column("location_name", sa.String(), nullable=True),
            sa.Column("location_lat", sa.Float(), nullable=True),
            sa.Column("location_lng", sa.Float(), nullable=True),
            sa.Column("pinned", sa.Boolean(), nullable=True),
            sa.Column("created_by", sa.Integer(), nullable=True),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
            sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
            sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
            sa.ForeignKeyConstraint(["created_by"], ["users.id"]),
            sa.ForeignKeyConstraint(["group_id"], ["groups.id"]),
            sa.PrimaryKeyConstraint("id"),
        )
    op.execute("CREATE INDEX IF NOT EXISTS ix_group_plans_group_id ON group_plans (group_id)")

    if not has_table("group_polls"):
        op.create_table(
            "group_polls",
            sa.Column("id", sa.Integer(), nullable=False),
            sa.Column("group_id", sa.Integer(), nullable=True),
            sa.Column("question", sa.Text(), nullable=False),
            sa.Column("is_multi", sa.Boolean(), nullable=True),
            sa.Column("closes_at", sa.DateTime(timezone=True), nullable=True),
            sa.Column("is_active", sa.Boolean(), nullable=True),
            sa.Column("created_by", sa.Integer(), nullable=True),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
            sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
            sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
            sa.ForeignKeyConstraint(["created_by"], ["users.id"]),
            sa.ForeignKeyConstraint(["group_id"], ["groups.id"]),
            sa.PrimaryKeyConstraint("id"),
        )
    op.execute("CREATE INDEX IF NOT EXISTS ix_group_polls_group_id ON group_polls (group_id)")

    if not has_table("group_poll_options"):
        op.create_table(
            "group_poll_options",
            sa.Column("id", sa.Integer(), nullable=False),
            sa.Column("poll_id", sa.Integer(), nullable=True),
            sa.Column("label", sa.String(), nullable=False),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
            sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
            sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
            sa.ForeignKeyConstraint(["poll_id"], ["group_polls.id"]),
            sa.PrimaryKeyConstraint("id"),
        )
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_group_poll_options_poll_id ON group_poll_options (poll_id)"
    )

    if not has_table("group_poll_votes"):
        op.create_table(
            "group_poll_votes",
            sa.Column("id", sa.Integer(), nullable=False),
            sa.Column("poll_id", sa.Integer(), nullable=True),
            sa.Column("option_id", sa.Integer(), nullable=True),
            sa.Column("user_id", sa.Integer(), nullable=True),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
            sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
            sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
            sa.ForeignKeyConstraint(["option_id"], ["group_poll_options.id"]),
            sa.ForeignKeyConstraint(["poll_id"], ["group_polls.id"]),
            sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
            sa.PrimaryKeyConstraint("id"),
            sa.UniqueConstraint("poll_id", "user_id", "option_id", name="uq_poll_vote"),
        )
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_group_poll_votes_poll_id ON group_poll_votes (poll_id)"
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_group_poll_votes_option_id ON group_poll_votes (option_id)"
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_group_poll_votes_user_id ON group_poll_votes (user_id)"
    )

    if not has_table("group_pins"):
        op.create_table(
            "group_pins",
            sa.Column("id", sa.Integer(), nullable=False),
            sa.Column("group_id", sa.Integer(), nullable=True),
            sa.Column("title", sa.String(), nullable=False),
            sa.Column("description", sa.Text(), nullable=True),
            sa.Column("lat", sa.Float(), nullable=True),
            sa.Column("lng", sa.Float(), nullable=True),
            sa.Column("created_by", sa.Integer(), nullable=True),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
            sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
            sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
            sa.ForeignKeyConstraint(["created_by"], ["users.id"]),
            sa.ForeignKeyConstraint(["group_id"], ["groups.id"]),
            sa.PrimaryKeyConstraint("id"),
        )
    op.execute("CREATE INDEX IF NOT EXISTS ix_group_pins_group_id ON group_pins (group_id)")

    op.execute(
        "DO $$ BEGIN "
        "CREATE TYPE messagetype AS ENUM ('text', 'file', 'plan', 'poll', 'system'); "
        "EXCEPTION WHEN duplicate_object THEN null; "
        "END $$;"
    )
    message_enum = postgresql.ENUM("text", "file", "plan", "poll", "system", name="messagetype", create_type=False)
    if not has_column("group_messages", "message_type"):
        op.add_column(
            "group_messages",
            sa.Column("message_type", message_enum, server_default="text", nullable=False),
        )
    if not has_column("group_messages", "metadata"):
        op.add_column("group_messages", sa.Column("metadata", sa.JSON(), nullable=True))


def downgrade() -> None:
    op.drop_column("group_messages", "metadata")
    op.drop_column("group_messages", "message_type")
    op.execute("DROP TYPE IF EXISTS messagetype")

    op.drop_index(op.f("ix_group_pins_group_id"), table_name="group_pins")
    op.drop_table("group_pins")

    op.drop_index(op.f("ix_group_poll_votes_user_id"), table_name="group_poll_votes")
    op.drop_index(op.f("ix_group_poll_votes_option_id"), table_name="group_poll_votes")
    op.drop_index(op.f("ix_group_poll_votes_poll_id"), table_name="group_poll_votes")
    op.drop_table("group_poll_votes")

    op.drop_index(op.f("ix_group_poll_options_poll_id"), table_name="group_poll_options")
    op.drop_table("group_poll_options")

    op.drop_index(op.f("ix_group_polls_group_id"), table_name="group_polls")
    op.drop_table("group_polls")

    op.drop_index(op.f("ix_group_plans_group_id"), table_name="group_plans")
    op.drop_table("group_plans")

    op.drop_index(op.f("ix_group_availability_group_id"), table_name="group_availability")
    op.drop_table("group_availability")

    op.drop_index(op.f("ix_group_media_uploader_id"), table_name="group_media")
    op.drop_index(op.f("ix_group_media_group_id"), table_name="group_media")
    op.drop_table("group_media")
    op.execute("DROP TYPE IF EXISTS groupmediatype")

    op.drop_column("groups", "creator_intro_video_url")
    op.drop_column("groups", "creator_intro")
    op.drop_column("groups", "tags")
    op.drop_column("groups", "location_lng")
    op.drop_column("groups", "location_lat")

    op.drop_index(op.f("ix_users_username"), table_name="users")
    op.drop_column("users", "verified_at")
    op.drop_column("users", "verification_requested_at")
    op.drop_column("users", "safety_score")
    op.drop_column("users", "reputation_score")
    op.drop_column("users", "badges")
    op.drop_column("users", "interests")
    op.drop_column("users", "profile_video_url")
    op.drop_column("users", "username")
