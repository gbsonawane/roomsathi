"""
Phase 1 Item 3 — SECRET_KEY must not silently fall back to a hardcoded default.
"""
import os
import re
from pathlib import Path

import jwt
import pytest
from pydantic import ValidationError

OLD_HARDCODED_SECRET = "roomsathi_super_secret_jwt_key_change_in_production_2024"
REPO_ROOT = Path(__file__).resolve().parents[1]
BACKEND_DIR = REPO_ROOT / "backend"


def _settings_without_env_secret(**kwargs):
    """Instantiate Settings ignoring .env / process SECRET_KEY unless passed in kwargs."""
    from backend.core.config import Settings

    saved = os.environ.pop("SECRET_KEY", None)
    try:
        return Settings(_env_file=None, **kwargs)
    finally:
        if saved is not None:
            os.environ["SECRET_KEY"] = saved


class TestSecretKeyNoFallback:
    def test_3_1_fails_fast_when_secret_key_unset(self):
        """Unset SECRET_KEY → Settings must raise; must NOT silently fall back."""
        with pytest.raises((ValidationError, ValueError)) as exc_info:
            _settings_without_env_secret()

        message = str(exc_info.value).lower()
        assert "secret_key" in message

    def test_3_2_no_hardcoded_fallback_string_in_backend(self):
        """Grep backend for known weak/default SECRET_KEY fallbacks."""
        forbidden = [
            OLD_HARDCODED_SECRET,
            "changeme",
            "change_in_production",
            "super_secret_jwt",
            'SECRET_KEY = "secret"',
            "SECRET_KEY = 'secret'",
        ]
        hits = []
        for path in BACKEND_DIR.rglob("*.py"):
            text = path.read_text(encoding="utf-8", errors="ignore")
            for needle in forbidden:
                if needle.lower() in text.lower():
                    hits.append(f"{path.relative_to(REPO_ROOT)}: contains {needle!r}")

        assert hits == [], "Hardcoded SECRET_KEY fallback still present:\n" + "\n".join(hits)

    def test_3_2_config_source_has_no_assignment_fallback(self):
        """config.py must not assign a literal default SECRET_KEY string."""
        config_text = (BACKEND_DIR / "core" / "config.py").read_text(encoding="utf-8")
        assign_pattern = re.compile(
            r"""SECRET_KEY\s*=\s*["'][^"']{8,}["']""",
            re.IGNORECASE,
        )
        matches = assign_pattern.findall(config_text)
        assert matches == [], f"Found hardcoded SECRET_KEY assignment(s): {matches}"

    def test_3_3_jwt_signed_with_env_provided_key(self, monkeypatch):
        """JWT created with settings.SECRET_KEY must verify with the same key."""
        from backend.core import config as config_mod
        from backend.core.security import create_access_token

        test_key = "a" * 32 + "_test_secret_key_for_jwt"
        monkeypatch.setattr(config_mod.settings, "SECRET_KEY", test_key)
        monkeypatch.setattr(config_mod.settings, "ALGORITHM", "HS256")

        token = create_access_token({"sub": "user-123", "role": "seeker"})
        payload = jwt.decode(token, test_key, algorithms=["HS256"])
        assert payload["sub"] == "user-123"
        assert payload["role"] == "seeker"

    @pytest.mark.asyncio
    async def test_3_4_old_hardcoded_key_tokens_rejected(self, test_client, test_user):
        """Token signed with the old known fallback secret must not access protected routes."""
        from backend.core import config as config_mod

        assert config_mod.settings.SECRET_KEY != OLD_HARDCODED_SECRET

        forged = jwt.encode(
            {"sub": str(test_user.id), "role": test_user.role},
            OLD_HARDCODED_SECRET,
            algorithm="HS256",
        )
        resp = await test_client.get(
            "/users/me",
            headers={"Authorization": f"Bearer {forged}"},
        )
        assert resp.status_code == 401
