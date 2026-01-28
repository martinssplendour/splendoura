"""add match requests

Revision ID: b7c8d9e0f1a2
Revises: ab12cd34ef56
Create Date: 2026-01-28 12:00:00.000000
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect


revision = "b7c8d9e0f1a2"
down_revision = "ab12cd34ef56"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = inspect(bind)

    def has_table(name: str) -> bool:
        return inspector.has_table(name)

    if not has_table("match_requests"):
        op.create_table(
            "match_requests",
            sa.Column("id", sa.Integer(), primary_key=True),
            sa.Column("requester_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
            sa.Column("intent", sa.String(), nullable=False),
            sa.Column("status", sa.String(), nullable=False, server_default="open"),
            sa.Column("criteria", sa.JSON(), nullable=True),
            sa.Column("offers", sa.JSON(), nullable=True),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
            sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
            sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        )
        op.create_index("ix_match_requests_requester_id", "match_requests", ["requester_id"])

    if not has_table("match_request_invites"):
        op.create_table(
            "match_request_invites",
            sa.Column("id", sa.Integer(), primary_key=True),
            sa.Column("request_id", sa.Integer(), sa.ForeignKey("match_requests.id"), nullable=False),
            sa.Column("requester_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
            sa.Column("target_user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
            sa.Column("status", sa.String(), nullable=False, server_default="pending"),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
            sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
            sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        )
        op.create_index("ix_match_request_invites_request_id", "match_request_invites", ["request_id"])
        op.create_index("ix_match_request_invites_target_user_id", "match_request_invites", ["target_user_id"])


def downgrade() -> None:
    bind = op.get_bind()
    inspector = inspect(bind)

    def has_table(name: str) -> bool:
        return inspector.has_table(name)

    if has_table("match_request_invites"):
        op.drop_index("ix_match_request_invites_target_user_id", table_name="match_request_invites")
        op.drop_index("ix_match_request_invites_request_id", table_name="match_request_invites")
        op.drop_table("match_request_invites")

    if has_table("match_requests"):
        op.drop_index("ix_match_requests_requester_id", table_name="match_requests")
        op.drop_table("match_requests")
