"""
Security fixes: admin bcrypt, OTP attempt limits, upload magic bytes.
Tests written to FAIL against pre-fix code, then pass after fixes.
"""
import io
import inspect
import re
from pathlib import Path

import pytest
from sqlalchemy import select

from backend.core.security import hash_password, verify_password
from backend.models.otp import OTPCode
from tests.conftest import _headers_for, _make_user

REPO = Path(__file__).resolve().parents[1]
AUTH_PY = REPO / "backend" / "routers" / "auth.py"
LISTINGS_PY = REPO / "backend" / "routers" / "listings.py"
ADMIN_AUTH_JS = REPO / "frontend" / "lib" / "adminAuth.js"
ADMIN_JS = REPO / "frontend" / "pages" / "admin.js"


# ── 1. Admin password hashing ───────────────────────────────────────────────

class TestAdminPasswordHashing:
    def test_admin_login_must_not_use_plaintext_compare(self):
        """FAILS while auth.py still does body.password != settings.ADMIN_SECRET_PASSWORD."""
        text = AUTH_PY.read_text(encoding="utf-8")
        assert "body.password != settings.ADMIN_SECRET_PASSWORD" not in text, (
            "Admin login still uses plaintext != comparison — must use verify_password()"
        )
        assert "verify_password" in text

    @pytest.mark.asyncio
    async def test_admin_login_accepts_bcrypt_hash(self, test_client, db_session, monkeypatch):
        from backend.core.config import settings

        plain = "SuperSecretAdmin!99"
        hashed = hash_password(plain)
        monkeypatch.setattr(settings, "ADMIN_SECRET_PASSWORD", hashed)

        admin = _make_user(role="admin", phone="9100000099", email="admin@roomsathi.in")
        db_session.add(admin)
        await db_session.flush()

        # Wrong password rejected
        bad = await test_client.post(
            "/auth/admin-login",
            json={"email": "admin@roomsathi.in", "password": "wrong"},
        )
        assert bad.status_code == 401

        # Correct password against bcrypt hash accepted
        good = await test_client.post(
            "/auth/admin-login",
            json={"email": "admin@roomsathi.in", "password": plain},
        )
        assert good.status_code == 200
        assert "access_token" in good.json()

    def test_plaintext_env_value_does_not_match_via_verify_password(self):
        """Storing plaintext in ADMIN_SECRET_PASSWORD must not verify as a bcrypt hash."""
        assert verify_password("Admin@123", "Admin@123") is False


# ── 2. OTP verify rate limit + attempt counter ──────────────────────────────

class TestOtpVerifyHardening:
    def test_verify_otp_and_google_have_rate_limit_decorators(self):
        text = AUTH_PY.read_text(encoding="utf-8")
        verify_idx = text.find('@router.post("/verify-otp"')
        google_idx = text.find('@router.post("/google"')
        assert verify_idx != -1 and google_idx != -1
        # limter sits on the next line(s) after @router.post
        verify_window = text[verify_idx : verify_idx + 250]
        google_window = text[google_idx : google_idx + 250]
        assert "@limiter.limit" in verify_window, (
            "/auth/verify-otp missing @limiter.limit decorator"
        )
        assert "@limiter.limit" in google_window, (
            "/auth/google missing @limiter.limit decorator"
        )

    @pytest.mark.asyncio
    async def test_otp_invalidated_after_five_failed_attempts(self, test_client, db_session):
        """Brute-force within validity window: 5 wrong guesses invalidate the OTP."""
        phone = "9876511111"
        send = await test_client.post("/auth/send-otp", json={"phone": phone})
        assert send.status_code == 200
        real_otp = send.json()["dev_otp"]

        for i in range(5):
            wrong = await test_client.post(
                "/auth/verify-otp",
                json={"phone": phone, "otp": f"{i:06d}" if f"{i:06d}" != real_otp else "999999"},
            )
            assert wrong.status_code in (400, 429), wrong.text

        # Even the correct OTP must now fail
        late = await test_client.post(
            "/auth/verify-otp",
            json={"phone": phone, "otp": real_otp, "full_name": "Brute"},
        )
        assert late.status_code == 400, (
            "OTP still accepted after 5 failed attempts — brute-force window open"
        )


# ── 3. Upload magic-byte validation ─────────────────────────────────────────

JPEG_MAGIC = bytes([0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10]) + b"JFIF" + b"\x00" * 20
PNG_MAGIC = bytes([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]) + b"\x00" * 20
# Fake executable pretending to be JPEG via MIME/extension
FAKE_JPEG = b"MZ\x90\x00This is not a JPEG" + b"\x00" * 40


class TestUploadMagicBytes:
    def test_upload_endpoint_mentions_magic_or_signature_check(self):
        text = LISTINGS_PY.read_text(encoding="utf-8")
        assert any(
            needle in text.lower()
            for needle in ("magic", "ff d8", "\\xff\\xd8", "b\"\\xff\\xd8", "startswith", "riff")
        ), "upload_photos has no magic-byte / signature check yet"

    @pytest.mark.asyncio
    async def test_rejects_non_image_bytes_with_image_mime(
        self, test_client, test_user, user_headers, monkeypatch
    ):
        """MIME says image/jpeg + .jpg name, but bytes are not JPEG → must 400."""
        from backend.core.config import settings
        monkeypatch.setattr(settings, "STORAGE_BACKEND", "local")
        resp = await test_client.post(
            "/listings/upload-photos",
            headers=user_headers,
            files=[("files", ("evil.jpg", FAKE_JPEG, "image/jpeg"))],
        )
        assert resp.status_code in (400, 422), (
            f"Spoofed JPEG accepted with status {resp.status_code}: {resp.text}"
        )

    @pytest.mark.asyncio
    async def test_accepts_real_jpeg_bytes(self, test_client, user_headers, monkeypatch):
        from backend.core.config import settings
        monkeypatch.setattr(settings, "STORAGE_BACKEND", "local")
        resp = await test_client.post(
            "/listings/upload-photos",
            headers=user_headers,
            files=[("files", ("ok.jpg", JPEG_MAGIC, "image/jpeg"))],
        )
        assert resp.status_code == 200, resp.text
        assert "urls" in resp.json()


# ── 4. Admin frontend localhost fallback ────────────────────────────────────

class TestAdminFrontendNoLocalhostFallback:
    def test_admin_auth_js_no_localhost_fallback(self):
        text = ADMIN_AUTH_JS.read_text(encoding="utf-8")
        assert '"http://localhost:8000"' not in text and "'http://localhost:8000'" not in text, (
            "adminAuth.js still silently falls back to localhost:8000"
        )

    def test_admin_js_no_localhost_fallback(self):
        text = ADMIN_JS.read_text(encoding="utf-8")
        assert '"http://localhost:8000"' not in text and "'http://localhost:8000'" not in text, (
            "admin.js still silently falls back to localhost:8000"
        )
