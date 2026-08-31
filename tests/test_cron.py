"""
Phase 1 Item 2 — /cron/expire-listings and /cron/reset-contacts.
"""
from datetime import datetime, timedelta, timezone

import pytest
from sqlalchemy import select

from backend.core.config import settings
from tests.conftest import _make_listing, _make_user

CRON_SECRET = "test_cron_secret_value_for_pytest"


def _cron_headers(secret=CRON_SECRET):
    return {"X-Cron-Secret": secret}


@pytest.mark.asyncio
class TestCronExpireListings:
    async def test_2_1_endpoint_exists_and_responds(self, test_client, monkeypatch):
        monkeypatch.setattr(settings, "CRON_SECRET", CRON_SECRET)
        resp = await test_client.post(
            "/cron/expire-listings",
            headers=_cron_headers(),
        )
        assert resp.status_code == 200
        assert resp.json()["status"] == "done"

    async def test_2_2_endpoint_is_protected(self, test_client, monkeypatch):
        monkeypatch.setattr(settings, "CRON_SECRET", CRON_SECRET)

        no_auth = await test_client.post("/cron/expire-listings")
        assert no_auth.status_code in (401, 403)

        wrong = await test_client.post(
            "/cron/expire-listings",
            headers=_cron_headers("wrong-secret"),
        )
        assert wrong.status_code in (401, 403)

        # Empty CRON_SECRET on server must also reject
        monkeypatch.setattr(settings, "CRON_SECRET", "")
        empty = await test_client.post(
            "/cron/expire-listings",
            headers=_cron_headers(""),
        )
        assert empty.status_code in (401, 403)

    async def test_2_3_expires_listings_past_expiry(
        self, test_client, db_session, test_owner, monkeypatch
    ):
        monkeypatch.setattr(settings, "CRON_SECRET", CRON_SECRET)
        listing = _make_listing(owner_id=test_owner.id)
        listing.expires_at = datetime.now(timezone.utc) - timedelta(days=1)
        listing.is_active = True
        db_session.add(listing)
        await db_session.flush()

        resp = await test_client.post(
            "/cron/expire-listings",
            headers=_cron_headers(),
        )
        assert resp.status_code == 200

        await db_session.refresh(listing)
        assert listing.is_active is False

    async def test_2_4_does_not_touch_valid_listings(
        self, test_client, db_session, test_owner, monkeypatch
    ):
        monkeypatch.setattr(settings, "CRON_SECRET", CRON_SECRET)
        listing = _make_listing(owner_id=test_owner.id)
        listing.expires_at = datetime.now(timezone.utc) + timedelta(days=10)
        listing.is_active = True
        db_session.add(listing)
        await db_session.flush()

        resp = await test_client.post(
            "/cron/expire-listings",
            headers=_cron_headers(),
        )
        assert resp.status_code == 200

        await db_session.refresh(listing)
        assert listing.is_active is True

    async def test_2_5_daily_contact_reset(
        self, test_client, db_session, monkeypatch
    ):
        """Model field is contacts_used_today (no last_reset column)."""
        monkeypatch.setattr(settings, "CRON_SECRET", CRON_SECRET)
        user = _make_user(role="seeker", phone="9122222205")
        user.contacts_used_today = 5
        db_session.add(user)
        await db_session.flush()

        resp = await test_client.post(
            "/cron/reset-contacts",
            headers=_cron_headers(),
        )
        assert resp.status_code == 200

        await db_session.refresh(user)
        assert user.contacts_used_today == 0

    async def test_2_6_idempotency(
        self, test_client, db_session, test_owner, monkeypatch
    ):
        monkeypatch.setattr(settings, "CRON_SECRET", CRON_SECRET)
        listing = _make_listing(owner_id=test_owner.id)
        listing.expires_at = datetime.now(timezone.utc) - timedelta(hours=2)
        listing.is_active = True
        db_session.add(listing)
        await db_session.flush()

        first = await test_client.post(
            "/cron/expire-listings",
            headers=_cron_headers(),
        )
        second = await test_client.post(
            "/cron/expire-listings",
            headers=_cron_headers(),
        )
        assert first.status_code == 200
        assert second.status_code == 200

        await db_session.refresh(listing)
        assert listing.is_active is False

        # Contact reset twice is also safe
        user = _make_user(role="seeker", phone="9122222206")
        user.contacts_used_today = 3
        db_session.add(user)
        await db_session.flush()

        r1 = await test_client.post("/cron/reset-contacts", headers=_cron_headers())
        r2 = await test_client.post("/cron/reset-contacts", headers=_cron_headers())
        assert r1.status_code == 200 and r2.status_code == 200
        await db_session.refresh(user)
        assert user.contacts_used_today == 0
