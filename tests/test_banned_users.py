"""
Phase 1 Item 4 — Banned / inactive users must be rejected by get_current_user.
"""
import re
from pathlib import Path

import pytest

from tests.conftest import _make_user, _headers_for, _token_for

REPO_ROOT = Path(__file__).resolve().parents[1]
ROUTERS_DIR = REPO_ROOT / "backend" / "routers"


@pytest.mark.asyncio
class TestBannedUserAccess:
    async def test_4_1_active_user_valid_token(self, test_client, test_user):
        """Active user with valid token → 200 on protected route."""
        assert test_user.is_active is True or test_user.is_active is None
        resp = await test_client.get("/users/me", headers=_headers_for(test_user))
        assert resp.status_code == 200
        assert resp.json()["id"] == str(test_user.id)

    async def test_4_2_banned_user_valid_token_rejected(self, test_client, db_session):
        """Banned user with unexpired token → 401/403, not allowed through."""
        user = _make_user(role="seeker", phone="9111111102")
        user.is_active = False
        db_session.add(user)
        await db_session.flush()

        token = _token_for(user)
        resp = await test_client.get(
            "/users/me",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code in (401, 403), (
            f"Banned user must be rejected, got {resp.status_code}: {resp.text}"
        )

    async def test_4_3_banned_user_fresh_login_blocked_or_token_useless(
        self, test_client, db_session
    ):
        """
        Banned user login: either login itself fails, OR a token is issued but
        immediately rejected by get_current_user on the next protected call.
        """
        user = _make_user(role="seeker", phone="9111111103")
        user.is_active = False
        db_session.add(user)
        await db_session.flush()

        login = await test_client.post(
            "/auth/dev-login",
            json={"phone": "9111111103", "otp": "000000", "full_name": "Banned"},
        )

        if login.status_code in (401, 403):
            return

        assert login.status_code == 200, login.text
        token = login.json()["access_token"]
        me = await test_client.get(
            "/users/me",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert me.status_code in (401, 403), (
            "Banned user received a usable token — get_current_user must reject them"
        )

    async def test_4_4_ban_applied_mid_session(self, test_client, db_session, test_user):
        """User banned after token issuance → subsequent requests rejected immediately."""
        headers = _headers_for(test_user)

        ok = await test_client.get("/users/me", headers=headers)
        assert ok.status_code == 200

        test_user.is_active = False
        db_session.add(test_user)
        await db_session.flush()

        denied = await test_client.get("/users/me", headers=headers)
        assert denied.status_code in (401, 403), (
            f"Mid-session ban must take effect immediately, got {denied.status_code}"
        )

    async def test_4_5_unban_restores_access(self, test_client, db_session):
        """Setting is_active=True again restores access with the same token."""
        user = _make_user(role="seeker", phone="9111111105")
        user.is_active = False
        db_session.add(user)
        await db_session.flush()
        headers = _headers_for(user)

        banned = await test_client.get("/users/me", headers=headers)
        assert banned.status_code in (401, 403)

        user.is_active = True
        db_session.add(user)
        await db_session.flush()

        restored = await test_client.get("/users/me", headers=headers)
        assert restored.status_code == 200


def test_4_6_protected_routes_use_get_current_user():
    """All routers that protect resources use Depends(get_current_user)."""
    required_files = [
        "users.py",
        "listings.py",
        "saved.py",
        "payments.py",
        "unlock.py",
        "boost.py",
    ]
    missing = []
    for name in required_files:
        text = (ROUTERS_DIR / name).read_text(encoding="utf-8")
        if "Depends(get_current_user)" not in text and "Depends(get_current_user," not in text:
            missing.append(name)
    assert missing == [], f"Routers missing get_current_user dependency: {missing}"

    dep_text = (REPO_ROOT / "backend" / "db" / "dependencies.py").read_text(
        encoding="utf-8"
    )
    assert re.search(r"is_active", dep_text) and (
        "suspended" in dep_text.lower()
        or "not getattr(user, \"is_active\"" in dep_text
        or "not user.is_active" in dep_text
        or 'getattr(user, "is_active"' in dep_text
    ), (
        "get_current_user must check user.is_active and reject banned users"
    )
