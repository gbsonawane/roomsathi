from pydantic import BaseModel
from typing import Optional
import uuid
from datetime import datetime


class PaymentResponse(BaseModel):
    id: uuid.UUID
    user_id: uuid.UUID
    payment_type: str
    amount: int
    currency: str
    razorpay_order_id: Optional[str] = None
    razorpay_payment_id: Optional[str] = None
    status: str
    created_at: datetime

    class Config:
        from_attributes = True


class UnlockRequest(BaseModel):
    listing_id: str
    unlock_type: str  # single | plan


class UnlockConfirmRequest(BaseModel):
    razorpay_order_id: str
    razorpay_payment_id: str
    razorpay_signature: str
    listing_id: str
    unlock_type: str


class BoostRequest(BaseModel):
    listing_id: str
    boost_days: int  # 7 | 15


class CreateOrderResponse(BaseModel):
    order_id: str
    amount: int
    currency: str
    key_id: str
