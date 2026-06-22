import Link from "next/link";
import { useRouter } from "next/router";
import { useAuth } from "../context/AuthContext";

export default function Navbar() {
  const router = useRouter();
  const { user, logout } = useAuth();

  return (
    <nav className="custom-navbar">
      <div className="nav-container">
        <Link href="/home" className="nav-logo" aria-label="RoomSathi Home">
          <span style={{ color: '#ffffff', fontWeight: 900 }}>Room</span>
          <span style={{ color: 'rgba(0, 0, 0, 0.96)', fontWeight: 900 }}>Sathi</span>
        </Link>

        <div className="nav-menu">
          <Link href="/home" className={`nav-link ${router.pathname === "/home" ? "active" : ""}`}>
            Dashboard
          </Link>
          <Link href="/search" className={`nav-link ${router.pathname === "/search" ? "active" : ""}`}>
            Search
          </Link>
          <Link href="/create-listing" className={`nav-link ${router.pathname === "/create-listing" ? "active" : ""}`}>
            Post a Room
          </Link>
        </div>

        <div className="nav-user-actions">
          {user ? (
            <div className="user-dropdown-wrapper">
              <Link href="/profile" className="profile-link-nav">
                <span className="avatar-nav">
                  {user.full_name ? user.full_name[0].toUpperCase() : "👤"}
                </span>
              </Link>
              <button className="logout-btn" onClick={() => {
                logout();
                router.push("/");
              }}>
                Logout
              </button>
            </div>
          ) : (
            <Link href="/" className="login-link-nav">
              Sign In
            </Link>
          )}
        </div>
      </div>

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
        }
        @media(max-width: 600px) {
          .nav-menu {
            gap: 16px;
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
          border-bottom-color: #f2c078; /* Muted gold matching tagline */
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
        /* User name hidden */
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
      `}</style>
    </nav>
  );
}
