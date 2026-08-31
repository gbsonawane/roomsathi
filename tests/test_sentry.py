"""
Phase 2 Item 6 — Sentry monitoring (code-level checks).
Dashboard appearance (6.3/6.4) is manual.
"""
import re
from pathlib import Path

REPO = Path(__file__).resolve().parents[1]
MAIN = (REPO / "backend" / "main.py").read_text(encoding="utf-8")
CLIENT = (REPO / "frontend" / "sentry.client.config.js").read_text(encoding="utf-8")
SERVER = (REPO / "frontend" / "sentry.server.config.js").read_text(encoding="utf-8")
CONFIG = (REPO / "backend" / "core" / "config.py").read_text(encoding="utf-8")


class TestSentrySetup:
    def test_6_1_backend_sdk_initialized_from_env(self):
        assert "sentry_sdk.init" in MAIN
        assert "SENTRY_DSN" in MAIN
        assert "settings.SENTRY_DSN" in MAIN
        # DSN must not be a hardcoded https://...@sentry.io string in main
        hardcoded = re.findall(r'https://[a-zA-Z0-9]+@[a-zA-Z0-9.]+\.ingest', MAIN)
        assert hardcoded == [], f"Hardcoded Sentry DSN in main.py: {hardcoded}"
        assert 'SENTRY_DSN: str = ""' in CONFIG or "SENTRY_DSN" in CONFIG

    def test_6_2_frontend_sdk_initialized_from_env(self):
        assert "Sentry.init" in CLIENT
        assert "NEXT_PUBLIC_SENTRY_DSN" in CLIENT
        assert "Sentry.init" in SERVER
        assert "NEXT_PUBLIC_SENTRY_DSN" in SERVER
        for src, label in ((CLIENT, "client"), (SERVER, "server")):
            hardcoded = re.findall(r'https://[a-zA-Z0-9]+@[a-zA-Z0-9.]+\.ingest', src)
            assert hardcoded == [], f"Hardcoded DSN in sentry.{label}.config.js: {hardcoded}"

    def test_6_5_pii_scrubbing_defaults(self):
        assert "send_default_pii=False" in MAIN or "send_default_pii = False" in MAIN

    def test_6_6_environment_tagging(self):
        assert "environment=settings.ENVIRONMENT" in MAIN or "environment=settings.ENVIRONMENT" in MAIN.replace(" ", "")
        assert "environment:" in CLIENT or "environment :" in CLIENT
        assert "NEXT_PUBLIC_ENV" in CLIENT or "development" in CLIENT
