import { useState, useEffect } from "react";
import { useRouter } from "next/router";
import { adminLogin, getAdminToken, validateAdminToken } from "../../lib/adminAuth";

export default function AdminLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [checking, setChecking] = useState(true);

  // Check for existing admin session on mount — redirect to /admin if valid
  useEffect(() => {
    const token = getAdminToken();
    if (!token) { setChecking(false); return; }
    validateAdminToken(token).then((user) => {
      if (user) {
        router.replace("/admin");
      } else {
        setChecking(false);
      }
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    if (!email.trim()) { setError("Email is required."); return; }
    if (!email.includes("@")) { setError("Enter a valid email address."); return; }
    if (!password.trim()) { setError("Password is required."); return; }

    setSubmitting(true);
    try {
      await adminLogin(email.trim());
      router.replace("/admin");
    } catch (err) {
      setError(err.message || "Authentication failed. Try again.");
    } finally {
      setSubmitting(false);
    }
  };

  if (checking) {
    return (
      <div className="al-checking">
        <div className="al-spinner" />
        <p>Verifying admin session…</p>
        <style jsx global>{`
          *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
          body { background: #060b18; }
          .al-checking {
            min-height: 100vh; display: flex; flex-direction: column;
            align-items: center; justify-content: center;
            background: #060b18; gap: 16px; color: #64748b;
            font-family: 'Inter', sans-serif;
          }
          .al-spinner {
            width: 36px; height: 36px; border: 3px solid #1e293b;
            border-top-color: #10b981; border-radius: 50%;
            animation: spin 0.8s linear infinite;
          }
          @keyframes spin { to { transform: rotate(360deg); } }
        `}</style>
      </div>
    );
  }

  return (
    <>
      <div className="al-root">
        {/* Background grid */}
        <div className="al-grid-bg" aria-hidden="true" />
        {/* Glow orbs */}
        <div className="al-orb al-orb-1" aria-hidden="true" />
        <div className="al-orb al-orb-2" aria-hidden="true" />

        <div className="al-card">
          {/* Top badge */}
          <div className="al-badge">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4z"/>
            </svg>
            SECURE ADMIN PORTAL
          </div>

          {/* Shield icon */}
          <div className="al-shield-wrap">
            <svg className="al-shield" viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg">
              <defs>
                <linearGradient id="shieldGrad" x1="0" y1="0" x2="80" y2="80" gradientUnits="userSpaceOnUse">
                  <stop offset="0%" stopColor="#10b981"/>
                  <stop offset="100%" stopColor="#059669"/>
                </linearGradient>
                <linearGradient id="shieldGlow" x1="40" y1="0" x2="40" y2="80" gradientUnits="userSpaceOnUse">
                  <stop offset="0%" stopColor="#10b981" stopOpacity="0.3"/>
                  <stop offset="100%" stopColor="#059669" stopOpacity="0"/>
                </linearGradient>
              </defs>
              {/* Shield body */}
              <path d="M40 6L12 18v18c0 16.6 11.5 32.2 27 36 15.5-3.8 27-19.4 27-36V18L40 6z"
                fill="url(#shieldGrad)" opacity="0.15" stroke="url(#shieldGrad)" strokeWidth="2"/>
              {/* Lock icon inside shield */}
              <rect x="30" y="36" width="20" height="16" rx="3" fill="url(#shieldGrad)" opacity="0.9"/>
              <path d="M34 36v-4a6 6 0 0112 0v4" stroke="url(#shieldGrad)" strokeWidth="2.5"
                strokeLinecap="round" fill="none" opacity="0.9"/>
              <circle cx="40" cy="44" r="2.5" fill="#0a0f1e"/>
            </svg>
          </div>

          <h1 className="al-title">Admin Portal</h1>
          <p className="al-subtitle">RoomSathi · Restricted Access</p>

          <form className="al-form" onSubmit={handleSubmit} noValidate>
            {error && (
              <div className="al-error" role="alert">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/>
                </svg>
                {error}
              </div>
            )}

            <div className="al-field">
              <label htmlFor="admin-email">Admin Email</label>
              <div className="al-input-wrap">
                <svg className="al-input-icon" width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M20 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z"/>
                </svg>
                <input
                  id="admin-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@roomsathi.com"
                  autoComplete="username"
                  required
                />
              </div>
            </div>

            <div className="al-field">
              <label htmlFor="admin-password">Password</label>
              <div className="al-input-wrap">
                <svg className="al-input-icon" width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1 1.71 0 3.1 1.39 3.1 3.1v2z"/>
                </svg>
                <input
                  id="admin-password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter admin password"
                  autoComplete="current-password"
                  required
                />
              </div>
            </div>

            <button type="submit" className="al-btn" disabled={submitting}>
              {submitting ? (
                <>
                  <div className="al-btn-spinner" />
                  Authenticating…
                </>
              ) : (
                <>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4z"/>
                  </svg>
                  Access Admin Console
                </>
              )}
            </button>
          </form>

          <div className="al-footer">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
              <path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zM12 17c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1 1.71 0 3.1 1.39 3.1 3.1v2z"/>
            </svg>
            Session is isolated from regular user accounts
          </div>
        </div>
      </div>

      <style jsx global>{`
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        html, body { height: 100%; }
        body {
          background: #060b18;
          font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
          -webkit-font-smoothing: antialiased;
        }

        /* Root layout */
        .al-root {
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          background: #060b18;
          position: relative;
          overflow: hidden;
          padding: 20px;
        }

        /* Grid background */
        .al-grid-bg {
          position: absolute;
          inset: 0;
          background-image:
            linear-gradient(rgba(16,185,129,0.04) 1px, transparent 1px),
            linear-gradient(90deg, rgba(16,185,129,0.04) 1px, transparent 1px);
          background-size: 40px 40px;
          mask-image: radial-gradient(ellipse 80% 80% at 50% 50%, black 30%, transparent 100%);
        }

        /* Glow orbs */
        .al-orb {
          position: absolute;
          border-radius: 50%;
          filter: blur(80px);
          pointer-events: none;
        }
        .al-orb-1 {
          width: 500px; height: 500px;
          top: -150px; left: -150px;
          background: radial-gradient(circle, rgba(16,185,129,0.12) 0%, transparent 70%);
          animation: orbFloat 8s ease-in-out infinite;
        }
        .al-orb-2 {
          width: 400px; height: 400px;
          bottom: -100px; right: -100px;
          background: radial-gradient(circle, rgba(59,130,246,0.08) 0%, transparent 70%);
          animation: orbFloat 10s ease-in-out infinite reverse;
        }
        @keyframes orbFloat {
          0%, 100% { transform: translate(0, 0); }
          50% { transform: translate(20px, -20px); }
        }

        /* Card */
        .al-card {
          position: relative;
          z-index: 1;
          width: 100%;
          max-width: 420px;
          background: rgba(13, 20, 38, 0.85);
          border: 1px solid rgba(16, 185, 129, 0.2);
          border-radius: 20px;
          padding: 40px 36px;
          backdrop-filter: blur(20px);
          box-shadow:
            0 0 0 1px rgba(16,185,129,0.05),
            0 20px 60px rgba(0,0,0,0.6),
            0 0 80px rgba(16,185,129,0.05) inset;
          animation: cardIn 0.5s ease-out;
        }
        @keyframes cardIn {
          from { opacity: 0; transform: translateY(24px) scale(0.97); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }

        /* Badge */
        .al-badge {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          background: rgba(16,185,129,0.1);
          border: 1px solid rgba(16,185,129,0.3);
          color: #10b981;
          font-size: 0.65rem;
          font-weight: 800;
          letter-spacing: 1.5px;
          padding: 5px 12px;
          border-radius: 999px;
          margin-bottom: 28px;
        }

        /* Shield */
        .al-shield-wrap {
          display: flex;
          justify-content: center;
          margin-bottom: 20px;
        }
        .al-shield {
          width: 72px; height: 72px;
          filter: drop-shadow(0 0 16px rgba(16,185,129,0.35));
          animation: shieldPulse 3s ease-in-out infinite;
        }
        @keyframes shieldPulse {
          0%, 100% { filter: drop-shadow(0 0 12px rgba(16,185,129,0.3)); }
          50%       { filter: drop-shadow(0 0 24px rgba(16,185,129,0.55)); }
        }

        /* Headings */
        .al-title {
          font-size: 1.8rem;
          font-weight: 800;
          color: #f1f5f9;
          text-align: center;
          letter-spacing: -0.5px;
          margin-bottom: 6px;
        }
        .al-subtitle {
          font-size: 0.82rem;
          color: #475569;
          text-align: center;
          margin-bottom: 32px;
          letter-spacing: 0.3px;
        }

        /* Form */
        .al-form { display: flex; flex-direction: column; gap: 20px; }

        /* Error */
        .al-error {
          display: flex;
          align-items: center;
          gap: 8px;
          background: rgba(239,68,68,0.1);
          border: 1px solid rgba(239,68,68,0.3);
          color: #f87171;
          border-radius: 10px;
          padding: 12px 14px;
          font-size: 0.83rem;
          font-weight: 500;
          animation: errShake 0.4s ease;
        }
        @keyframes errShake {
          0%, 100% { transform: translateX(0); }
          25%       { transform: translateX(-4px); }
          75%       { transform: translateX(4px); }
        }

        /* Field */
        .al-field { display: flex; flex-direction: column; gap: 8px; }
        .al-field label {
          font-size: 0.78rem;
          font-weight: 600;
          color: #94a3b8;
          letter-spacing: 0.5px;
          text-transform: uppercase;
        }

        /* Input */
        .al-input-wrap {
          position: relative;
          display: flex;
          align-items: center;
        }
        .al-input-icon {
          position: absolute;
          left: 14px;
          color: #475569;
          pointer-events: none;
          transition: color 0.2s;
        }
        .al-input-wrap:focus-within .al-input-icon { color: #10b981; }

        .al-input-wrap input {
          width: 100%;
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 10px;
          padding: 13px 14px 13px 40px;
          font-size: 0.9rem;
          color: #e2e8f0;
          font-family: inherit;
          outline: none;
          transition: border-color 0.2s, box-shadow 0.2s, background 0.2s;
        }
        .al-input-wrap input::placeholder { color: #334155; }
        .al-input-wrap input:focus {
          border-color: rgba(16,185,129,0.5);
          box-shadow: 0 0 0 3px rgba(16,185,129,0.1);
          background: rgba(255,255,255,0.06);
        }

        /* Submit button */
        .al-btn {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          width: 100%;
          padding: 14px;
          border: none;
          border-radius: 10px;
          background: linear-gradient(135deg, #10b981, #059669);
          color: #fff;
          font-family: inherit;
          font-size: 0.92rem;
          font-weight: 700;
          cursor: pointer;
          letter-spacing: 0.3px;
          transition: all 0.2s;
          box-shadow: 0 4px 16px rgba(16,185,129,0.25);
          margin-top: 4px;
        }
        .al-btn:hover:not(:disabled) {
          background: linear-gradient(135deg, #059669, #047857);
          box-shadow: 0 6px 24px rgba(16,185,129,0.35);
          transform: translateY(-1px);
        }
        .al-btn:active:not(:disabled) { transform: translateY(0); }
        .al-btn:disabled {
          opacity: 0.6;
          cursor: not-allowed;
          transform: none;
        }
        .al-btn-spinner {
          width: 16px; height: 16px;
          border: 2px solid rgba(255,255,255,0.3);
          border-top-color: #fff;
          border-radius: 50%;
          animation: spin 0.7s linear infinite;
        }
        @keyframes spin { to { transform: rotate(360deg); } }

        /* Footer note */
        .al-footer {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
          margin-top: 24px;
          color: #334155;
          font-size: 0.74rem;
          font-weight: 500;
        }
      `}</style>
    </>
  );
}
