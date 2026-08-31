"""
Phase 2 Item 7 — Secure OTP generation.
"""
import ast
import collections
import re
from datetime import datetime, timedelta, timezone
from pathlib import Path

import pytest

from backend.core.security import generate_otp
from backend.services.auth_service import save_otp, verify_otp_code
from backend.models.otp import OTPCode

SECURITY_PATH = Path(__file__).resolve().parents[1] / "backend" / "core" / "security.py"


class TestOtpGenerationCode:
    def test_7_1_no_random_module_for_otp(self):
        text = SECURITY_PATH.read_text(encoding="utf-8")
        assert "import random" not in text
        assert "random.choices" not in text
        assert "random.randint" not in text

    def test_7_2_uses_secrets_module(self):
        text = SECURITY_PATH.read_text(encoding="utf-8")
        assert "import secrets" in text
        tree = ast.parse(text)
        found = False
        for node in tree.body:
            if isinstance(node, ast.FunctionDef) and node.name == "generate_otp":
                src = ast.get_source_segment(text, node) or ""
                assert "secrets." in src
                found = True
        assert found, "generate_otp() not found"

    def test_7_3_correct_format(self):
        for _ in range(100):
            otp = generate_otp()
            assert len(otp) == 6
            assert otp.isdigit()
        assert len(generate_otp(4)) == 4
        assert generate_otp(4).isdigit()

    def test_7_4_statistical_spread(self):
        """Sanity check: digit frequencies roughly uniform over 10k OTPs."""
        counts = collections.Counter()
        n = 10_000
        for _ in range(n):
            for ch in generate_otp():
                counts[ch] += 1
        total_digits = n * 6
        expected = total_digits / 10
        for digit, count in counts.items():
            # Allow ±15% relative deviation
            assert abs(count - expected) / expected < 0.15, (
                f"Digit {digit} biased: {count} vs expected ~{expected:.0f}"
            )


@pytest.mark.asyncio
class TestOtpLifecycle:
    async def test_7_5_otp_expiry_enforced(self, db_session):
        phone = "9876500001"
        await save_otp(db_session, phone, "123456")
        # Force expiry
        from sqlalchemy import select

        result = await db_session.execute(
            select(OTPCode).where(OTPCode.phone == phone)
        )
        record = result.scalar_one()
        record.expires_at = datetime.now(timezone.utc) - timedelta(minutes=1)
        await db_session.flush()

        assert await verify_otp_code(db_session, phone, "123456") is False

    async def test_7_6_otp_single_use(self, db_session):
        phone = "9876500002"
        await save_otp(db_session, phone, "654321")
        assert await verify_otp_code(db_session, phone, "654321") is True
        assert await verify_otp_code(db_session, phone, "654321") is False

    async def test_7_7_rate_limiting_flagged_or_present(self):
        """Rate limiting should exist on send-otp (slowapi)."""
        auth = (
            Path(__file__).resolve().parents[1] / "backend" / "routers" / "auth.py"
        ).read_text(encoding="utf-8")
        assert "@limiter.limit" in auth or "limiter.limit" in auth, (
            "GAP: OTP request rate limiting not implemented on send-otp"
        )
