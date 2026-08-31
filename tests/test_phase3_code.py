"""
Phase 3 code presence checks — real React/CSS (complements Playwright fixture).
"""
from pathlib import Path

REPO = Path(__file__).resolve().parents[1]
FRONTEND = REPO / "frontend"


class TestPhase3CodePresence:
    def test_10_navbar_has_bell_and_polling(self):
        nav = (FRONTEND / "components" / "Navbar.js").read_text(encoding="utf-8")
        assert "ti-bell" in nav or "BellIcon" in nav
        assert "unread-count" in nav
        assert "setInterval" in nav
        assert "/notifications" in nav

    def test_10_notifications_page_exists(self):
        page = FRONTEND / "pages" / "notifications.js"
        assert page.exists()
        text = page.read_text(encoding="utf-8")
        assert "Mark all read" in text or "markAll" in text.lower() or "mark_all" in text.lower() or "Mark all" in text
        assert "Unread" in text or "unread" in text
        assert "caught up" in text.lower() or "No unread" in text

    def test_11_skeleton_component_and_usage(self):
        sk = (FRONTEND / "components" / "Skeleton.js").read_text(encoding="utf-8")
        assert "SkeletonListingGrid" in sk
        assert "shimmer" in sk.lower() or "SkeletonLine" in sk
        css = (FRONTEND / "styles" / "globals.css").read_text(encoding="utf-8")
        assert "@keyframes shimmer" in css

        for rel in [
            "pages/home.js",
            "pages/search.js",
            "pages/profile.js",
            "pages/listing/[id].js",
            "pages/notifications.js",
        ]:
            text = (FRONTEND / rel).read_text(encoding="utf-8")
            assert "Skeleton" in text, f"{rel} missing Skeleton usage"

    def test_11_no_blank_loading_return_null(self):
        pages = list((FRONTEND / "pages").rglob("*.js"))
        offenders = []
        for p in pages:
            if "admin" in str(p):
                continue
            text = p.read_text(encoding="utf-8")
            if "if (loading) return null" in text or "if(loading) return null" in text:
                offenders.append(str(p.relative_to(FRONTEND)))
        assert offenders == [], f"Pages still blank on load: {offenders}"

    def test_12_hamburger_and_mobile_css(self):
        nav = (FRONTEND / "components" / "Navbar.js").read_text(encoding="utf-8")
        assert "hamburger" in nav.lower() or "menuOpen" in nav
        assert "ti-menu-2" in nav or "hamburger-btn" in nav
        css = (FRONTEND / "styles" / "globals.css").read_text(encoding="utf-8")
        assert ".hamburger-btn" in css
        assert ".desktop-nav" in css
        assert "max-width: 768px" in css
