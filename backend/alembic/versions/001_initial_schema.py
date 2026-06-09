"""initial schema

Revision ID: 001_initial
Revises:
Create Date: 2024-01-01

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID, JSONB, ARRAY

revision: str = "001_initial"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Users
    op.create_table(
        "users",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("full_name", sa.Text, nullable=False),
        sa.Column("phone", sa.String(20), unique=True, nullable=True),
        sa.Column("email", sa.String(255), unique=True, nullable=True),
        sa.Column("avatar_url", sa.Text, nullable=True),
        sa.Column("hashed_password", sa.Text, nullable=True),
        sa.Column("role", sa.String(20), nullable=False, server_default="seeker"),
        sa.Column("is_verified", sa.Boolean, server_default="false"),
        sa.Column("aadhar_verified", sa.Boolean, server_default="false"),
        sa.Column("plan_type", sa.String(20), server_default="free"),
        sa.Column("plan_expires_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("contacts_used_today", sa.Integer, server_default="0"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
    )

    # Listings
    op.create_table(
        "listings",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("owner_id", UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("title", sa.Text, nullable=True),
        sa.Column("property_type", sa.String(30), nullable=False),
        sa.Column("gender_preference", sa.String(20), nullable=False, server_default="any"),
        sa.Column("furnishing", sa.String(20), nullable=False, server_default="unfurnished"),
        sa.Column("floor", sa.String(20), nullable=True),
        sa.Column("parking", sa.String(20), server_default="none"),
        sa.Column("city", sa.Text, nullable=False),
        sa.Column("area", sa.Text, nullable=False),
        sa.Column("full_address", sa.Text, nullable=True),
        sa.Column("latitude", sa.Numeric(10, 8), nullable=True),
        sa.Column("longitude", sa.Numeric(11, 8), nullable=True),
        sa.Column("rent", sa.Integer, nullable=False),
        sa.Column("deposit", sa.Integer, nullable=False),
        sa.Column("available_from", sa.Date, nullable=False),
        sa.Column("description", sa.Text, nullable=True),
        sa.Column("photos", ARRAY(sa.Text), server_default="{}"),
        sa.Column("listing_plan", sa.String(20), nullable=False, server_default="basic"),
        sa.Column("is_boosted", sa.Boolean, server_default="false"),
        sa.Column("boost_expires_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("is_active", sa.Boolean, server_default="true"),
        sa.Column("is_verified", sa.Boolean, server_default="false"),
        sa.Column("expires_at", sa.DateTime(timezone=True), server_default=sa.text("now() + interval '30 days'")),
        sa.Column("view_count", sa.Integer, server_default="0"),
        sa.Column("unlock_count", sa.Integer, server_default="0"),
        sa.Column("save_count", sa.Integer, server_default="0"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
    )

    # Contact Unlocks
    op.create_table(
        "contact_unlocks",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("seeker_id", UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("listing_id", UUID(as_uuid=True), sa.ForeignKey("listings.id", ondelete="CASCADE"), nullable=False),
        sa.Column("unlock_type", sa.String(20), nullable=False),
        sa.Column("amount_paid", sa.Integer, nullable=False),
        sa.Column("payment_id", sa.Text, nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
        sa.UniqueConstraint("seeker_id", "listing_id", name="uq_seeker_listing"),
    )

    # Saved Listings
    op.create_table(
        "saved_listings",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("user_id", UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("listing_id", UUID(as_uuid=True), sa.ForeignKey("listings.id", ondelete="CASCADE"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
        sa.UniqueConstraint("user_id", "listing_id", name="uq_user_listing_save"),
    )

    # Listing Views
    op.create_table(
        "listing_views",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("listing_id", UUID(as_uuid=True), sa.ForeignKey("listings.id", ondelete="CASCADE"), nullable=False),
        sa.Column("viewer_id", UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("viewed_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
    )

    # Payments
    op.create_table(
        "payments",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("user_id", UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("payment_type", sa.String(30), nullable=False),
        sa.Column("amount", sa.Integer, nullable=False),
        sa.Column("currency", sa.String(10), server_default="INR"),
        sa.Column("razorpay_order_id", sa.Text, nullable=True),
        sa.Column("razorpay_payment_id", sa.Text, nullable=True),
        sa.Column("status", sa.String(20), server_default="pending"),
        sa.Column("metadata", JSONB, server_default="{}"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
    )

    # Listing Boosts
    op.create_table(
        "listing_boosts",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("listing_id", UUID(as_uuid=True), sa.ForeignKey("listings.id", ondelete="CASCADE"), nullable=False),
        sa.Column("owner_id", UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("boost_days", sa.Integer, nullable=False),
        sa.Column("amount_paid", sa.Integer, nullable=False),
        sa.Column("payment_id", sa.Text, nullable=True),
        sa.Column("starts_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
    )

    # Reviews
    op.create_table(
        "reviews",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("reviewer_id", UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("owner_id", UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("listing_id", UUID(as_uuid=True), sa.ForeignKey("listings.id", ondelete="SET NULL"), nullable=True),
        sa.Column("rating", sa.Integer, nullable=False),
        sa.Column("comment", sa.Text, nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
    )

    # Notifications
    op.create_table(
        "notifications",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("user_id", UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("type", sa.String(50), nullable=False),
        sa.Column("title", sa.Text, nullable=False),
        sa.Column("body", sa.Text, nullable=True),
        sa.Column("is_read", sa.Boolean, server_default="false"),
        sa.Column("metadata", JSONB, server_default="{}"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
    )

    # OTP Codes
    op.create_table(
        "otp_codes",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("phone", sa.String(20), nullable=False),
        sa.Column("code", sa.String(10), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("used", sa.Boolean, server_default="false"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
    )

    # Indexes
    op.create_index("idx_listings_city", "listings", ["city"])
    op.create_index("idx_listings_area", "listings", ["area"])
    op.create_index("idx_listings_property_type", "listings", ["property_type"])
    op.create_index("idx_listings_rent", "listings", ["rent"])
    op.create_index("idx_listings_active", "listings", ["is_active", "expires_at"])
    op.create_index("idx_listings_boosted", "listings", ["is_boosted", "boost_expires_at"])
    op.create_index("idx_listings_owner", "listings", ["owner_id"])
    op.create_index("idx_contact_unlocks_seeker", "contact_unlocks", ["seeker_id"])
    op.create_index("idx_saved_listings_user", "saved_listings", ["user_id"])
    op.create_index("idx_otp_phone", "otp_codes", ["phone"])

    # Triggers
    op.execute("""
        CREATE OR REPLACE FUNCTION update_updated_at()
        RETURNS TRIGGER AS $$
        BEGIN
          NEW.updated_at = now();
          RETURN NEW;
        END;
        $$ LANGUAGE plpgsql;
    """)
    op.execute("""
        CREATE TRIGGER listings_updated_at BEFORE UPDATE ON listings
          FOR EACH ROW EXECUTE FUNCTION update_updated_at();
    """)
    op.execute("""
        CREATE TRIGGER users_updated_at BEFORE UPDATE ON users
          FOR EACH ROW EXECUTE FUNCTION update_updated_at();
    """)

    # Auto-expiry function
    op.execute("""
        CREATE OR REPLACE FUNCTION expire_old_listings()
        RETURNS VOID AS $$
        BEGIN
          UPDATE listings SET is_active = FALSE
          WHERE expires_at < now() AND is_active = TRUE;
        END;
        $$ LANGUAGE plpgsql;
    """)


def downgrade() -> None:
    op.execute("DROP FUNCTION IF EXISTS expire_old_listings()")
    op.execute("DROP FUNCTION IF EXISTS update_updated_at() CASCADE")
    op.drop_table("otp_codes")
    op.drop_table("notifications")
    op.drop_table("reviews")
    op.drop_table("listing_boosts")
    op.drop_table("payments")
    op.drop_table("listing_views")
    op.drop_table("saved_listings")
    op.drop_table("contact_unlocks")
    op.drop_table("listings")
    op.drop_table("users")
