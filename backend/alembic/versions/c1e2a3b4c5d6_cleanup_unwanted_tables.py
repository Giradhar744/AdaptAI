"""cleanup_unwanted_tables

Revision ID: c1e2a3b4c5d6
Revises: 0e88b3409681
Create Date: 2026-11-28 00:40:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = 'c1e2a3b4c5d6'
down_revision: Union[str, None] = '0e88b3409681'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Drop foreign key constraint on dpps.topic_id if present
    try:
        op.drop_constraint('dpps_topic_id_fkey', 'dpps', type_='foreignkey')
    except Exception:
        pass

    try:
        op.drop_column('dpps', 'topic_id')
    except Exception:
        pass

    # 2. Make diagnostics.disability_type_id nullable and drop strict FK constraint if needed
    try:
        op.alter_column('diagnostics', 'disability_type_id', existing_type=sa.String(36), nullable=True)
    except Exception:
        pass

    # 3. Drop unwanted and unused tables in safe dependency order
    tables_to_drop = [
        'consent_ledger',
        'trust_profiles',
        'student_preferences',
        'behaviour_signals',
        'struggle_assessments',
        'hint_events',
        'disability_profiles',
        'priority_orders',
        'scaffold_levels',
        'topics',
    ]

    for table_name in tables_to_drop:
        try:
            op.drop_table(table_name)
        except Exception:
            pass


def downgrade() -> None:
    pass
