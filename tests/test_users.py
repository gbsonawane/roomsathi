import pytest
import pytest_asyncio
from tests.conftest import _headers_for

@pytest.mark.asyncio
class TestUsersAndProfiles:
    async def test_get_current_user_profile(self, test_client, test_user, user_headers):
        res = await test_client.get("/users/me", headers=user_headers)
        assert res.status_code == 200
        assert res.json()["id"] == str(test_user.id)
        assert "full_name" in res.json()

    async def test_update_user_profile(self, test_client, user_headers):
        payload = {"full_name": "Updated Name", "email": "updated@example.com"}
        res = await test_client.patch("/users/me", headers=user_headers, json=payload)
        assert res.status_code == 200
        assert res.json()["full_name"] == "Updated Name"
        assert res.json()["email"] == "updated@example.com"

    async def test_get_all_users_admin(self, test_client, admin_headers):
        res = await test_client.get("/users/all", headers=admin_headers)
        assert res.status_code == 200
        assert "users" in res.json()

    async def test_get_all_users_non_admin(self, test_client, user_headers):
        res = await test_client.get("/users/all", headers=user_headers)
        assert res.status_code == 403

    async def test_promote_user_admin(self, test_client, test_user, admin_headers):
        res = await test_client.patch(f"/users/{test_user.id}/promote", headers=admin_headers)
        assert res.status_code == 200
        assert res.json()["role"] == "admin"
        assert res.json()["id"] == str(test_user.id)

    async def test_promote_user_non_admin(self, test_client, test_user, user_headers):
        res = await test_client.patch(f"/users/{test_user.id}/promote", headers=user_headers)
        assert res.status_code == 403

    async def test_ban_user_admin(self, test_client, test_user, admin_headers):
        res = await test_client.patch(f"/users/{test_user.id}/ban", headers=admin_headers)
        assert res.status_code == 200
        assert res.json()["is_active"] is False

        # Unban
        res = await test_client.patch(f"/users/{test_user.id}/ban", headers=admin_headers)
        assert res.status_code == 200
        assert res.json()["is_active"] is True

    async def test_ban_user_non_admin(self, test_client, test_user, user_headers):
        res = await test_client.patch(f"/users/{test_user.id}/ban", headers=user_headers)
        assert res.status_code == 403

    async def test_unauthorized_profile_access(self, test_client):
        res = await test_client.get("/users/me")
        assert res.status_code == 401
