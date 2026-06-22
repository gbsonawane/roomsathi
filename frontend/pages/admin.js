import { useState, useEffect } from "react";
import { useRouter } from "next/router";
import { devLogin } from "../lib/api";
import { useAuth } from "../context/AuthContext";

export default function AdminPage() {
  const router = useRouter();
  const { user, login, loading } = useAuth();
  
  const [isAdminAuthenticated, setIsAdminAuthenticated] = useState(false);
  const [password, setPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  
  // Dashboard states
  const [activeTab, setActiveTab] = useState("login"); // login | status
  const [devEmail, setDevEmail] = useState("");
  const [devName, setDevName] = useState("");
  const [customLoginError, setCustomLoginError] = useState("");
  const [submittingDevLogin, setSubmittingDevLogin] = useState(false);
  const [backendStatus, setBackendStatus] = useState("Checking...");
  const [backendUrl, setBackendUrl] = useState("");

  // Check if someone is already logged in as a regular user. If so, redirect them away.
  useEffect(() => {
    if (!loading && user) {
      router.replace("/home");
    }
  }, [user, loading, router]);

  // Load admin session state if any
  useEffect(() => {
    const isAuth = sessionStorage.getItem("admin_auth") === "true";
    if (isAuth) {
      setIsAdminAuthenticated(true);
    }
    
    // Determine backend URL
    const url = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
    setBackendUrl(url);
    
    // Check connection
    fetch(`${url}/`)
      .then(res => {
        if (res.ok) setBackendStatus("Online ✅");
        else setBackendStatus("Offline ❌ (Server returned error)");
      })
      .catch(() => {
        setBackendStatus("Offline ❌ (Failed to connect)");
      });
  }, []);

  const handleAdminAuthSubmit = (e) => {
    e.preventDefault();
    if (password === "admin123") {
      setIsAdminAuthenticated(true);
      sessionStorage.setItem("admin_auth", "true");
      setLoginError("");
    } else {
      setLoginError("Invalid console access passcode.");
    }
  };

  const handleDevLoginAction = async (email, name) => {
    if (!email) {
      setCustomLoginError("Email or phone is required.");
      return;
    }
    setCustomLoginError("");
    setSubmittingDevLogin(true);
    try {
      const auth = await devLogin(email.trim(), name.trim() || "Dev User");
      await login(auth);
      // Auth Context will redirect to /home automatically via useEffect or router
      router.push("/home");
    } catch (err) {
      setCustomLoginError(err.message || "Failed to initiate dev login session.");
    } finally {
      setSubmittingDevLogin(false);
    }
  };

  const handleLogoutAdmin = () => {
    setIsAdminAuthenticated(false);
    sessionStorage.removeItem("admin_auth");
  };

  // 1. Password Protected Login View
  if (!isAdminAuthenticated) {
    return (
      <div className="admin-console-login">
        <div className="console-box">
          <div className="console-header">
            <span className="dot red"></span>
            <span className="dot yellow"></span>
            <span className="dot green"></span>
            <span className="console-title">RoomSathi Terminal</span>
          </div>
          <div className="console-body">
            <h1 className="logo-term">RoomSathi Dev Console</h1>
            <p className="system-msg">Unauthorized access is logged. Enter credentials to proceed.</p>
            
            <form onSubmit={handleAdminAuthSubmit}>
              {loginError && <div className="term-error">{loginError}</div>}
              
              <div className="input-row">
                <span className="prompt">$ passcode:</span>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  autoFocus
                  required
                />
              </div>
              
              <button type="submit" className="term-btn">Access Console</button>
            </form>
          </div>
        </div>

        <style jsx global>{`
          .admin-console-login {
            background: #000000;
            min-height: 100vh;
            width: 100vw;
            display: flex;
            align-items: center;
            justify-content: center;
            font-family: 'Courier New', Courier, monospace;
            color: #10b981;
            padding: 20px;
          }

          .console-box {
            width: 100%;
            max-width: 480px;
            background: #090d16;
            border: 1px solid #10b981;
            border-radius: 8px;
            box-shadow: 0 0 30px rgba(16, 185, 129, 0.15);
            overflow: hidden;
          }

          .console-header {
            background: #1e293b;
            padding: 10px 16px;
            display: flex;
            align-items: center;
            gap: 6px;
            border-bottom: 1px solid #10b981;
          }

          .dot {
            width: 12px;
            height: 12px;
            border-radius: 50%;
            display: inline-block;
          }
          .dot.red { background: #ef4444; }
          .dot.yellow { background: #eab308; }
          .dot.green { background: #22c55e; }
          
          .console-title {
            color: #94a3b8;
            font-size: 0.8rem;
            margin-left: 8px;
            font-weight: 700;
          }

          .console-body {
            padding: 30px;
          }

          .logo-term {
            font-size: 1.3rem;
            font-weight: 900;
            color: #ffffff;
            margin: 0 0 12px;
            letter-spacing: -0.5px;
          }

          .system-msg {
            color: #64748b;
            font-size: 0.85rem;
            line-height: 1.5;
            margin-bottom: 28px;
          }

          .input-row {
            display: flex;
            align-items: center;
            gap: 12px;
            background: #000000;
            border: 1px solid #334155;
            border-radius: 6px;
            padding: 12px;
            margin-bottom: 20px;
          }

          .prompt {
            color: #10b981;
            font-weight: bold;
            font-size: 0.9rem;
          }

          .input-row input {
            background: transparent;
            border: none;
            outline: none;
            color: #ffffff;
            font-family: inherit;
            font-size: 0.95rem;
            flex-grow: 1;
          }

          .term-error {
            background: rgba(239, 68, 68, 0.1);
            border: 1px solid #ef4444;
            color: #ef4444;
            padding: 10px;
            border-radius: 6px;
            font-size: 0.8rem;
            margin-bottom: 20px;
          }

          .term-btn {
            background: #10b981;
            color: #000000;
            border: none;
            outline: none;
            padding: 12px;
            border-radius: 6px;
            width: 100%;
            font-family: inherit;
            font-weight: 800;
            cursor: pointer;
            transition: all 0.2s ease;
          }
          .term-btn:hover {
            background: #34d399;
            box-shadow: 0 0 15px rgba(16, 185, 129, 0.4);
          }
        `}</style>
      </div>
    );
  }

  // 2. Authenticated Admin Dashboard Layout
  return (
    <div className="admin-console-dashboard">
      
      {/* Sidebar Layout */}
      <aside className="admin-sidebar">
        <div className="sidebar-brand">
          <span>CONSOLE v1.0.0</span>
        </div>
        
        <nav className="sidebar-nav">
          <button 
            className={`nav-item ${activeTab === "login" ? "active" : ""}`}
            onClick={() => setActiveTab("login")}
          >
            [+] Quick Login
          </button>
          <button 
            className={`nav-item ${activeTab === "status" ? "active" : ""}`}
            onClick={() => setActiveTab("status")}
          >
            [i] System Status
          </button>
        </nav>

        <div className="sidebar-footer">
          <button onClick={handleLogoutAdmin} className="nav-item exit-btn">
            [x] Exit Console
          </button>
        </div>
      </aside>

      {/* Main Panel Content */}
      <main className="admin-content">
        <header className="content-header">
          <h2>$ dev_dashboard --active-tab={activeTab}</h2>
          <span className="conn-indicator">API Status: {backendStatus}</span>
        </header>

        <div className="content-body">
          {activeTab === "login" && (
            <div className="tab-pane animate-fade">
              <h3>Preset Accounts</h3>
              <p className="tab-desc">Instantly log into standard test configurations loaded in the development DB.</p>
              
              <div className="preset-grid">
                <div className="preset-card">
                  <h4>🏠 Seeker Account</h4>
                  <p>Mock user looking for apartments and roommate pairings in Pune.</p>
                  <button 
                    className="action-btn"
                    disabled={submittingDevLogin}
                    onClick={() => handleDevLoginAction("seeker@roomsathi.com", "Dev Seeker")}
                  >
                    Login as Seeker
                  </button>
                </div>

                <div className="preset-card">
                  <h4>🤝 Owner Account</h4>
                  <p>Mock user listing rooms and roommate slots in key Pune locales.</p>
                  <button 
                    className="action-btn"
                    disabled={submittingDevLogin}
                    onClick={() => handleDevLoginAction("owner@roomsathi.com", "Dev Owner")}
                  >
                    Login as Owner
                  </button>
                </div>
              </div>

              <div className="custom-login-section">
                <h3>Custom Dev Login</h3>
                <p className="tab-desc">Generate a dynamic JWT login token for any email/phone bypass immediately.</p>
                
                {customLoginError && <div className="term-error">{customLoginError}</div>}
                
                <div className="custom-form">
                  <div className="form-group-term">
                    <label>Email or Phone</label>
                    <input 
                      type="text" 
                      placeholder="e.g. user@roomsathi.com" 
                      value={devEmail}
                      onChange={(e) => setDevEmail(e.target.value)}
                    />
                  </div>

                  <div className="form-group-term">
                    <label>Full Name</label>
                    <input 
                      type="text" 
                      placeholder="e.g. Rahul Sharma" 
                      value={devName}
                      onChange={(e) => setDevName(e.target.value)}
                    />
                  </div>

                  <button 
                    className="action-btn custom-login-btn"
                    disabled={submittingDevLogin || !devEmail}
                    onClick={() => handleDevLoginAction(devEmail, devName)}
                  >
                    {submittingDevLogin ? "Bypassing Authentication..." : "Bypass & Login"}
                  </button>
                </div>
              </div>
            </div>
          )}

          {activeTab === "status" && (
            <div className="tab-pane animate-fade">
              <h3>System Diagnostics</h3>
              <p className="tab-desc">Verifying backend routes connectivity and environment definitions.</p>
              
              <div className="status-details-box">
                <div className="status-row">
                  <span className="param">Backend Target URL:</span>
                  <span className="val-mono">{backendUrl}</span>
                </div>
                <div className="status-row">
                  <span className="param">Backend Connection Status:</span>
                  <span className="val-mono">{backendStatus}</span>
                </div>
                <div className="status-row">
                  <span className="param">FastAPI API Docs:</span>
                  <span className="val-mono">
                    <a href={`${backendUrl}/docs`} target="_blank" rel="noreferrer" style={{ color: "#10b981", textDecoration: "underline" }}>
                      {backendUrl}/docs
                    </a>
                  </span>
                </div>
                <div className="status-row">
                  <span className="param">Development Engine:</span>
                  <span className="val-mono">Next.js + FastAPI + PostgreSQL</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>

      <style jsx global>{`
        .admin-console-dashboard {
          display: flex;
          background: #020617;
          min-height: 100vh;
          width: 100vw;
          color: #94a3b8;
          font-family: 'Courier New', Courier, monospace;
        }

        /* Sidebar Layout */
        .admin-sidebar {
          width: 250px;
          background: #090d16;
          border-right: 1px solid #10b981;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          padding: 24px;
        }

        .sidebar-brand {
          color: #ffffff;
          font-size: 0.95rem;
          font-weight: 900;
          border-bottom: 1px dashed #10b981;
          padding-bottom: 16px;
          margin-bottom: 24px;
        }

        .sidebar-nav {
          display: flex;
          flex-direction: column;
          gap: 12px;
          flex-grow: 1;
        }

        .nav-item {
          background: transparent;
          border: 1px solid transparent;
          outline: none;
          color: #94a3b8;
          text-align: left;
          padding: 12px;
          border-radius: 4px;
          cursor: pointer;
          font-family: inherit;
          font-size: 0.9rem;
          transition: all 0.2s ease;
        }
        .nav-item:hover, .nav-item.active {
          color: #10b981;
          border-color: #10b981;
          background: rgba(16, 185, 129, 0.05);
        }
        .nav-item.exit-btn {
          width: 100%;
          border-color: rgba(239, 68, 68, 0.3);
          color: #ef4444;
        }
        .nav-item.exit-btn:hover {
          background: rgba(239, 68, 68, 0.1);
          border-color: #ef4444;
        }

        /* Main Content Pane */
        .admin-content {
          flex-grow: 1;
          display: flex;
          flex-direction: column;
          min-height: 100vh;
          background: #020617;
        }

        .content-header {
          padding: 24px 40px;
          border-bottom: 1px solid #1e293b;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        .content-header h2 {
          color: #ffffff;
          font-size: 1.1rem;
          margin: 0;
        }
        .conn-indicator {
          font-size: 0.8rem;
          color: #10b981;
        }

        .content-body {
          padding: 40px;
          overflow-y: auto;
          flex-grow: 1;
        }

        .tab-pane h3 {
          color: #ffffff;
          font-size: 1.25rem;
          margin: 0 0 8px;
        }
        .tab-desc {
          font-size: 0.85rem;
          color: #64748b;
          margin: 0 0 24px;
        }

        /* Presets Grid */
        .preset-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 20px;
          margin-bottom: 40px;
        }
        @media(max-width: 768px) {
          .preset-grid {
            grid-template-columns: 1fr;
          }
        }
        .preset-card {
          background: #090d16;
          border: 1px solid #334155;
          border-radius: 6px;
          padding: 24px;
          display: flex;
          flex-direction: column;
          gap: 12px;
        }
        .preset-card h4 {
          color: #ffffff;
          margin: 0;
          font-size: 1rem;
        }
        .preset-card p {
          color: #64748b;
          font-size: 0.8rem;
          line-height: 1.4;
          margin: 0;
          flex-grow: 1;
        }

        .action-btn {
          background: #10b981;
          color: #000000;
          border: none;
          outline: none;
          padding: 10px 16px;
          border-radius: 4px;
          font-family: inherit;
          font-weight: 850;
          font-size: 0.85rem;
          cursor: pointer;
          transition: all 0.2s ease;
          text-align: center;
        }
        .action-btn:hover {
          background: #34d399;
          box-shadow: 0 0 10px rgba(16, 185, 129, 0.3);
        }
        .action-btn:disabled {
          background: #334155;
          color: #64748b;
          cursor: not-allowed;
          box-shadow: none;
        }

        /* Custom Login Form */
        .custom-login-section {
          background: #090d16;
          border: 1px solid #334155;
          border-radius: 6px;
          padding: 30px;
        }
        .custom-form {
          display: flex;
          flex-direction: column;
          gap: 16px;
          max-width: 400px;
        }
        .form-group-term {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        .form-group-term label {
          color: #94a3b8;
          font-size: 0.8rem;
        }
        .form-group-term input {
          background: #000000;
          border: 1px solid #334155;
          border-radius: 4px;
          padding: 12px;
          color: #ffffff;
          font-family: inherit;
          font-size: 0.9rem;
          outline: none;
        }
        .form-group-term input:focus {
          border-color: #10b981;
        }
        .custom-login-btn {
          width: 100%;
          padding: 12px;
        }

        /* Diagnostics info Box */
        .status-details-box {
          background: #090d16;
          border: 1px solid #334155;
          border-radius: 6px;
          padding: 24px;
          display: flex;
          flex-direction: column;
          gap: 16px;
        }
        .status-row {
          display: flex;
          justify-content: space-between;
          padding-bottom: 12px;
          border-bottom: 1px solid #1e293b;
        }
        .status-row:last-child {
          border-bottom: none;
          padding-bottom: 0;
        }
        .param {
          color: #64748b;
          font-size: 0.85rem;
        }
        .val-mono {
          color: #ffffff;
          font-size: 0.85rem;
        }

        /* Animations */
        .animate-fade {
          animation: termFadeIn 0.2s ease-out;
        }
        @keyframes termFadeIn {
          from { opacity: 0; transform: translateY(3px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
