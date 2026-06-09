import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, Integer, DateTime, Text
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy import ForeignKey
from backend.db.database import Base


class Payment(Base):
    __tablename__ = "payments"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    payment_type = Column(String(30), nullable=False)  # contact_unlock | monthly_plan | listing_standard | listing_premium | boost_7 | boost_15
    amount = Column(Integer, nullable=False)
    currency = Column(String(10), default="INR")
    razorpay_order_id = Column(Text, nullable=True)
    razorpay_payment_id = Column(Text, nullable=True)
    status = Column(String(20), default="pending")  # pending | success | failed | refunded
    extra_data = Column("metadata", JSONB, default=dict)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
