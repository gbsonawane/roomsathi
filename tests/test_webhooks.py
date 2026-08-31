"""
Phase 1 Item 5 — Razorpay webhook must require secret + valid signature.
"""
import hashlib
import hmac
import json
import re
from pathlib import Path

import pytest

from backend.core.config import settings

WEBHOOKS_PATH = Path(__file__).resolve().parents[1] / "backend" / "routers" / "webhooks.py"
TEST_SECRET = "test_webhook_secret_value_32chars!!"


def _sign(body: bytes, secret: str = TEST_SECRET) -> str:
    return hmac.new(secret.encode(), body, hashlib.sha256).hexdigest()


def _payload(event="payment.captured", order_id="order_abc", payment_id="pay_xyz"):
    return {
        "event": event,
        "payload": {
            "payment": {
                "entity": {
                    "order_id": order_id,
                    "id": payment_id,
                }
            }
        },
    }


@pytest.mark.asyncio
class TestRazorpayWebhookSecurity:
    async def test_5_1_valid_signature_secret_set(self, test_client, monkeypatch):
        """Valid signature + secret set → 200, event processed."""
        monkeypatch.setattr(settings, "RAZORPAY_WEBHOOK_SECRET", TEST_SECRET)
        body = json.dumps(_payload()).encode()
        resp = await test_client.post(
            "/webhooks/razorpay",
            content=body,
            headers={
                "Content-Type": "application/json",
                "X-Razorpay-Signature": _sign(body),
            },
        )
        assert resp.status_code == 200
        assert resp.json().get("status") == "ok"

    async def test_5_2_missing_signature_header(self, test_client, monkeypatch):
        """Same payload, no X-Razorpay-Signature → rejected."""
        monkeypatch.setattr(settings, "RAZORPAY_WEBHOOK_SECRET", TEST_SECRET)
        body = json.dumps(_payload()).encode()
        resp = await test_client.post(
            "/webhooks/razorpay",
            content=body,
            headers={"Content-Type": "application/json"},
        )
        assert resp.status_code in (400, 401)

    async def test_5_3_invalid_tampered_signature(self, test_client, monkeypatch):
        """Wrong/tampered signature → rejected."""
        monkeypatch.setattr(settings, "RAZORPAY_WEBHOOK_SECRET", TEST_SECRET)
        body = json.dumps(_payload()).encode()
        resp = await test_client.post(
            "/webhooks/razorpay",
            content=body,
            headers={
                "Content-Type": "application/json",
                "X-Razorpay-Signature": "0" * 64,
            },
        )
        assert resp.status_code in (400, 401)

        # Tamper after signing
        signed = _sign(body)
        tampered = json.dumps(_payload(order_id="order_TAMPERED")).encode()
        resp2 = await test_client.post(
            "/webhooks/razorpay",
            content=tampered,
            headers={
                "Content-Type": "application/json",
                "X-Razorpay-Signature": signed,
            },
        )
        assert resp2.status_code in (400, 401)

    async def test_5_4_secret_env_unset_rejects(self, test_client, monkeypatch):
        """Unset RAZORPAY_WEBHOOK_SECRET → must reject (not silently accept)."""
        monkeypatch.setattr(settings, "RAZORPAY_WEBHOOK_SECRET", "")
        body = json.dumps(_payload()).encode()
        # Even with a "valid-looking" signature, must reject when secret unset
        resp = await test_client.post(
            "/webhooks/razorpay",
            content=body,
            headers={
                "Content-Type": "application/json",
                "X-Razorpay-Signature": _sign(body, "any"),
            },
        )
        assert resp.status_code in (401, 500), (
            f"Webhook must reject when secret unset, got {resp.status_code}: {resp.text}"
        )

    async def test_5_5_replay_is_idempotent(self, test_client, monkeypatch):
        """Resending a previously valid webhook must not error / double-credit."""
        monkeypatch.setattr(settings, "RAZORPAY_WEBHOOK_SECRET", TEST_SECRET)
        body = json.dumps(_payload(payment_id="pay_replay_1")).encode()
        headers = {
            "Content-Type": "application/json",
            "X-Razorpay-Signature": _sign(body),
        }
        first = await test_client.post("/webhooks/razorpay", content=body, headers=headers)
        second = await test_client.post("/webhooks/razorpay", content=body, headers=headers)
        assert first.status_code == 200
        assert second.status_code == 200
        assert first.json().get("status") == "ok"
        assert second.json().get("status") == "ok"

    def test_5_6_no_fallback_bypass_in_code(self):
        """Logic must require secret AND signature — not 'validate only if secret set'."""
        text = WEBHOOKS_PATH.read_text(encoding="utf-8")
        # Forbidden pattern: if settings.RAZORPAY_WEBHOOK_SECRET: <validate>
        # followed by processing outside that if (skip validation when unset)
        bypass = re.search(
            r"if\s+settings\.RAZORPAY_WEBHOOK_SECRET\s*:",
            text,
        )
        assert bypass is None, (
            "webhooks.py still uses 'validate only if secret is set' bypass — "
            "must reject when secret is missing"
        )
        assert "RAZORPAY_WEBHOOK_SECRET" in text
        assert "X-Razorpay-Signature" in text or "x-razorpay-signature" in text.lower()
        # Must explicitly reject when unset
        assert (
            "not set" in text.lower()
            or "not configured" in text.lower()
            or "Webhook not configured" in text
        )
