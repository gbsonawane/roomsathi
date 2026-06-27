import { useState, useEffect } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import { devLogin } from "../lib/api";
import { useAuth } from "../context/AuthContext";

export default function LoginPage() {
  const router = useRouter();
  const { user, login, loading } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Where to go after login (supports ?next=/admin etc.)
  const nextUrl = router.query.next || "/home";

  // Redirect if already logged in
  useEffect(() => {
    if (!loading && user) {
      router.replace(nextUrl);
    }
  }, [user, loading, router, nextUrl]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) {
      setError("Please fill in all fields.");
      return;
    }
    if (!email.includes("@")) {
      setError("Please enter a valid email address.");
      return;
    }

    setError("");
    setSubmitting(true);
    try {
      // Authenticate via devLogin API under the hood
      const auth = await devLogin(email.trim(), email.split("@")[0]);
      await login(auth);
      router.push(nextUrl);
    } catch (err) {
      setError(err.message || "Failed to sign in. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="auth-split-container">
      {/* LEFT PANEL: Illustration & Info */}
      <div className="left-panel">
        <div className="brand-logo-container">
          <Link href="/" className="brand-logo">
            RoomSathi<span>.</span>
          </Link>
        </div>

        {/* Skyline / Cozy Room illustration */}
        <div className="illustration-wrapper">
          <svg className="cozy-apartment-svg" viewBox="0 0 400 300" fill="none" xmlns="http://www.w3.org/2000/svg">
            {/* City skyline background */}
            <path d="M20 300V200H60V220H100V150H140V190H180V120H220V180H260V140H300V230H340V210H380V300H20Z" fill="#143029" opacity="0.4" />
            <path d="M40 300V170H80V190H120V120H160V160H200V90H240V160H280V110H320V210H360V180H380V300H40Z" fill="#0d241f" opacity="0.6" />
            
            {/* Cozy House/Apartment Silhouette */}
            <rect x="110" y="80" width="180" height="220" rx="8" fill="#1e3e35" stroke="#2a5549" strokeWidth="2" />
            <path d="M90 90L200 10L310 90H90Z" fill="#143029" stroke="#2a5549" strokeWidth="2" />
            
            {/* Windows glowing with warm yellow */}
            <rect className="window glowing" x="135" y="115" width="35" height="45" rx="4" fill="#f4a940" opacity="0.95" />
            <rect className="window" x="135" y="185" width="35" height="45" rx="4" fill="#0a1d18" />
            <rect className="window glowing" x="230" y="115" width="35" height="45" rx="4" fill="#f4a940" opacity="0.9" />
            <rect className="window glowing" x="230" y="185" width="35" height="45" rx="4" fill="#f4a940" opacity="0.85" />
            
            {/* Door */}
            <rect x="185" y="240" width="30" height="60" rx="2" fill="#0d241f" />
            <circle cx="210" cy="270" r="2" fill="#f4a940" />

            {/* Window Pane details */}
            <line x1="152.5" y1="115" x2="152.5" y2="160" stroke="#1e3e35" strokeWidth="1.5" />
            <line x1="135" y1="137.5" x2="170" y2="137.5" stroke="#1e3e35" strokeWidth="1.5" />
            
            <line x1="247.5" y1="115" x2="247.5" y2="160" stroke="#1e3e35" strokeWidth="1.5" />
            <line x1="230" y1="137.5" x2="265" y2="137.5" stroke="#1e3e35" strokeWidth="1.5" />

            <line x1="247.5" y1="185" x2="247.5" y2="230" stroke="#1e3e35" strokeWidth="1.5" />
            <line x1="230" y1="207.5" x2="265" y2="207.5" stroke="#1e3e35" strokeWidth="1.5" />
          </svg>
        </div>

        {/* Floating Badges */}
        <div className="floating-badge badge-1">
          <span className="price-tag-b">₹8,000/mo</span>
          <span className="dot">•</span>
          <span className="location-tag-b">Koregaon Park</span>
        </div>
        <div className="floating-badge badge-2">
          <span className="price-tag-b">₹12,000/mo</span>
          <span className="dot">•</span>
          <span className="location-tag-b">Kalyani Nagar</span>
        </div>
        <div className="floating-badge badge-3">
          <span className="price-tag-b">₹6,500/mo</span>
          <span className="dot">•</span>
          <span className="location-tag-b">Viman Nagar</span>
        </div>

        <div className="left-panel-footer">
          <h2>Find more than just a room.</h2>
          <p>Connect with compatible sathis who share your vibe, budget, and lifestyle.</p>
        </div>
      </div>

      {/* RIGHT PANEL: Form */}
      <div className="right-panel">
        <div className="form-container-wrapper">
          <div className="auth-form-card">
            <h1 className="auth-title">Welcome back to RoomSathi.</h1>
            <p className="auth-subtitle">Your next home is waiting.</p>

            <form className="auth-form" onSubmit={handleSubmit}>
              {error && <div className="error-message-banner">{error}</div>}

              {/* Floating Input Group: Email */}
              <div className="floating-group">
                <input
                  type="email"
                  id="email"
                  className={email ? "has-val" : ""}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  placeholder=" "
                />
                <label htmlFor="email">Email Address</label>
              </div>

              {/* Floating Input Group: Password */}
              <div className="floating-group">
                <input
                  type="password"
                  id="password"
                  className={password ? "has-val" : ""}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  placeholder=" "
                />
                <label htmlFor="password">Password</label>
              </div>

              <div className="form-actions-row">
                <a href="#forgot" className="forgot-pwd" onClick={(e) => { e.preventDefault(); alert("Password reset functionality is under development."); }}>
                  Forgot password?
                </a>
              </div>

              <button type="submit" className="primary-auth-btn" disabled={submitting}>
                {submitting ? "Signing In..." : "Sign In"}
              </button>
            </form>

            <div className="divider-row">
              <span>or continue with email</span>
            </div>

            <div className="social-row">
              <button className="social-google-btn" onClick={() => alert("Google Social Login is under development.")}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" fill="#FBBC05"/>
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" fill="#EA4335"/>
                </svg>
                Continue with Google
              </button>
            </div>

            <p className="auth-footer-text">
              New here? <Link href="/signup">Find your sathi →</Link>
            </p>
          </div>
        </div>
      </div>

      <style jsx global>{`
        /* Authentication Split Screen Layout styles */
        .auth-split-container {
          display: flex;
          min-height: 100vh;
          width: 100vw;
          overflow-x: hidden;
          background: #f8f9fb;
          font-family: 'Inter', sans-serif;
        }

        .left-panel {
          position: relative;
          width: 45%;
          background: linear-gradient(135deg, #1a3c34 0%, #0d2721 100%);
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          padding: 40px;
          color: white;
          overflow: hidden;
        }

        .right-panel {
          width: 55%;
          display: flex;
          align-items: center;
          justify-content: center;
          background: white;
          padding: 40px;
        }

        @media (max-width: 968px) {
          .auth-split-container {
            flex-direction: column;
          }
          .left-panel {
            width: 100%;
            min-height: 320px;
            padding: 30px;
            justify-content: center;
            gap: 20px;
          }
          .right-panel {
            width: 100%;
            padding: 40px 20px;
          }
          .illustration-wrapper {
            display: none;
          }
          .floating-badge {
            display: none !important;
          }
        }

        /* Brand Logo */
        .brand-logo-container {
          margin-bottom: 20px;
        }
        .brand-logo {
          font-size: 1.8rem;
          font-weight: 900;
          color: #f8f9fb;
          letter-spacing: -0.5px;
          font-family: 'Fraunces', serif;
        }
        .brand-logo span {
          color: #f4a940;
        }

        /* Cozy apartment illustration */
        .illustration-wrapper {
          display: flex;
          justify-content: center;
          align-items: center;
          margin: 40px 0;
          opacity: 0.9;
        }
        .cozy-apartment-svg {
          width: 80%;
          max-width: 320px;
          height: auto;
        }
        
        .window.glowing {
          animation: glowPulse 4s infinite alternate;
        }
        @keyframes glowPulse {
          0% { fill: #f4a940; filter: drop-shadow(0 0 2px rgba(244, 169, 64, 0.4)); }
          100% { fill: #fcd34d; filter: drop-shadow(0 0 8px rgba(244, 169, 64, 0.9)); }
        }

        /* Floating Badges */
        .floating-badge {
          position: absolute;
          background: rgba(255, 255, 255, 0.08);
          backdrop-filter: blur(12px);
          border: 1px solid rgba(255, 255, 255, 0.15);
          padding: 10px 16px;
          border-radius: 99px;
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 0.85rem;
          font-weight: 600;
          color: white;
          box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
          transition: all 0.3s ease;
        }
        .price-tag-b {
          color: #f4a940;
          font-weight: 800;
        }
        .dot {
          color: rgba(255, 255, 255, 0.4);
        }
        .badge-1 {
          top: 25%;
          left: 10%;
          animation: floatAnimation 6s infinite ease-in-out;
        }
        .badge-2 {
          top: 45%;
          right: 8%;
          animation: floatAnimation 8s infinite ease-in-out 1.5s;
        }
        .badge-3 {
          bottom: 35%;
          left: 12%;
          animation: floatAnimation 7s infinite ease-in-out 3s;
        }

        @keyframes floatAnimation {
          0%, 100% { transform: translateY(0px) rotate(0deg); }
          50% { transform: translateY(-12px) rotate(1deg); }
        }

        .left-panel-footer h2 {
          font-family: 'Fraunces', serif;
          font-size: 2.2rem;
          font-weight: 600;
          color: #ffffff;
          line-height: 1.25;
          margin: 0 0 10px;
        }
        .left-panel-footer p {
          color: rgba(255, 255, 255, 0.7);
          font-size: 1rem;
          line-height: 1.5;
          max-width: 380px;
          margin: 0;
        }

        /* Right panel form centering */
        .form-container-wrapper {
          width: 100%;
          max-width: 440px;
          animation: fadeInUp 0.6s ease-out;
        }

        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }

        .auth-title {
          font-family: 'Fraunces', serif;
          font-size: 2.4rem;
          font-weight: 800;
          color: #1a3c34;
          margin: 0 0 8px;
          letter-spacing: -0.5px;
        }
        .auth-subtitle {
          color: #64748b;
          font-size: 1.05rem;
          margin: 0 0 32px;
          font-weight: 500;
        }

        /* Floating Input Labels */
        .floating-group {
          position: relative;
          margin-bottom: 24px;
        }
        .floating-group input {
          width: 100%;
          border: 2px solid #e2e8f0;
          border-radius: 12px;
          padding: 16px;
          font-size: 0.95rem;
          background: transparent;
          color: #1e293b;
          outline: none;
          transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
        }
        .floating-group input:focus {
          border-color: #1a3c34;
          box-shadow: 0 0 0 4px rgba(26, 60, 52, 0.08);
          background: white;
        }
        .floating-group label {
          position: absolute;
          left: 16px;
          top: 50%;
          transform: translateY(-50%);
          color: #94a3b8;
          font-size: 0.95rem;
          font-weight: 500;
          pointer-events: none;
          transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
          background: transparent;
          padding: 0 4px;
          margin: 0;
        }
        /* Style label on input focus or when it contains value */
        .floating-group input:focus ~ label,
        .floating-group input:not(:placeholder-shown) ~ label,
        .floating-group input.has-val ~ label {
          top: 0;
          transform: translateY(-50%) scale(0.85);
          background: white;
          color: #1a3c34;
          font-weight: 600;
        }

        .form-actions-row {
          display: flex;
          justify-content: flex-end;
          margin-bottom: 24px;
          margin-top: -8px;
        }
        .forgot-pwd {
          color: #64748b;
          font-size: 0.85rem;
          font-weight: 600;
          transition: color 0.2s ease;
        }
        .forgot-pwd:hover {
          color: #1a3c34;
          text-decoration: underline;
        }

        .primary-auth-btn {
          width: 100%;
          background: #1a3c34;
          color: white;
          border: none;
          border-radius: 999px;
          padding: 16px;
          font-weight: 700;
          font-size: 1rem;
          cursor: pointer;
          transition: all 0.2s ease;
          box-shadow: 0 4px 12px rgba(26, 60, 52, 0.15);
        }
        .primary-auth-btn:hover {
          background: #122b25;
          transform: translateY(-1px);
          box-shadow: 0 6px 18px rgba(26, 60, 52, 0.25);
        }
        .primary-auth-btn:active {
          transform: translateY(0);
        }
        .primary-auth-btn:disabled {
          background: #94a3b8;
          cursor: not-allowed;
          box-shadow: none;
        }

        /* Divider */
        .divider-row {
          display: flex;
          align-items: center;
          text-align: center;
          margin: 24px 0;
          color: #94a3b8;
          font-size: 0.85rem;
          font-weight: 500;
        }
        .divider-row::before,
        .divider-row::after {
          content: '';
          flex: 1;
          border-bottom: 1px solid #e2e8f0;
        }
        .divider-row::before {
          margin-right: .75em;
        }
        .divider-row::after {
          margin-left: .75em;
        }

        /* Social buttons */
        .social-google-btn {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 12px;
          width: 100%;
          background: white;
          color: #334155;
          border: 2px solid #e2e8f0;
          border-radius: 999px;
          padding: 14px;
          font-weight: 600;
          font-size: 0.95rem;
          cursor: pointer;
          transition: all 0.2s ease;
        }
        .social-google-btn:hover {
          background: #f8fafc;
          border-color: #cbd5e1;
        }

        .auth-footer-text {
          text-align: center;
          margin-top: 32px;
          color: #64748b;
          font-size: 0.95rem;
          font-weight: 500;
        }
        .auth-footer-text a {
          color: #1a3c34;
          font-weight: 700;
          transition: color 0.15s ease;
        }
        .auth-footer-text a:hover {
          color: #f4a940;
          text-decoration: underline;
        }

        .error-message-banner {
          background: #fef2f2;
          border: 1px solid #fee2e2;
          color: #b91c1c;
          padding: 12px 16px;
          border-radius: 10px;
          font-size: 0.9rem;
          margin-bottom: 20px;
          font-weight: 500;
        }
      `}</style>
    </div>
  );
}
