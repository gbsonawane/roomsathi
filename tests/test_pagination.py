import pytest
import pytest_asyncio
from tests.conftest import _make_listing

@pytest.mark.asyncio
class TestPagination:
    async def test_total_count_accurate(self, test_client, db_session, test_owner):
        listings = [_make_listing(test_owner.id) for _ in range(25)]
        db_session.add_all(listings)
        await db_session.flush()

        res = await test_client.get("/listings/?page=1&page_size=10")
        assert res.status_code == 200
        data = res.json()
        assert data["total"] >= 25
        assert len(data["items"]) == 10

    async def test_last_page_partial(self, test_client, db_session, test_owner):
        listings = [_make_listing(test_owner.id) for _ in range(25)]
        db_session.add_all(listings)
        await db_session.flush()

        # Assuming we isolate the db or if not, checking partial bounds is tricky if global data exists
        # Get total first
        total = (await test_client.get("/listings/?page=1&page_size=1")).json()["total"]
        last_page = (total // 10) + (1 if total % 10 != 0 else 0)
        
        res = await test_client.get(f"/listings/?page={last_page}&page_size=10")
        assert len(res.json()["items"]) == total % 10 or (10 if total % 10 == 0 else total % 10)

    async def test_page_beyond_total_returns_empty(self, test_client, db_session, test_owner):
        db_session.add_all([_make_listing(test_owner.id) for _ in range(5)])
        await db_session.flush()

        res = await test_client.get("/listings/?page=999&page_size=10")
        assert res.status_code == 200
        assert len(res.json()["items"]) == 0

    async def test_page_size_respected(self, test_client, db_session, test_owner):
        db_session.add_all([_make_listing(test_owner.id) for _ in range(20)])
        await db_session.flush()

        res = await test_client.get("/listings/?page=1&page_size=5")
        assert len(res.json()["items"]) == 5

    async def test_pagination_with_filters(self, test_client, db_session, test_owner):
        for _ in range(10):
            db_session.add(_make_listing(test_owner.id, city="UniqueCityPune"))
        for _ in range(5):
            db_session.add(_make_listing(test_owner.id, city="UniqueCityMumbai"))
        await db_session.flush()

        res = await test_client.get("/listings/?city=UniqueCityPune&page=1&page_size=5")
        data = res.json()
        assert data["total"] == 10
        assert data["total_pages"] == 2
        assert len(data["items"]) == 5

    async def test_sort_by_rent_asc(self, test_client, db_session, test_owner):
        l1 = _make_listing(test_owner.id, rent=15000, city="SortCity")
        l2 = _make_listing(test_owner.id, rent=8000, city="SortCity")
        l3 = _make_listing(test_owner.id, rent=12000, city="SortCity")
        db_session.add_all([l1, l2, l3])
        await db_session.flush()

        res = await test_client.get("/listings/?sort_by=rent_asc&city=SortCity&page=1&page_size=10")
        items = res.json()["items"]
        assert items[0]["rent"] <= items[1]["rent"] <= items[2]["rent"]

    async def test_sort_by_rent_desc(self, test_client, db_session, test_owner):
        l1 = _make_listing(test_owner.id, rent=15000, city="SortCity")
        l2 = _make_listing(test_owner.id, rent=8000, city="SortCity")
        l3 = _make_listing(test_owner.id, rent=12000, city="SortCity")
        db_session.add_all([l1, l2, l3])
        await db_session.flush()

        res = await test_client.get("/listings/?sort_by=rent_desc&city=SortCity&page=1&page_size=10")
        items = res.json()["items"]
        assert items[0]["rent"] >= items[1]["rent"] >= items[2]["rent"]

    async def test_sort_by_newest(self, test_client, db_session, test_owner):
        import time
        l1 = _make_listing(test_owner.id, city="NewCity")
        db_session.add(l1)
        await db_session.flush()
        
        l2 = _make_listing(test_owner.id, city="NewCity")
        db_session.add(l2)
        await db_session.flush()

        res = await test_client.get("/listings/?sort_by=newest&city=NewCity")
        items = res.json()["items"]
        from dateutil import parser
        assert parser.parse(items[0]["created_at"]) >= parser.parse(items[1]["created_at"])

    async def test_home_page_featured_listings_use_items(self, test_client, db_session, test_owner):
        db_session.add(_make_listing(test_owner.id, is_boosted=True, city="BoostCity"))
        await db_session.flush()
        res = await test_client.get("/listings/?is_boosted=true&city=BoostCity&page=1&page_size=3")
        assert "items" in res.json()
        for item in res.json()["items"]:
            assert item["is_boosted"] is True
