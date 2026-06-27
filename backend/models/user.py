import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, Boolean, Integer, DateTime, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from backend.db.database import Base


class User(Base):
    __tablename__ = "users"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    full_name = Column(Text, nullable=False)
    phone = Column(String(20), unique=True, nullable=True)
    email = Column(String(255), unique=True, nullable=True)
    avatar_url = Column(Text, nullable=True)
    hashed_password = Column(Text, nullable=True)
    role = Column(String(20), nullable=False, default="seeker")  # seeker | owner | admin
    is_active = Column(Boolean, default=True)
    is_verified = Column(Boolean, default=False)
    aadhar_verified = Column(Boolean, default=False)
    plan_type = Column(String(20), default="free")  # free | monthly
    plan_expires_at = Column(DateTime(timezone=True), nullable=True)
    contacts_used_today = Column(Integer, default=0)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    # Relationships
    listings = relationship("Listing", back_populates="owner", cascade="all, delete-orphan")
    saved_listings = relationship("SavedListing", back_populates="user", cascade="all, delete-orphan")
    notifications = relationship("Notification", back_populates="user", cascade="all, delete-orphan")
