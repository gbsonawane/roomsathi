import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, Integer, DateTime, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy import ForeignKey
from backend.db.database import Base


class ContactUnlock(Base):
    __tablename__ = "contact_unlocks"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    seeker_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    listing_id = Column(UUID(as_uuid=True), ForeignKey("listings.id", ondelete="CASCADE"), nullable=False)
    unlock_type = Column(String(20), nullable=False)  # single | plan
    amount_paid = Column(Integer, nullable=False)
    payment_id = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    __table_args__ = (UniqueConstraint("seeker_id", "listing_id", name="uq_seeker_listing"),)
