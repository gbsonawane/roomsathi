import pytest
import pytest_asyncio
from tests.conftest import _make_listing

@pytest.mark.asyncio
class TestSavedListings:
    async def test_save_listing(self, test_client, test_listing, user_headers, db_session):
        res = await test_client.post("/saved/", json={"listing_id": str(test_listing.id)}, headers=user_headers)
        assert res.status_code == 200
        assert res.json()["status"] == "saved"
        
        # Check listing save_count (may need a refresh or another GET)
        listing_res = await test_client.get(f"/listings/{test_listing.id}")
        assert listing_res.json()["save_count"] >= 1

    async def test_save_already_saved_listing(self, test_client, test_listing, user_headers):
        # Save first time
        await test_client.post("/saved/", json={"listing_id": str(test_listing.id)}, headers=user_headers)
        
        # Save second time
        res = await test_client.post("/saved/", json={"listing_id": str(test_listing.id)}, headers=user_headers)
        assert res.status_code == 200
        assert res.json()["status"] == "already_saved"

    async def test_get_saved_listings(self, test_client, test_listing, user_headers, db_session, test_owner):
        # Add another listing
        l2 = _make_listing(test_owner.id)
        db_session.add(l2)
        await db_session.flush()

        # Save both
        await test_client.post("/saved/", json={"listing_id": str(test_listing.id)}, headers=user_headers)
        await test_client.post("/saved/", json={"listing_id": str(l2.id)}, headers=user_headers)

        res = await test_client.get("/saved/", headers=user_headers)
        assert res.status_code == 200
        saved_items = res.json()
        assert len(saved_items) == 2
        ids = [item["id"] for item in saved_items]
        assert str(test_listing.id) in ids
        assert str(l2.id) in ids

    async def test_unsave_listing(self, test_client, test_listing, user_headers):
        # Save first
        await test_client.post("/saved/", json={"listing_id": str(test_listing.id)}, headers=user_headers)
        
        # Unsave
        res = await test_client.delete(f"/saved/{test_listing.id}", headers=user_headers)
        assert res.status_code == 200
        assert res.json()["message"] == "Unsaved"
        
        # Verify it's removed from GET list
        list_res = await test_client.get("/saved/", headers=user_headers)
        assert len(list_res.json()) == 0

    async def test_unsave_non_saved_listing_safe(self, test_client, test_listing, user_headers):
        res = await test_client.delete(f"/saved/{test_listing.id}", headers=user_headers)
        assert res.status_code == 200
        assert res.json()["message"] == "Unsaved"

    async def test_save_missing_listing_id(self, test_client, user_headers):
        res = await test_client.post("/saved/", json={}, headers=user_headers)
        assert res.status_code == 400
