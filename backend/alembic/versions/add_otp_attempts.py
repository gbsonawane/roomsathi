"""add otp_codes.attempts for brute-force lockout

Revision ID: add_otp_attempts
Revises: add_listing_status_user_is_active
Create Date: 2026-08-31
"""
from alembic import op
import sqlalchemy as sa

revision = "add_otp_attempts"
down_revision = "a1b2c3d4e5f6"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "otp_codes",
        sa.Column("attempts", sa.Integer(), server_default="0", nullable=False),
    )


def downgrade() -> None:
    op.drop_column("otp_codes", "attempts")
