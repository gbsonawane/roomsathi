"""add_listing_status_and_user_is_active

Revision ID: a1b2c3d4e5f6
Revises: ed9e5ea47148
Create Date: 2026-06-24 22:30:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers
revision: str = 'a1b2c3d4e5f6'
down_revision: Union[str, None] = 'ed9e5ea47148'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add status column to listings table
    op.add_column(
        'listings',
        sa.Column('status', sa.String(length=20), nullable=False, server_default='pending')
    )

    # Add is_active column to users table
    op.add_column(
        'users',
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default=sa.text('true'))
    )

    # Create index on listing status for faster admin queries
    op.create_index('idx_listings_status', 'listings', ['status'], unique=False)


def downgrade() -> None:
    op.drop_index('idx_listings_status', table_name='listings')
    op.drop_column('listings', 'status')
    op.drop_column('users', 'is_active')
