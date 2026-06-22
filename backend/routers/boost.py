from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update
from datetime import datetime, timedelta, timezone
from backend.db.dependencies import get_db, get_current_user
from backend.schemas.payment import BoostRequest, CreateOrderResponse, BoostConfirmRequest
from backend.schemas.listing import PRICING
from backend.models.listing import Listing
from backend.models.listing_boost import ListingBoost
from backend.models.payment import Payment
from backend.services.payment_service import create_razorpay_order, verify_razorpay_signature
from backend.core.config import settings
from backend.core.exceptions import NotFoundError, ForbiddenError, BadRequestError

router = APIRouter(prefix="/boost", tags=["boost"])


@router.post("/")
async def boost_listing(
    body: BoostRequest,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """Initiate listing boost payment."""
    # Get listing
    result = await db.execute(select(Listing).where(Listing.id == body.listing_id))
    listing = result.scalar_one_or_none()
    if not listing:
        raise NotFoundError("Listing not found")
    if listing.owner_id != current_user.id:
        raise ForbiddenError("You can only boost your own listings")

    if body.boost_days == 7:
        amount = PRICING["boost_7"] * 100
        payment_type = "boost_7"
    elif body.boost_days == 15:
        amount = PRICING["boost_15"] * 100
        payment_type = "boost_15"
    else:
        raise BadRequestError("boost_days must be 7 or 15")

    order = create_razorpay_order(amount, receipt=f"boost_{listing.id}")

    payment = Payment(
        user_id=current_user.id,
        payment_type=payment_type,
        amount=amount // 100,
        razorpay_order_id=order["id"],
        status="pending",
        extra_data={"listing_id": body.listing_id, "boost_days": body.boost_days},
    )
    db.add(payment)
    await db.flush()

    return {
        "status": "payment_required",
        "order_id": order["id"],
        "amount": amount,
        "currency": "INR",
        "key_id": settings.RAZORPAY_KEY_ID,
    }


@router.post("/confirm")
async def confirm_boost(
    body: BoostConfirmRequest,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """Confirm boost payment and activate boost."""
    # Verify signature
    valid = verify_razorpay_signature(
        body.razorpay_order_id, body.razorpay_payment_id, body.razorpay_signature
    )
    if not valid:
        raise BadRequestError("Payment verification failed")

    # Update payment record
    result = await db.execute(
        select(Payment).where(Payment.razorpay_order_id == body.razorpay_order_id)
    )
    payment = result.scalar_one_or_none()
    if payment:
        payment.razorpay_payment_id = body.razorpay_payment_id
        payment.status = "success"

    listing_id = body.listing_id
    boost_days = body.boost_days

    result = await db.execute(select(Listing).where(Listing.id == listing_id))
    listing = result.scalar_one_or_none()
    if not listing:
        raise NotFoundError("Listing not found")

    now = datetime.now(timezone.utc)
    expires = now + timedelta(days=boost_days)

    listing.is_boosted = True
    listing.boost_expires_at = expires

    boost = ListingBoost(
        listing_id=listing.id,
        owner_id=current_user.id,
        boost_days=boost_days,
        amount_paid=PRICING.get(f"boost_{boost_days}", 49),
        starts_at=now,
        expires_at=expires,
    )
    db.add(boost)
    await db.flush()

    return {"status": "boosted", "expires_at": expires.isoformat()}
