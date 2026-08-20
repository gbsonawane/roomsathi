"""add_listing_status_and_user_is_active

Revision ID: a1b2c3d4e5f6
Revises: ed9e5ea47148
Create Date: 2026-06-24 22:30:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect, text


# revision identifiers
revision: str = 'a1b2c3d4e5f6'
down_revision: Union[str, None] = 'ed9e5ea47148'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = inspect(bind)
    
    # Add status to listings only if it doesn't exist
    listings_cols = [c['name'] for c in inspector.get_columns('listings')]
    if 'status' not in listings_cols:
        op.add_column(
            'listings',
            sa.Column('status', sa.String(length=20), nullable=False, server_default='pending')
        )
    
    # Add is_active to users only if it doesn't exist  
    users_cols = [c['name'] for c in inspector.get_columns('users')]
    if 'is_active' not in users_cols:
        op.add_column(
            'users',
            sa.Column('is_active', sa.Boolean(), nullable=False, server_default=sa.text('true'))
        )
    
    # Add role to users only if it doesn't exist
    if 'role' not in users_cols:
        op.add_column(
            'users',
            sa.Column('role', sa.String(length=20), nullable=False, server_default='seeker')
        )

    # Create index only if it doesn't exist
    indexes = [idx['name'] for idx in inspector.get_indexes('listings')]
    if 'idx_listings_status' not in indexes:
        op.create_index('idx_listings_status', 'listings', ['status'], unique=False)

def downgrade() -> None:
    try:
        op.drop_index('idx_listings_status', table_name='listings')
    except Exception:
        pass
    try:
        op.drop_column('listings', 'status')
    except Exception:
        pass
    try:
        op.drop_column('users', 'is_active')
    except Exception:
        pass
