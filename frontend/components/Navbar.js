import Link from "next/link";
import { useRouter } from "next/router";
import { useEffect, useRef, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { apiFetch } from "../lib/api";

const mobileNavLink = {
  padding: "14px 20px",
  fontSize: "16px",
  color: "var(--text-primary, #111827)",
  textDecoration: "none",
  borderBottom: "1px solid #f3f4f6",
  display: "block",
};

function BellIcon({ unreadCount, color = "inherit" }) {
  return (
    <Link href="/notifications" style={{ position: "relative", display: "inline-flex" }}>
      <i
        className="ti ti-bell"
        style={{ fontSize: "20px", color }}
        aria-label="Notifications"
      />
      {unreadCount > 0 && (
        <span
          style={{
            position: "absolute",
            top: "-6px",
            right: "-6px",
            background: "#ef4444",
            color: "white",
            fontSize: "10px",
            fontWeight: 500,
            minWidth: "16px",
            height: "16px",
            borderRadius: "999px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "0 3px",
            lineHeight: 1,
          }}
        >
          {unreadCount > 9 ? "9+" : unreadCount}
        </span>
      )}
    </Link>
  );
}

export default function Navbar() {
  const router = useRouter();
  const { user, token, logout } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);
  const [notificationsAvailable, setNotificationsAvailable] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const navRef = useRef(null);

  useEffect(() => {
    if (!user || !token) {
      setNotificationsAvailable(false);
      setUnreadCount(0);
      return;
    }
    let cancelled = false;
    const fetchCount = async () => {
      try {
        const res = await apiFetch("/notifications/unread-count", {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (cancelled) return;
        // Hide bell if route missing / not implemented
        if (res.status === 404 || res.status === 501 || res.status === 405) {
          setNotificationsAvailable(false);
          setUnreadCount(0);
          return;
        }
        if (res.ok) {
          const data = await res.json();
          setNotificationsAvailable(true);
          setUnreadCount(data.count || 0);
        } else {
          // Other errors (500, etc.): keep hidden rather than show a fake badge
          setNotificationsAvailable(false);
        }
      } catch {
        if (!cancelled) setNotificationsAvailable(false);
      }
    };
    fetchCount();
    const interval = setInterval(fetchCount, 60000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [user, token]);

  useEffect(() => {
    setMenuOpen(false);
  }, [router.pathname]);

  useEffect(() => {
    function handleClickOutside(e) {
      if (navRef.current && !navRef.current.contains(e.target)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleLogout = () => {
    logout();
    setMenuOpen(false);
    router.push("/");
  };

  return (
    <nav ref={navRef} className="custom-navbar" style={{ position: "relative" }}>
      <div className="nav-container">
        <Link href="/home" className="nav-logo" aria-label="RoomSathi Home">
          <span style={{ color: "#ffffff", fontWeight: 900 }}>Room</span>
          <span style={{ color: "rgba(0, 0, 0, 0.96)", fontWeight: 900 }}>Sathi</span>
        </Link>

        {/* Desktop nav links */}
        <div className="desktop-nav nav-menu">
          <Link
            href="/home"
            className={`nav-link ${router.pathname === "/home" ? "active" : ""}`}
          >
            Dashboard
          </Link>
          <Link
            href="/search"
            className={`nav-link ${router.pathname === "/search" ? "active" : ""}`}
          >
            Search
          </Link>
          <Link
            href="/create-listing"
            className={`nav-link ${router.pathname === "/create-listing" ? "active" : ""}`}
          >
            Post a Room
          </Link>
          {user && notificationsAvailable && (
            <BellIcon unreadCount={unreadCount} color="rgba(255, 255, 255, 0.9)" />
          )}
        </div>

        <div className="nav-user-actions desktop-nav">
          {user ? (
            <div className="user-dropdown-wrapper">
              <Link href="/profile" className="profile-link-nav">
                <span className="avatar-nav">
                  {user.full_name ? user.full_name[0].toUpperCase() : "👤"}
                </span>
              </Link>
              <button className="logout-btn" onClick={handleLogout}>
                Logout
              </button>
            </div>
          ) : (
            <Link href="/" className="login-link-nav">
              Sign In
            </Link>
          )}
        </div>

        {/* Mobile right side: bell + hamburger */}
        <div
          className="mobile-nav-controls"
          style={{ display: "flex", gap: "12px", alignItems: "center" }}
        >
          {user && notificationsAvailable && (
            <BellIcon unreadCount={unreadCount} color="rgba(255, 255, 255, 0.95)" />
          )}
          <button
            className="hamburger-btn"
            onClick={() => setMenuOpen((o) => !o)}
            aria-label={menuOpen ? "Close menu" : "Open menu"}
            aria-expanded={menuOpen}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              padding: "4px",
              display: "none",
            }}
          >
            <i
              className={`ti ${menuOpen ? "ti-x" : "ti-menu-2"}`}
              style={{ fontSize: "24px", color: "#ffffff" }}
              aria-hidden="true"
            />
          </button>
        </div>
      </div>

      {/* Mobile dropdown menu */}
      {menuOpen && (
        <div
          style={{
            position: "absolute",
            top: "100%",
            left: 0,
            right: 0,
            background: "white",
            borderTop: "1px solid #e5e7eb",
            borderBottom: "1px solid #e5e7eb",
            boxShadow: "0 8px 24px rgba(0,0,0,0.12)",
            zIndex: 100,
            display: "flex",
            flexDirection: "column",
            padding: "8px 0",
            borderRadius: "0 0 16px 16px",
            marginTop: "8px",
          }}
        >
          <Link href="/search" style={mobileNavLink}>
            Search rooms
          </Link>
          <Link href="/create-listing" style={mobileNavLink}>
            Post a room
          </Link>
          {user && notificationsAvailable && (
            <Link href="/notifications" style={mobileNavLink}>
              Notifications {unreadCount > 0 && `(${unreadCount})`}
            </Link>
          )}
          {user ? (
            <>
              <Link href="/profile" style={mobileNavLink}>
                My profile
              </Link>
              <button
                type="button"
                onClick={handleLogout}
                style={{
                  ...mobileNavLink,
                  background: "none",
                  border: "none",
                  textAlign: "left",
                  cursor: "pointer",
                  color: "#ef4444",
                  width: "100%",
                }}
              >
                Log out
              </button>
            </>
          ) : (
            <>
              <Link href="/login" style={mobileNavLink}>
                Log in
              </Link>
              <Link href="/signup" style={mobileNavLink}>
                Sign up
              </Link>
            </>
          )}
        </div>
      )}

      <style jsx>{`
        .custom-navbar {
          background: linear-gradient(135deg, #065f46 0%, #047857 100%);
          height: 96px;
          position: sticky;
          top: 16px;
          margin: 16px auto 24px;
          max-width: 1600px;
          width: calc(100% - 32px);
          border-radius: 20px;
          z-index: 100;
          box-shadow: 0 10px 30px rgba(6, 95, 70, 0.3);
        }
        .nav-container {
          display: flex;
          align-items: center;
          justify-content: space-between;
          height: 100%;
          max-width: 1600px;
          margin: 0 auto;
          padding: 0 4%;
          gap: 16px;
        }
        .nav-logo {
          font-size: 3.8rem;
          text-decoration: none;
          letter-spacing: 0.5px;
          display: flex;
          align-items: center;
        }
        .nav-menu {
          display: flex;
          gap: 28px;
          align-items: center;
        }
        @media (max-width: 600px) {
          .nav-menu {
            gap: 16px;
          }
          .nav-logo {
            font-size: 2.4rem;
          }
          .custom-navbar {
            height: 72px;
          }
        }
        .nav-link {
          text-decoration: none;
          color: rgba(255, 255, 255, 0.8);
          font-weight: 700;
          font-size: 0.95rem;
          transition: all 0.2s ease;
          padding: 6px 0;
          border-bottom: 2px solid transparent;
        }
        .nav-link:hover {
          color: #ffffff;
        }
        .nav-link.active {
          color: #ffffff;
          border-bottom-color: #f2c078;
        }
        .nav-user-actions {
          display: flex;
          align-items: center;
          gap: 20px;
        }
        .user-dropdown-wrapper {
          display: flex;
          align-items: center;
          gap: 16px;
        }
        .profile-link-nav {
          display: flex;
          align-items: center;
          gap: 10px;
          text-decoration: none;
          color: #ffffff;
          font-weight: 700;
        }
        .avatar-nav {
          width: 36px;
          height: 36px;
          border-radius: 50%;
          background: rgba(255, 255, 255, 0.15);
          color: #ffffff;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 0.95rem;
          font-weight: 800;
          border: 1.5px solid rgba(255, 255, 255, 0.4);
          backdrop-filter: blur(4px);
        }
        .logout-btn {
          background: rgba(255, 255, 255, 0.08);
          border: 1.5px solid rgba(255, 255, 255, 0.3);
          color: rgba(255, 255, 255, 0.9);
          padding: 8px 16px;
          border-radius: 99px;
          cursor: pointer;
          font-size: 0.85rem;
          font-weight: 700;
          transition: all 0.2s ease;
          backdrop-filter: blur(4px);
        }
        .logout-btn:hover {
          background: rgba(255, 255, 255, 0.15);
          color: #ffffff;
          border-color: rgba(255, 255, 255, 0.6);
        }
        .login-link-nav {
          background: #ffffff;
          color: #053b3c;
          padding: 10px 20px;
          border-radius: 99px;
          font-weight: 700;
          text-decoration: none;
          font-size: 0.9rem;
          transition: all 0.2s ease;
          box-shadow: 0 4px 14px rgba(0, 0, 0, 0.1);
        }
        .login-link-nav:hover {
          background: #f3f4f6;
          transform: translateY(-1px);
        }
        .mobile-nav-controls {
          display: none !important;
        }
        @media (max-width: 768px) {
          .mobile-nav-controls {
            display: flex !important;
          }
        }
      `}</style>
    </nav>
  );
}
