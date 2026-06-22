import uuid
from datetime import datetime, timezone, date
from sqlalchemy import Column, String, Boolean, Integer, DateTime, Text, Date, Numeric, ARRAY
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from sqlalchemy import ForeignKey
from backend.db.database import Base


class Listing(Base):
    __tablename__ = "listings"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    owner_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    listing_type = Column(String(20), nullable=False, default="room_available")

    title = Column(Text, nullable=True)
    property_type = Column(String(30), nullable=False)
    gender_preference = Column(String(20), nullable=False, default="any")
    furnishing = Column(String(20), nullable=False, default="unfurnished")
    floor = Column(String(20), nullable=True)
    parking = Column(String(20), default="none")

    city = Column(Text, nullable=False)
    area = Column(Text, nullable=False)
    full_address = Column(Text, nullable=True)
    latitude = Column(Numeric(10, 8), nullable=True)
    longitude = Column(Numeric(11, 8), nullable=True)

    rent = Column(Integer, nullable=False)
    deposit = Column(Integer, nullable=False)
    available_from = Column(Date, nullable=False)
    description = Column(Text, nullable=True)

    photos = Column(ARRAY(Text), default=list)

    listing_plan = Column(String(20), nullable=False, default="basic")
    is_boosted = Column(Boolean, default=False)
    boost_expires_at = Column(DateTime(timezone=True), nullable=True)
    is_active = Column(Boolean, default=True)
    is_verified = Column(Boolean, default=False)
    expires_at = Column(DateTime(timezone=True), nullable=True)

    view_count = Column(Integer, default=0)
    unlock_count = Column(Integer, default=0)
    save_count = Column(Integer, default=0)

    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    # Relationships
    owner = relationship("User", back_populates="listings")
    saved_by = relationship("SavedListing", back_populates="listing", cascade="all, delete-orphan")
