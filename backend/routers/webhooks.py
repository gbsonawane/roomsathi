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
        raw_body = await request.body()
        
        if settings.RAZORPAY_WEBHOOK_SECRET:
            signature = request.headers.get("X-Razorpay-Signature")
            if not signature:
                raise HTTPException(status_code=400, detail="Missing signature")
            
            expected = hmac.HMAC(
                settings.RAZORPAY_WEBHOOK_SECRET.encode(),
                raw_body,
                hashlib.sha256,
            ).hexdigest()
            
            if not hmac.compare_digest(expected, signature):
                raise HTTPException(status_code=400, detail="Invalid signature")

        body = json.loads(raw_body)
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
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Webhook error: {e}")
        return {"status": "error", "message": str(e)}
