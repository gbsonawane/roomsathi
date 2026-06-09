from fastapi import APIRouter, Request
from backend.services.payment_service import verify_razorpay_signature
import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/webhooks", tags=["webhooks"])


@router.post("/razorpay")
async def razorpay_webhook(request: Request):
    """Handle Razorpay webhook events."""
    try:
        body = await request.json()
        event = body.get("event", "")
        logger.info(f"Razorpay webhook: {event}")

        if event == "payment.captured":
            payment_entity = body.get("payload", {}).get("payment", {}).get("entity", {})
            order_id = payment_entity.get("order_id")
            payment_id = payment_entity.get("id")
            logger.info(f"Payment captured: order={order_id}, payment={payment_id}")
            # Payment confirmation is handled by the /unlock/confirm endpoint

        elif event == "payment.failed":
            payment_entity = body.get("payload", {}).get("payment", {}).get("entity", {})
            logger.warning(f"Payment failed: {payment_entity.get('id')}")

        return {"status": "ok"}
    except Exception as e:
        logger.error(f"Webhook error: {e}")
        return {"status": "error", "message": str(e)}
