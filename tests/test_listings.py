"""
Tests for listing endpoints including pagination.
"""
import pytest
import pytest_asyncio
from datetime import date
from tests.conftest import _make_listing, _headers_for

@pytest.mark.asyncio
class TestListingCRUD:
    async def test_create_listing_authenticated(self, test_client, user_headers):
        payload = {
            "property_type": "1bhk",
            "city": "Pune",
            "area": "Baner",
            "rent": 12000,
            "deposit": 24000,
            "available_from": "2026-09-01",
            "listing_plan": "basic"
        }
        res = await test_client.post("/listings/", json=payload, headers=user_headers)
        assert res.status_code in (200, 201)
        data = res.json()
        assert data["status"] == "pending"
        assert data["rent"] == 12000

    async def test_create_listing_unauthenticated(self, test_client):
        payload = {"rent": 100}
        res = await test_client.post("/listings/", json=payload)
        assert res.status_code in (401, 403)

    async def test_create_listing_missing_required_field(self, test_client, user_headers):
        payload = {
            "property_type": "1bhk",
            "city": "Pune",
            "area": "Baner"
        }
        res = await test_client.post("/listings/", json=payload, headers=user_headers)
        assert res.status_code == 422

    async def test_create_listing_negative_rent(self, test_client, user_headers):
        payload = {
            "property_type": "1bhk",
            "city": "Pune",
            "area": "Baner",
            "rent": -100,
            "deposit": 100,
            "available_from": "2026-09-01",
        }
        res = await test_client.post("/listings/", json=payload, headers=user_headers)
        assert res.status_code == 422

    async def test_get_listing_by_id(self, test_client, test_listing):
        res = await test_client.get(f"/listings/{test_listing.id}")
        assert res.status_code == 200
        assert res.json()["id"] == str(test_listing.id)

    async def test_get_nonexistent_listing(self, test_client):
        res = await test_client.get("/listings/00000000-0000-0000-0000-000000000000")
        assert res.status_code == 404

    async def test_update_listing_by_owner(self, test_client, test_listing, test_owner):
        headers = _headers_for(test_owner)
        res = await test_client.patch(f"/listings/{test_listing.id}", json={"rent": 15000}, headers=headers)
        assert res.status_code == 200
        assert res.json()["rent"] == 15000

    async def test_update_listing_by_non_owner(self, test_client, test_listing, test_user):
        headers = _headers_for(test_user)
        res = await test_client.patch(f"/listings/{test_listing.id}", json={"rent": 15000}, headers=headers)
        assert res.status_code == 403

    async def test_delete_listing_by_owner(self, test_client, test_listing, test_owner):
        headers = _headers_for(test_owner)
        res = await test_client.delete(f"/listings/{test_listing.id}", headers=headers)
        assert res.status_code == 200
        assert (await test_client.get(f"/listings/{test_listing.id}")).status_code == 404

    async def test_delete_listing_by_non_owner(self, test_client, test_listing, test_user):
        headers = _headers_for(test_user)
        res = await test_client.delete(f"/listings/{test_listing.id}", headers=headers)
        assert res.status_code == 403

    async def test_listing_search_by_city(self, test_client, db_session, test_owner):
        l1 = _make_listing(test_owner.id, city="Pune")
        l2 = _make_listing(test_owner.id, city="Pune")
        l3 = _make_listing(test_owner.id, city="Mumbai")
        db_session.add_all([l1, l2, l3])
        await db_session.flush()

        res = await test_client.get("/listings/?city=Pune")
        items = res.json()["items"]
        # Include any globally created fixtures also in Pune (like test_listing)
        assert sum(1 for x in items if x["id"] in [str(l1.id), str(l2.id)]) == 2

    async def test_listing_search_by_rent_range(self, test_client, db_session, test_owner):
        l1 = _make_listing(test_owner.id, rent=8000)
        l2 = _make_listing(test_owner.id, rent=12000)
        l3 = _make_listing(test_owner.id, rent=20000)
        db_session.add_all([l1, l2, l3])
        await db_session.flush()

        res = await test_client.get("/listings/?min_rent=10000&max_rent=15000")
        items = res.json()["items"]
        assert any(x["id"] == str(l2.id) for x in items)
        assert not any(x["id"] == str(l1.id) for x in items)

    async def test_listing_search_by_property_type(self, test_client, db_session, test_owner):
        db_session.add(_make_listing(test_owner.id, property_type="1bhk"))
        await db_session.flush()
        res = await test_client.get("/listings/?property_type=1bhk")
        for item in res.json()["items"]:
            assert item["property_type"] == "1bhk"

    async def test_listing_search_by_gender_preference(self, test_client, db_session, test_owner):
        db_session.add(_make_listing(test_owner.id, gender_preference="girls"))
        await db_session.flush()
        res = await test_client.get("/listings/?gender_preference=girls")
        for item in res.json()["items"]:
            assert item["gender_preference"] == "girls"

    async def test_listing_pagination_page_1(self, test_client, db_session, test_owner):
        listings = [_make_listing(test_owner.id) for _ in range(15)]
        db_session.add_all(listings)
        await db_session.flush()

        res = await test_client.get("/listings/?page=1&page_size=12")
        data = res.json()
        assert len(data["items"]) == 12
        assert data["total_pages"] >= 2

    async def test_listing_pagination_page_2(self, test_client, db_session, test_owner):
        listings = [_make_listing(test_owner.id) for _ in range(15)]
        db_session.add_all(listings)
        await db_session.flush()
        
        # Test offset query essentially
        res = await test_client.get("/listings/?page=2&page_size=12")
        assert len(res.json()["items"]) > 0

    async def test_listing_pagination_response_shape(self, test_client, test_listing):
        res = await test_client.get("/listings/?page=1&page_size=5")
        data = res.json()
        for key in ["items", "total", "page", "page_size", "total_pages"]:
            assert key in data
        assert data["page"] == 1
        assert data["page_size"] == 5

    async def test_view_count_increments(self, test_client, test_listing, db_session):
        await test_client.post(f"/listings/{test_listing.id}/view")
        await db_session.refresh(test_listing)
        res = await test_client.get(f"/listings/{test_listing.id}")
        assert res.json()["view_count"] == 1

    async def test_photo_upload_valid(self, test_client, user_headers):
        # We need a small dummy file
        files = {"files": ("test.jpg", b"12345", "image/jpeg")}
        res = await test_client.post("/listings/upload-photos", headers=user_headers, files=files)
        assert res.status_code == 200
        assert "urls" in res.json()

    async def test_photo_upload_too_large(self, test_client, user_headers):
        large_content = b"0" * (6 * 1024 * 1024)
        files = {"files": ("test.jpg", large_content, "image/jpeg")}
        res = await test_client.post("/listings/upload-photos", headers=user_headers, files=files)
        assert res.status_code == 400

    async def test_photo_upload_invalid_type(self, test_client, user_headers):
        files = {"files": ("test.pdf", b"123", "application/pdf")}
        res = await test_client.post("/listings/upload-photos", headers=user_headers, files=files)
        assert res.status_code == 400


@pytest.mark.asyncio
class TestListingAdmin:
    async def test_admin_can_approve_listing(self, test_client, db_session, test_owner, admin_headers):
        l = _make_listing(test_owner.id, status="pending")
        db_session.add(l)
        await db_session.flush()

        res = await test_client.patch(f"/listings/{l.id}/approve", headers=admin_headers)
        assert res.status_code == 200
        await db_session.refresh(l)
        assert (await test_client.get(f"/listings/{l.id}")).json()["status"] == "approved"

    async def test_non_admin_cannot_approve(self, test_client, db_session, test_owner, user_headers):
        l = _make_listing(test_owner.id, status="pending")
        db_session.add(l)
        await db_session.flush()

        res = await test_client.patch(f"/listings/{l.id}/approve", headers=user_headers)
        assert res.status_code == 403

    async def test_admin_can_reject_listing(self, test_client, db_session, test_owner, admin_headers):
        l = _make_listing(test_owner.id, status="pending")
        db_session.add(l)
        await db_session.flush()

        res = await test_client.patch(f"/listings/{l.id}/reject", headers=admin_headers)
        assert res.status_code == 200
        assert res.json()["status"] == "rejected"

    async def test_pending_listings_visible_to_admin(self, test_client, db_session, test_owner, admin_headers):
        l = _make_listing(test_owner.id, status="pending")
        db_session.add(l)
        await db_session.flush()

        res = await test_client.get("/listings/pending", headers=admin_headers)
        assert len(res.json()) > 0
        assert res.json()[0]["status"] == "pending"

    async def test_pending_listings_hidden_from_regular_user(self, test_client, user_headers):
        res = await test_client.get("/listings/pending", headers=user_headers)
        assert res.status_code == 403
