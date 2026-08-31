"""
Phase 2 Item 8 — Global exception handler must not leak internals.
"""
import re
from pathlib import Path

import pytest
from fastapi import HTTPException
from fastapi.responses import JSONResponse

from backend.main import app
from backend.core.config import settings

REPO = Path(__file__).resolve().parents[1]
BACKEND = REPO / "backend"


@pytest.fixture
def boom_route():
    """Register a temporary route that raises an unhandled exception."""
    path = "/__test__/boom"

    @app.get(path)
    async def _boom():
        raise RuntimeError("SECRET_TABLE users.password_hash leaked to client")

    # Ensure route is findable
    yield path

    # Remove the route from the app router
    app.router.routes = [
        r for r in app.router.routes
        if getattr(r, "path", None) != path
    ]


@pytest.mark.asyncio
class TestExceptionHandler:
    async def test_8_1_unhandled_exception_generic_message(self, test_client, boom_route):
        resp = await test_client.get(boom_route)
        assert resp.status_code == 500
        body = resp.json()
        detail = body.get("detail", "")
        assert "SECRET_TABLE" not in detail
        assert "password_hash" not in detail
        assert "Traceback" not in detail
        assert "RuntimeError" not in detail
        assert detail in (
            "Something went wrong. Please try again.",
            "Internal server error",
        ) or "went wrong" in detail.lower() or "internal" in detail.lower()

    async def test_8_2_full_error_logged_server_side(self, test_client, boom_route, caplog):
        import logging

        with caplog.at_level(logging.ERROR):
            await test_client.get(boom_route)
        joined = " ".join(r.message for r in caplog.records)
        # Global handler logs the path; exc_info captures the exception
        assert boom_route in joined or any(
            "Unhandled" in r.message or "exception" in r.message.lower()
            for r in caplog.records
        )

    async def test_8_3_validation_errors_still_informative(self, test_client):
        # Missing required fields on send-otp body
        resp = await test_client.post("/auth/send-otp", json={})
        assert resp.status_code == 422
        data = resp.json()
        assert "detail" in data

    async def test_8_4_db_errors_dont_leak_schema(self, test_client, boom_route):
        """Unhandled DB-like errors also go through generic handler."""
        path = "/__test__/db_boom"

        @app.get(path)
        async def _db_boom():
            raise Exception(
                'duplicate key value violates unique constraint "users_phone_key" '
                "DETAIL: Key (phone)=(999)= already exists."
            )

        try:
            resp = await test_client.get(path)
            assert resp.status_code == 500
            text = resp.text
            assert "users_phone_key" not in text
            assert "duplicate key" not in text.lower()
            assert "DETAIL:" not in text
        finally:
            app.router.routes = [
                r for r in app.router.routes
                if getattr(r, "path", None) != path
            ]

    async def test_8_5_404s_are_clean(self, test_client, user_headers):
        resp = await test_client.get(
            "/listings/00000000-0000-0000-0000-000000000099",
            headers=user_headers,
        )
        assert resp.status_code == 404
        detail = resp.json().get("detail", "")
        assert "Traceback" not in str(detail)
        assert "sqlalchemy" not in str(detail).lower()

    def test_8_6_no_bare_str_e_returns_in_routers(self):
        pattern = re.compile(
            r"""return\s*\{[^}]*["']error["']\s*:\s*str\(\s*e\s*\)"""
            r"""|detail\s*=\s*str\(\s*e\s*\)"""
            r"""|["']message["']\s*:\s*str\(\s*e\s*\)""",
            re.IGNORECASE,
        )
        hits = []
        for path in (BACKEND / "routers").rglob("*.py"):
            text = path.read_text(encoding="utf-8")
            if pattern.search(text):
                hits.append(str(path.relative_to(REPO)))
        # Also check webhooks old pattern returning message: str(e)
        for path in [BACKEND / "main.py"]:
            text = path.read_text(encoding="utf-8")
            if '"message": str(e)' in text or "'message': str(e)" in text:
                hits.append(str(path.relative_to(REPO)))
        assert hits == [], f"Routes leaking str(e) to clients: {hits}"
