from fastapi import APIRouter, Request, HTTPException
from backend.services.payment_service import verify_razorpay_signature
from backend.core.config import settings
import logging
import hmac
import hashlib
import json

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/webhooks", tags=["webhooks"])


@router.post("/razorpay")
async def razorpay_webhook(request: Request):
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
            logger.warning(f"Invalid webhook signature received")
            raise HTTPException(status_code=400, detail="Invalid webhook signature")

        parsed = json.loads(body)
        event = parsed.get("event", "")
        logger.info(f"Razorpay webhook: {event}")

        if event == "payment.captured":
            payment_entity = parsed.get("payload", {}).get("payment", {}).get("entity", {})
            order_id = payment_entity.get("order_id")
            payment_id = payment_entity.get("id")
            logger.info(f"Payment captured: order={order_id}, payment={payment_id}")
            # TODO(idempotency): when this webhook starts crediting payments/bookings,
            # dedupe by payment_id/order_id so replayed payloads cannot double-credit.
            # Deferred until webhook actually mutates payment state (currently log-only).
            # Payment confirmation is handled by the /unlock/confirm endpoint

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
