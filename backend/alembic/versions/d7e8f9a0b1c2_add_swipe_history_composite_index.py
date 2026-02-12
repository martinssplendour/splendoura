"""add swipe history composite index

Revision ID: d7e8f9a0b1c2
Revises: c1d2e3f4a5b6
Create Date: 2026-02-12 00:00:00.000000
"""

from alembic import op

# revision identifiers, used by Alembic.
revision = "d7e8f9a0b1c2"
down_revision = "c1d2e3f4a5b6"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        """
        DO $$
        BEGIN
          IF NOT EXISTS (
            SELECT 1
            FROM pg_indexes
            WHERE schemaname = current_schema()
              AND tablename = 'swipe_history'
              AND indexdef ILIKE '%(user_id, target_type, target_id)%'
          ) THEN
            CREATE INDEX ix_swipe_history_user_target
              ON swipe_history (user_id, target_type, target_id);
          END IF;
        END $$;
        """
    )


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS ix_swipe_history_user_target")
