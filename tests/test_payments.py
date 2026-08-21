import pytest
import pytest_asyncio

@pytest.mark.asyncio
class TestUnlockContact:
    async def test_unlock_contact_requires_auth(self, test_client, test_listing):
        res = await test_client.post("/unlock/", json={"listing_id": str(test_listing.id), "unlock_type": "single"})
        assert res.status_code in (401, 403)

    async def test_unlock_contact_single_creates_order(self, test_client, test_listing, user_headers):
        res = await test_client.post("/unlock/", json={"listing_id": str(test_listing.id), "unlock_type": "single"}, headers=user_headers)
        assert res.status_code == 200
        data = res.json()
        assert data["status"] == "payment_required"
        assert "order_id" in data
        assert data["amount"] == 2900  # 29 INR in paise

    async def test_unlock_contact_plan_creates_order(self, test_client, test_listing, user_headers):
        res = await test_client.post("/unlock/", json={"listing_id": str(test_listing.id), "unlock_type": "plan"}, headers=user_headers)
        assert res.status_code == 200
        data = res.json()
        assert data["status"] == "payment_required"
        assert data["amount"] == 29900  # 299 INR

    async def test_unlock_contact_invalid_type(self, test_client, test_listing, user_headers):
        res = await test_client.post("/unlock/", json={"listing_id": str(test_listing.id), "unlock_type": "yearly"}, headers=user_headers)
        assert res.status_code == 400

    async def test_unlock_contact_with_active_plan(self, test_client, test_listing, user_headers, test_user, db_session):
        # Give user an active plan
        from datetime import datetime, timedelta, timezone
        test_user.plan_type = "monthly"
        test_user.plan_expires_at = datetime.now(timezone.utc) + timedelta(days=10)
        db_session.add(test_user)
        await db_session.flush()

        res = await test_client.post("/unlock/", json={"listing_id": str(test_listing.id), "unlock_type": "single"}, headers=user_headers)
        assert res.status_code == 200
        data = res.json()
        assert data["status"] == "unlocked_with_plan"
        assert "owner_phone" in data

    async def test_unlock_already_unlocked(self, test_client, test_listing, user_headers, test_user, db_session):
        # Mock previously unlocked
        from backend.models.contact_unlock import ContactUnlock
        db_session.add(ContactUnlock(seeker_id=test_user.id, listing_id=test_listing.id, unlock_type="single", amount_paid=29))
        await db_session.flush()

        res = await test_client.post("/unlock/", json={"listing_id": str(test_listing.id), "unlock_type": "single"}, headers=user_headers)
        assert res.status_code == 200
        assert res.json()["status"] == "already_unlocked"

    @pytest.mark.skip(reason="Needs valid razorpay signature for confirmation")
    async def test_unlock_confirm(self):
        pass


@pytest.mark.asyncio
class TestBoostListing:
    async def test_boost_listing_requires_owner(self, test_client, test_listing, user_headers):
        res = await test_client.post("/boost/", json={"listing_id": str(test_listing.id), "boost_days": 7}, headers=user_headers)
        assert res.status_code == 403

    async def test_boost_listing_creates_order(self, test_client, test_listing, owner_headers):
        res = await test_client.post("/boost/", json={"listing_id": str(test_listing.id), "boost_days": 7}, headers=owner_headers)
        assert res.status_code == 200
        data = res.json()
        assert data["status"] == "payment_required"
        assert data["amount"] == 4900

    async def test_boost_invalid_days(self, test_client, test_listing, owner_headers):
        res = await test_client.post("/boost/", json={"listing_id": str(test_listing.id), "boost_days": 10}, headers=owner_headers)
        assert res.status_code == 400

    @pytest.mark.skip(reason="Needs valid razorpay signature for confirmation")
    async def test_boost_confirm(self):
        pass


@pytest.mark.asyncio
class TestPayments:
    async def test_get_payment_history(self, test_client, user_headers, db_session, test_user):
        from backend.models.payment import Payment
        p = Payment(user_id=test_user.id, payment_type="contact_unlock", amount=29, status="success")
        db_session.add(p)
        await db_session.flush()

        res = await test_client.get("/payments/", headers=user_headers)
        assert res.status_code == 200
        assert len(res.json()) >= 1
        assert res.json()[0]["payment_type"] == "contact_unlock"

    async def test_create_plan_order_standard(self, test_client, user_headers):
        res = await test_client.post("/payments/order", json={"plan_type": "standard"}, headers=user_headers)
        assert res.status_code == 200
        assert res.json()["amount"] == 19900

    async def test_create_plan_order_invalid(self, test_client, user_headers):
        res = await test_client.post("/payments/order", json={"plan_type": "invalid"}, headers=user_headers)
        assert res.status_code == 400

    async def test_get_all_payments_admin(self, test_client, admin_headers, db_session, test_user):
        from backend.models.payment import Payment
        p = Payment(user_id=test_user.id, payment_type="listing_standard", amount=199, status="success")
        db_session.add(p)
        await db_session.flush()

        res = await test_client.get("/payments/all", headers=admin_headers)
        assert res.status_code == 200
        data = res.json()
        assert "payments" in data
        assert "total_revenue" in data
        assert data["total_revenue"] >= 199

    async def test_get_all_payments_non_admin(self, test_client, user_headers):
        res = await test_client.get("/payments/all", headers=user_headers)
        assert res.status_code == 403
