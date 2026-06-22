import hmac
import hashlib
import logging
from backend.core.config import settings

logger = logging.getLogger(__name__)


def create_razorpay_order(amount_paise: int, currency: str = "INR", receipt: str = "") -> dict:
    """Create a Razorpay order. Returns mock data in dev mode if keys not configured."""
    if not settings.RAZORPAY_KEY_ID or settings.RAZORPAY_KEY_ID == "your_razorpay_key_id":
        # Dev mode — return mock order
        import uuid
        mock_order_id = f"order_dev_{uuid.uuid4().hex[:12]}"
        logger.info(f"[DEV MODE] Mock Razorpay order: {mock_order_id}, amount: {amount_paise}")
        return {
            "id": mock_order_id,
            "amount": amount_paise,
            "currency": currency,
            "status": "created",
        }

    try:
        import razorpay
        client = razorpay.Client(auth=(settings.RAZORPAY_KEY_ID, settings.RAZORPAY_KEY_SECRET))
        order_data = {
            "amount": amount_paise,
            "currency": currency,
            "receipt": receipt,
        }
        order = client.order.create(data=order_data)
        return order
    except Exception as e:
        logger.error(f"Razorpay order creation failed: {e}")
        raise


def verify_razorpay_signature(order_id: str, payment_id: str, signature: str) -> bool:
    """Verify Razorpay payment signature."""
    if not settings.RAZORPAY_KEY_SECRET or settings.RAZORPAY_KEY_SECRET == "your_razorpay_key_secret":
        # Dev mode — always accept
        logger.info("[DEV MODE] Skipping Razorpay signature verification")
        return True

    try:
        message = f"{order_id}|{payment_id}"
        expected = hmac.HMAC(
            settings.RAZORPAY_KEY_SECRET.encode(),
            message.encode(),
            hashlib.sha256,
        ).hexdigest()
        return hmac.compare_digest(expected, str(signature))
    except Exception as e:
        logger.error(f"Razorpay signature verification failed: {e}")
        return False
