"""Tests for auth routes: send-otp, verify-otp, dev-login."""
import pytest
import pytest_asyncio
from unittest.mock import patch, AsyncMock
from tests.conftest import _make_user, _headers_for


@pytest.mark.asyncio
class TestAuthRoutes:
    async def test_send_otp_phone_success(self, test_client, db_session):
        """POST /auth/send-otp returns 200 with dev_otp in dev mode."""
        resp = await test_client.post("/auth/send-otp", json={"phone": "9876543210"})
        assert resp.status_code == 200
        data = resp.json()
        assert "message" in data
        assert "dev_otp" in data

    async def test_send_otp_email_success(self, test_client, db_session):
        """POST /auth/send-otp with email returns 200."""
        resp = await test_client.post("/auth/send-otp", json={"phone": "test@example.com"})
        assert resp.status_code == 200
        assert "message" in resp.json()

    async def test_verify_otp_success(self, test_client, db_session):
        """Full flow: send OTP then verify it."""
        send_resp = await test_client.post("/auth/send-otp", json={"phone": "9876543211"})
        assert send_resp.status_code == 200
        otp = send_resp.json()["dev_otp"]

        verify_resp = await test_client.post("/auth/verify-otp", json={
            "phone": "9876543211", "otp": otp, "full_name": "Test User"
        })
        assert verify_resp.status_code == 200
        data = verify_resp.json()
        assert "access_token" in data
        assert "user" in data
        assert data["user"]["phone"] == "9876543211"

    async def test_verify_otp_wrong_code(self, test_client, db_session):
        """Verify OTP with wrong code returns 400."""
        await test_client.post("/auth/send-otp", json={"phone": "9876543212"})
        resp = await test_client.post("/auth/verify-otp", json={
            "phone": "9876543212", "otp": "000000"
        })
        assert resp.status_code == 400

    async def test_verify_otp_already_used(self, test_client, db_session):
        """Using same OTP twice returns 400 on second use."""
        send_resp = await test_client.post("/auth/send-otp", json={"phone": "9876543213"})
        otp = send_resp.json()["dev_otp"]

        # First use
        r1 = await test_client.post("/auth/verify-otp", json={
            "phone": "9876543213", "otp": otp
        })
        assert r1.status_code == 200

        # Second use
        r2 = await test_client.post("/auth/verify-otp", json={
            "phone": "9876543213", "otp": otp
        })
        assert r2.status_code == 400

    async def test_dev_login_works_in_development(self, test_client, db_session):
        """POST /auth/dev-login works when ENVIRONMENT=development."""
        resp = await test_client.post("/auth/dev-login", json={
            "phone": "9999999999", "otp": "000000", "full_name": "Dev User"
        })
        assert resp.status_code == 200
        assert "access_token" in resp.json()

    async def test_dev_login_blocked_in_production(self, test_client, db_session):
        """POST /auth/dev-login returns 403 in production."""
        from backend.core.config import settings
        original = settings.ENVIRONMENT
        settings.ENVIRONMENT = "production"
        resp = await test_client.post("/auth/dev-login", json={
            "phone": "9999999998", "otp": "000000"
        })
        settings.ENVIRONMENT = original
        assert resp.status_code == 403

    async def test_new_user_created_on_first_login(self, test_client, db_session):
        """First login creates user with role=seeker."""
        send = await test_client.post("/auth/send-otp", json={"phone": "9876543214"})
        otp = send.json()["dev_otp"]
        verify = await test_client.post("/auth/verify-otp", json={
            "phone": "9876543214", "otp": otp, "full_name": "Brand New"
        })
        assert verify.status_code == 200
        user = verify.json()["user"]
        assert user["role"] == "seeker"

    async def test_existing_user_returned_on_login(self, test_client, db_session):
        """Logging in again returns same user, no duplicate."""
        # First login
        s1 = await test_client.post("/auth/send-otp", json={"phone": "9876543215"})
        v1 = await test_client.post("/auth/verify-otp", json={
            "phone": "9876543215", "otp": s1.json()["dev_otp"], "full_name": "Repeat"
        })
        uid1 = v1.json()["user"]["id"]

        # Second login
        s2 = await test_client.post("/auth/send-otp", json={"phone": "9876543215"})
        v2 = await test_client.post("/auth/verify-otp", json={
            "phone": "9876543215", "otp": s2.json()["dev_otp"]
        })
        uid2 = v2.json()["user"]["id"]
        assert uid1 == uid2
