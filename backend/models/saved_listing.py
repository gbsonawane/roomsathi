import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, DateTime, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy import ForeignKey
from sqlalchemy.orm import relationship
from backend.db.database import Base


class SavedListing(Base):
    __tablename__ = "saved_listings"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    listing_id = Column(UUID(as_uuid=True), ForeignKey("listings.id", ondelete="CASCADE"), nullable=False)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    user = relationship("User", back_populates="saved_listings")
    listing = relationship("Listing", back_populates="saved_by")

    __table_args__ = (UniqueConstraint("user_id", "listing_id", name="uq_user_listing_save"),)
