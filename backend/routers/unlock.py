from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_
from datetime import datetime, timedelta, timezone
from backend.db.dependencies import get_db, get_current_user
from backend.schemas.payment import UnlockRequest, UnlockConfirmRequest, CreateOrderResponse
from backend.schemas.listing import PRICING
from backend.models.contact_unlock import ContactUnlock
from backend.models.listing import Listing
from backend.models.payment import Payment
from backend.models.user import User
from backend.services.payment_service import create_razorpay_order, verify_razorpay_signature
from backend.services.notification_service import notify_owner_contact_unlocked
from backend.core.config import settings
from backend.core.exceptions import BadRequestError, NotFoundError
import uuid

router = APIRouter(prefix="/unlock", tags=["unlock"])


@router.post("/")
async def unlock_contact(
    body: UnlockRequest,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """Initiate contact unlock — check existing unlock or create Razorpay order."""
    # Check if already unlocked
    result = await db.execute(
        select(ContactUnlock).where(
            and_(
                ContactUnlock.seeker_id == current_user.id,
                ContactUnlock.listing_id == body.listing_id,
            )
        )
    )
    existing = result.scalar_one_or_none()

    # Get listing + owner info
    listing_result = await db.execute(select(Listing).where(Listing.id == body.listing_id))
    listing = listing_result.scalar_one_or_none()
    if not listing:
        raise NotFoundError("Listing not found")

    owner_result = await db.execute(select(User).where(User.id == listing.owner_id))
    owner = owner_result.scalar_one_or_none()

    if existing:
        return {
            "status": "already_unlocked",
            "owner_phone": owner.phone if owner else None,
            "owner_name": owner.full_name if owner else None,
        }

    # Check if user has active monthly plan
    if current_user.plan_type == "monthly" and current_user.plan_expires_at and current_user.plan_expires_at > datetime.now(timezone.utc):
        # Auto-unlock with plan
        unlock = ContactUnlock(
            seeker_id=current_user.id,
            listing_id=body.listing_id,
            unlock_type="plan",
            amount_paid=0,
        )
        db.add(unlock)
        listing.unlock_count = (listing.unlock_count or 0) + 1
        await db.flush()

        if owner:
            await notify_owner_contact_unlocked(db, owner.id, current_user.full_name, listing.title)

        return {
            "status": "unlocked_with_plan",
            "owner_phone": owner.phone if owner else None,
            "owner_name": owner.full_name if owner else None,
        }

    # Create Razorpay order
    if body.unlock_type == "single":
        amount = PRICING["contact_single"] * 100  # paise
    elif body.unlock_type == "plan":
        amount = PRICING["monthly_plan"] * 100
    else:
        raise BadRequestError("Invalid unlock_type. Use 'single' or 'plan'")

    order = create_razorpay_order(amount, receipt=f"unlock_{current_user.id}_{body.listing_id}")

    # Save pending payment
    payment = Payment(
        user_id=current_user.id,
        payment_type="contact_unlock" if body.unlock_type == "single" else "monthly_plan",
        amount=amount // 100,
        razorpay_order_id=order["id"],
        status="pending",
        extra_data={"listing_id": body.listing_id, "unlock_type": body.unlock_type},
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
async def confirm_unlock(
    body: UnlockConfirmRequest,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """Confirm Razorpay payment and finalize contact unlock."""
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

    # Get listing + owner
    listing_result = await db.execute(select(Listing).where(Listing.id == body.listing_id))
    listing = listing_result.scalar_one_or_none()
    if not listing:
        raise NotFoundError("Listing not found")

    owner_result = await db.execute(select(User).where(User.id == listing.owner_id))
    owner = owner_result.scalar_one_or_none()

    # Create unlock record
    unlock = ContactUnlock(
        seeker_id=current_user.id,
        listing_id=body.listing_id,
        unlock_type=body.unlock_type,
        amount_paid=payment.amount if payment else 0,
        payment_id=body.razorpay_payment_id,
    )
    db.add(unlock)

    # Update listing unlock count
    listing.unlock_count = (listing.unlock_count or 0) + 1

    # If plan unlock, update user plan
    if body.unlock_type == "plan":
        current_user.plan_type = "monthly"
        current_user.plan_expires_at = datetime.now(timezone.utc) + timedelta(days=30)

    await db.flush()

    # Notify owner
    if owner:
        await notify_owner_contact_unlocked(db, owner.id, current_user.full_name, listing.title)

    return {
        "status": "unlocked",
        "owner_phone": owner.phone if owner else None,
        "owner_name": owner.full_name if owner else None,
    }
