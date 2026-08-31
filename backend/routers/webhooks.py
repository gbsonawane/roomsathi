from datetime import datetime, timedelta, timezone
from uuid import UUID

from fastapi import APIRouter, Request, HTTPException, Depends
from sqlalchemy import select, and_
from sqlalchemy.ext.asyncio import AsyncSession

from backend.db.dependencies import get_db
from backend.models.payment import Payment
from backend.models.contact_unlock import ContactUnlock
from backend.models.user import User
from backend.models.listing import Listing
from backend.core.config import settings
import logging
import hmac
import hashlib
import json

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/webhooks", tags=["webhooks"])


def _as_uuid(value):
    if value is None:
        return None
    if isinstance(value, UUID):
        return value
    try:
        return UUID(str(value))
    except (ValueError, TypeError):
        return None


@router.post("/razorpay")
async def razorpay_webhook(
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    """Handle Razorpay webhook events."""
    try:
        webhook_secret = settings.RAZORPAY_WEBHOOK_SECRET
        if not webhook_secret:
            logger.error("RAZORPAY_WEBHOOK_SECRET is not set — rejecting webhook call")
            raise HTTPException(
                status_code=500,
                detail="Webhook not configured on server"
            )

        signature = request.headers.get("X-Razorpay-Signature")
        if not signature:
            logger.warning("Webhook received without signature header")
            raise HTTPException(status_code=400, detail="Missing webhook signature")

        body = await request.body()
        expected = hmac.new(
            webhook_secret.encode(),
            body,
            hashlib.sha256
        ).hexdigest()

        if not hmac.compare_digest(expected, signature):
            logger.warning("Invalid webhook signature received")
            raise HTTPException(status_code=400, detail="Invalid webhook signature")

        parsed = json.loads(body)
        event = parsed.get("event", "")
        logger.info(f"Razorpay webhook: {event}")

        if event == "payment.captured":
            payment_entity = parsed.get("payload", {}).get("payment", {}).get("entity", {})
            order_id = payment_entity.get("order_id")
            payment_id = payment_entity.get("id")
            logger.info(f"Payment captured: order={order_id}, payment={payment_id}")

            result = await db.execute(
                select(Payment).where(Payment.razorpay_order_id == order_id)
            )
            payment = result.scalar_one_or_none()

            if not payment:
                logger.warning(f"No Payment row for order_id={order_id} — skipping")
            elif payment.status == "success":
                logger.info(
                    f"Payment {payment.id} already success — idempotent skip "
                    f"(order={order_id}, payment_id={payment_id})"
                )
            else:
                payment.status = "success"
                payment.razorpay_payment_id = payment_id

                meta = payment.extra_data or {}
                listing_id = _as_uuid(meta.get("listing_id"))
                unlock_type = meta.get("unlock_type")

                if unlock_type in ("single", "plan") and listing_id:
                    existing = await db.execute(
                        select(ContactUnlock).where(
                            and_(
                                ContactUnlock.seeker_id == payment.user_id,
                                ContactUnlock.listing_id == listing_id,
                            )
                        )
                    )
                    if not existing.scalar_one_or_none():
                        db.add(
                            ContactUnlock(
                                seeker_id=payment.user_id,
                                listing_id=listing_id,
                                unlock_type=unlock_type,
                                amount_paid=payment.amount or 0,
                                payment_id=payment_id,
                            )
                        )
                        listing_result = await db.execute(
                            select(Listing).where(Listing.id == listing_id)
                        )
                        listing = listing_result.scalar_one_or_none()
                        if listing:
                            listing.unlock_count = (listing.unlock_count or 0) + 1

                if unlock_type == "plan":
                    user_result = await db.execute(
                        select(User).where(User.id == payment.user_id)
                    )
                    user = user_result.scalar_one_or_none()
                    if user:
                        user.plan_type = "monthly"
                        user.plan_expires_at = datetime.now(timezone.utc) + timedelta(days=30)

                await db.flush()
                logger.info(
                    f"Webhook credited payment {payment.id} "
                    f"(order={order_id}, unlock_type={unlock_type})"
                )

        elif event == "payment.failed":
            payment_entity = parsed.get("payload", {}).get("payment", {}).get("entity", {})
            logger.warning(f"Payment failed: {payment_entity.get('id')}")

        return {"status": "ok"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error in {__name__}: {e}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail="Something went wrong. Please try again."
        )
