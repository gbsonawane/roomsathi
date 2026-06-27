import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/router";
import {
  getAdminToken,
  getAdminUser,
  validateAdminToken,
  clearAdminSession,
} from "../lib/adminAuth";

const API = process.env.NEXT_PUBLIC_API_URL ||
            process.env.NEXT_PUBLIC_FASTAPI_URL ||
            "http://localhost:8000";

function apiCall(path, method = "GET", token, body) {
  return fetch(`${API}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  }).then(async (r) => {
    if (!r.ok) throw new Error((await r.json()).detail || r.statusText);
    return r.json();
  });
}

// ── Stat Card ────────────────────────────────────────────────
function StatCard({ icon, label, value, color }) {
  return (
    <div className="stat-card" style={{ borderColor: color }}>
      <div className="stat-icon" style={{ background: color + "22", color }}>
        {icon}
      </div>
      <div>
        <div className="stat-value">{value}</div>
        <div className="stat-label">{label}</div>
      </div>
    </div>
  );
}

// ── Tab: Pending Listings ─────────────────────────────────────
function PendingTab({ token }) {
  const [listings, setListings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiCall("/listings/?status=pending", "GET", token);
      setListings(Array.isArray(data) ? data : []);
    } catch (e) {
      setErr(e.message);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { load(); }, [load]);

  const act = async (id, action) => {
    try {
      await apiCall(`/listings/${id}/${action}`, "PATCH", token);
      setListings((prev) => prev.filter((l) => l.id !== id));
    } catch (e) {
      alert(e.message);
    }
  };

  if (loading) return <div className="loading-msg">Loading pending listings…</div>;
  if (err) return <div className="error-msg">Error: {err}</div>;
  if (!listings.length) return <div className="empty-msg">🎉 No pending listings — all clear!</div>;

  return (
    <div className="cards-grid">
      {listings.map((l) => (
        <div key={l.id} className="listing-card">
          <div className="lc-header">
            <span className="lc-plan">{l.listing_plan}</span>
            <span className="lc-type">{l.property_type}</span>
          </div>
          <h3 className="lc-title">{l.title || `${l.property_type} in ${l.area}`}</h3>
          <div className="lc-meta">
            <span>📍 {l.area}, {l.city}</span>
            <span>💰 ₹{l.rent?.toLocaleString()}/mo</span>
          </div>
          <div className="lc-meta">
            <span>👤 {l.owner_name || "Unknown"}</span>
            <span>📅 {l.created_at ? new Date(l.created_at).toLocaleDateString("en-IN") : "—"}</span>
          </div>
          <div className="lc-actions">
            <button className="btn-approve" onClick={() => act(l.id, "approve")}>✅ Approve</button>
            <button className="btn-reject" onClick={() => act(l.id, "reject")}>❌ Reject</button>
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Tab: All Payments ─────────────────────────────────────────
function PaymentsTab({ token }) {
  const [data, setData] = useState({ payments: [], total_revenue: 0 });
  const [filter, setFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  const load = useCallback(async (statusFilter) => {
    setLoading(true);
    try {
      const q = statusFilter ? `?status=${statusFilter}` : "";
      const res = await apiCall(`/payments/all${q}`, "GET", token);
      setData(res);
    } catch (e) {
      setErr(e.message);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { load(filter); }, [load, filter]);

  const statusColor = { success: "#10b981", pending: "#f59e0b", failed: "#ef4444", refunded: "#8b5cf6" };

  if (err) return <div className="error-msg">Error: {err}</div>;

  return (
    <div>
      <div className="payments-header">
        <div className="revenue-badge">
          <span>💰 Total Revenue</span>
          <strong>₹{Number(data.total_revenue || 0).toLocaleString()}</strong>
        </div>
        <div className="filter-row">
          {["", "success", "pending", "failed"].map((s) => (
            <button key={s} className={`filter-btn ${filter === s ? "active" : ""}`} onClick={() => setFilter(s)}>
              {s || "All"}
            </button>
          ))}
        </div>
      </div>
      {loading ? (
        <div className="loading-msg">Loading payments…</div>
      ) : (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr><th>User</th><th>Type</th><th>Amount</th><th>Status</th><th>Date</th></tr>
            </thead>
            <tbody>
              {(data.payments || []).map((p) => (
                <tr key={p.id}>
                  <td>{p.user_name}</td>
                  <td><span className="tag">{p.payment_type}</span></td>
                  <td>₹{p.amount?.toLocaleString()}</td>
                  <td><span className="status-dot" style={{ background: statusColor[p.status] || "#64748b" }}>{p.status}</span></td>
                  <td>{p.created_at ? new Date(p.created_at).toLocaleDateString("en-IN") : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {!(data.payments || []).length && <div className="empty-msg">No payments found.</div>}
        </div>
      )}
    </div>
  );
}

// ── Tab: All Users ────────────────────────────────────────────
function UsersTab({ token }) {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiCall("/users/all", "GET", token);
      setUsers(res.users || []);
    } catch (e) {
      setErr(e.message);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { load(); }, [load]);

  const promote = async (id) => {
    if (!confirm("Promote this user to admin?")) return;
    try {
      await apiCall(`/users/${id}/promote`, "PATCH", token);
      setUsers((prev) => prev.map((u) => u.id === id ? { ...u, role: "admin" } : u));
    } catch (e) { alert(e.message); }
  };

  const ban = async (id, currentActive) => {
    const action = currentActive ? "ban" : "unban";
    if (!confirm(`${action} this user?`)) return;
    try {
      await apiCall(`/users/${id}/ban`, "PATCH", token);
      setUsers((prev) => prev.map((u) => u.id === id ? { ...u, is_active: !currentActive } : u));
    } catch (e) { alert(e.message); }
  };

  if (err) return <div className="error-msg">Error: {err}</div>;
  if (loading) return <div className="loading-msg">Loading users…</div>;

  return (
    <div className="table-wrap">
      <table className="data-table">
        <thead>
          <tr><th>Name</th><th>Contact</th><th>Role</th><th>Plan</th><th>Listings</th><th>Joined</th><th>Actions</th></tr>
        </thead>
        <tbody>
          {users.map((u) => (
            <tr key={u.id} style={{ opacity: u.is_active === false ? 0.5 : 1 }}>
              <td>{u.full_name}</td>
              <td><span className="small-text">{u.email || u.phone || "—"}</span></td>
              <td><span className={`role-badge role-${u.role}`}>{u.role}</span></td>
              <td>{u.plan_type}</td>
              <td>{u.listing_count}</td>
              <td>{u.created_at ? new Date(u.created_at).toLocaleDateString("en-IN") : "—"}</td>
              <td>
                <div className="action-cell">
                  {u.role !== "admin" && (
                    <button className="tbl-btn promote" onClick={() => promote(u.id)}>⬆ Promote</button>
                  )}
                  <button className={`tbl-btn ${u.is_active === false ? "unban" : "ban"}`} onClick={() => ban(u.id, u.is_active !== false)}>
                    {u.is_active === false ? "🔓 Unban" : "🚫 Ban"}
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {!users.length && <div className="empty-msg">No users found.</div>}
    </div>
  );
}

// ── Tab: Stats Dashboard ──────────────────────────────────────
function StatsTab({ token }) {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchStats() {
      try {
        const [usersRes, paymentsRes, pendingRes] = await Promise.all([
          apiCall("/users/all", "GET", token),
          apiCall("/payments/all", "GET", token),
          apiCall("/listings/?status=pending", "GET", token),
        ]);
        setStats({
          totalUsers: (usersRes.users || []).length,
          totalRevenue: paymentsRes.total_revenue || 0,
          pendingListings: Array.isArray(pendingRes) ? pendingRes.length : 0,
          totalPayments: (paymentsRes.payments || []).length,
        });
      } catch { /* ignore */ }
      finally { setLoading(false); }
    }
    fetchStats();
  }, [token]);

  if (loading) return <div className="loading-msg">Loading stats…</div>;
  if (!stats) return <div className="error-msg">Could not load stats.</div>;

  return (
    <div>
      <div className="stats-grid">
        <StatCard icon="👥" label="Total Users" value={stats.totalUsers} color="#10b981" />
        <StatCard icon="🏠" label="Pending Listings" value={stats.pendingListings} color="#f59e0b" />
        <StatCard icon="💸" label="Total Revenue" value={`₹${Number(stats.totalRevenue).toLocaleString()}`} color="#8b5cf6" />
        <StatCard icon="💳" label="Total Transactions" value={stats.totalPayments} color="#3b82f6" />
      </div>
      <div className="stats-note">
        <p>📊 Stats are pulled live from the database. Refresh the tab to update.</p>
      </div>
    </div>
  );
}

// ── Main Admin Page ───────────────────────────────────────────
export default function AdminPage() {
  const router = useRouter();
  // ── Isolated admin session — NO connection to regular user auth ──
  const [user, setUser]   = useState(null);
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("stats");
  const [pendingCount, setPendingCount] = useState(null);

  // Validate admin session on mount
  useEffect(() => {
    const storedToken = getAdminToken();
    if (!storedToken) {
      router.replace("/admin/login");
      return;
    }
    // Optimistic: show cached user while server validates
    const cached = getAdminUser();
    if (cached) setUser(cached);

    validateAdminToken(storedToken).then((freshUser) => {
      if (!freshUser) {
        clearAdminSession();
        router.replace("/admin/login");
        return;
      }
      setUser(freshUser);
      setToken(storedToken);
      setLoading(false);
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Fetch pending count for badge
  useEffect(() => {
    if (!token) return;
    apiCall("/listings/?status=pending", "GET", token)
      .then((d) => setPendingCount(Array.isArray(d) ? d.length : 0))
      .catch(() => {});
  }, [token]);

  const handleLogout = () => {
    clearAdminSession();   // clears ONLY admin session
    router.replace("/admin/login");
  };

  if (loading || !user) {
    return (
      <div className="admin-loading">
        <div className="spinner" />
        <p>Verifying admin access…</p>
      </div>
    );
  }

  const tabs = [
    { id: "stats", label: "📊 Dashboard" },
    { id: "pending", label: "🕐 Pending", badge: pendingCount },
    { id: "payments", label: "💳 Payments" },
    { id: "users", label: "👥 Users" },
  ];

  return (
    <div className="admin-wrap">
      {/* Sidebar */}
      <aside className="admin-sidebar">
        <div className="sidebar-logo">
          <span className="logo-icon">🏠</span>
          <div>
            <div className="logo-name">RoomSathi</div>
            <div className="logo-sub">Admin Console</div>
          </div>
        </div>
        <nav className="sidebar-nav">
          {tabs.map((t) => (
            <button
              key={t.id}
              className={`nav-item ${activeTab === t.id ? "active" : ""}`}
              onClick={() => setActiveTab(t.id)}
            >
              <span>{t.label}</span>
              {t.badge != null && t.badge > 0 && (
                <span className="nav-badge">{t.badge}</span>
              )}
            </button>
          ))}
        </nav>
        <div className="sidebar-user">
          <div className="su-avatar">{user.full_name?.[0]?.toUpperCase() || "A"}</div>
          <div style={{ flex: 1 }}>
            <div className="su-name">{user.full_name}</div>
            <div className="su-role">Administrator</div>
          </div>
          <button
            onClick={handleLogout}
            title="Logout"
            style={{
              background: "rgba(239,68,68,0.1)",
              border: "1px solid rgba(239,68,68,0.3)",
              borderRadius: "8px",
              color: "#ef4444",
              cursor: "pointer",
              padding: "6px 8px",
              display: "flex",
              alignItems: "center",
              fontSize: "0.8rem",
              flexShrink: 0,
              transition: "all 0.2s",
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = "#ef4444"; e.currentTarget.style.color = "#fff"; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = "rgba(239,68,68,0.1)"; e.currentTarget.style.color = "#ef4444"; }}
          >
            ⏏ Out
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="admin-main">
        <header className="admin-header">
          <div>
            <h1 className="page-title">
              {tabs.find((t) => t.id === activeTab)?.label}
            </h1>
            <p className="page-sub">RoomSathi Admin Panel · Manage your platform</p>
          </div>
        </header>

        <div className="admin-content">
          {activeTab === "stats" && <StatsTab token={token} />}
          {activeTab === "pending" && (
            <PendingTab token={token} onCountChange={setPendingCount} />
          )}
          {activeTab === "payments" && <PaymentsTab token={token} />}
          {activeTab === "users" && <UsersTab token={token} />}
        </div>
      </main>

      <style jsx global>{`
        * { box-sizing: border-box; margin: 0; padding: 0; }

        .admin-wrap {
          display: flex;
          min-height: 100vh;
          background: #0a0f1e;
          color: #e2e8f0;
          font-family: 'Inter', sans-serif;
        }

        /* ── Sidebar ── */
        .admin-sidebar {
          width: 260px;
          min-height: 100vh;
          background: #0d1426;
          border-right: 1px solid #1e293b;
          display: flex;
          flex-direction: column;
          padding: 24px 16px;
          position: sticky;
          top: 0;
          height: 100vh;
        }

        .sidebar-logo {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 12px;
          margin-bottom: 32px;
        }
        .logo-icon { font-size: 1.8rem; }
        .logo-name { font-size: 1.1rem; font-weight: 800; color: #fff; }
        .logo-sub { font-size: 0.7rem; color: #10b981; letter-spacing: 0.5px; text-transform: uppercase; }

        .sidebar-nav { flex: 1; display: flex; flex-direction: column; gap: 6px; }

        .nav-item {
          display: flex;
          align-items: center;
          justify-content: space-between;
          width: 100%;
          padding: 12px 16px;
          border-radius: 10px;
          border: 1px solid transparent;
          background: transparent;
          color: #94a3b8;
          font-size: 0.9rem;
          font-family: inherit;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s;
          text-align: left;
        }
        .nav-item:hover { color: #e2e8f0; background: #1e293b; }
        .nav-item.active {
          color: #10b981;
          background: rgba(16,185,129,0.1);
          border-color: rgba(16,185,129,0.3);
          font-weight: 600;
        }

        .nav-badge {
          background: #ef4444;
          color: #fff;
          font-size: 0.72rem;
          font-weight: 700;
          padding: 2px 7px;
          border-radius: 999px;
          min-width: 22px;
          text-align: center;
        }

        .sidebar-user {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 16px;
          margin-top: 24px;
          background: #1e293b;
          border-radius: 12px;
        }
        .su-avatar {
          width: 38px; height: 38px; border-radius: 50%;
          background: linear-gradient(135deg, #10b981, #059669);
          display: flex; align-items: center; justify-content: center;
          font-weight: 800; font-size: 1rem; color: #fff; flex-shrink: 0;
        }
        .su-name { font-size: 0.85rem; font-weight: 600; color: #fff; }
        .su-role { font-size: 0.72rem; color: #10b981; }

        /* ── Main ── */
        .admin-main { flex: 1; display: flex; flex-direction: column; min-height: 100vh; }

        .admin-header {
          padding: 28px 36px 20px;
          border-bottom: 1px solid #1e293b;
          background: #0d1426;
        }
        .page-title { font-size: 1.6rem; font-weight: 800; color: #fff; }
        .page-sub { font-size: 0.82rem; color: #64748b; margin-top: 4px; }

        .admin-content { padding: 32px 36px; flex: 1; overflow-y: auto; }

        /* ── Stats ── */
        .stats-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 20px;
          margin-bottom: 32px;
        }
        .stat-card {
          background: #0d1426;
          border: 1px solid;
          border-radius: 16px;
          padding: 24px;
          display: flex;
          align-items: center;
          gap: 18px;
          transition: transform 0.2s;
        }
        .stat-card:hover { transform: translateY(-2px); }
        .stat-icon {
          width: 52px; height: 52px; border-radius: 12px;
          display: flex; align-items: center; justify-content: center;
          font-size: 1.5rem; flex-shrink: 0;
        }
        .stat-value { font-size: 1.6rem; font-weight: 800; color: #fff; }
        .stat-label { font-size: 0.78rem; color: #64748b; margin-top: 4px; }
        .stats-note { color: #64748b; font-size: 0.82rem; margin-top: 8px; }

        /* ── Listing Cards ── */
        .cards-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
          gap: 20px;
        }
        .listing-card {
          background: #0d1426;
          border: 1px solid #1e293b;
          border-radius: 14px;
          padding: 20px;
          display: flex;
          flex-direction: column;
          gap: 12px;
          transition: border-color 0.2s;
        }
        .listing-card:hover { border-color: #334155; }
        .lc-header { display: flex; gap: 8px; }
        .lc-plan, .lc-type {
          font-size: 0.72rem; font-weight: 700; padding: 3px 10px;
          border-radius: 999px; text-transform: uppercase; letter-spacing: 0.5px;
        }
        .lc-plan { background: rgba(16,185,129,0.15); color: #10b981; }
        .lc-type { background: rgba(59,130,246,0.15); color: #60a5fa; }
        .lc-title { font-size: 0.95rem; font-weight: 700; color: #fff; line-height: 1.4; }
        .lc-meta { display: flex; gap: 16px; font-size: 0.8rem; color: #94a3b8; flex-wrap: wrap; }
        .lc-actions { display: flex; gap: 10px; margin-top: 4px; }

        .btn-approve, .btn-reject {
          flex: 1; padding: 10px; border: none; border-radius: 8px;
          font-family: inherit; font-weight: 700; font-size: 0.82rem;
          cursor: pointer; transition: all 0.2s;
        }
        .btn-approve { background: rgba(16,185,129,0.15); color: #10b981; border: 1px solid rgba(16,185,129,0.3); }
        .btn-approve:hover { background: #10b981; color: #000; }
        .btn-reject { background: rgba(239,68,68,0.1); color: #ef4444; border: 1px solid rgba(239,68,68,0.3); }
        .btn-reject:hover { background: #ef4444; color: #fff; }

        /* ── Payments ── */
        .payments-header {
          display: flex; align-items: center; justify-content: space-between;
          margin-bottom: 24px; flex-wrap: wrap; gap: 16px;
        }
        .revenue-badge {
          background: linear-gradient(135deg, rgba(139,92,246,0.2), rgba(139,92,246,0.05));
          border: 1px solid rgba(139,92,246,0.4);
          border-radius: 12px; padding: 14px 24px;
          display: flex; flex-direction: column; gap: 4px;
        }
        .revenue-badge span { font-size: 0.78rem; color: #a78bfa; }
        .revenue-badge strong { font-size: 1.5rem; color: #fff; font-weight: 800; }

        .filter-row { display: flex; gap: 8px; flex-wrap: wrap; }
        .filter-btn {
          padding: 8px 16px; border-radius: 8px; border: 1px solid #1e293b;
          background: transparent; color: #94a3b8; font-family: inherit;
          font-size: 0.82rem; cursor: pointer; transition: all 0.2s; text-transform: capitalize;
        }
        .filter-btn:hover { border-color: #10b981; color: #10b981; }
        .filter-btn.active { background: rgba(16,185,129,0.15); border-color: #10b981; color: #10b981; font-weight: 600; }

        /* ── Table ── */
        .table-wrap { overflow-x: auto; border-radius: 14px; border: 1px solid #1e293b; }
        .data-table { width: 100%; border-collapse: collapse; }
        .data-table th {
          background: #0d1426; padding: 14px 16px; text-align: left;
          font-size: 0.78rem; color: #64748b; text-transform: uppercase;
          letter-spacing: 0.5px; border-bottom: 1px solid #1e293b;
        }
        .data-table td { padding: 14px 16px; font-size: 0.85rem; border-bottom: 1px solid #1a2540; color: #e2e8f0; }
        .data-table tr:last-child td { border-bottom: none; }
        .data-table tr:hover td { background: #1e293b22; }

        .tag {
          background: #1e293b; color: #94a3b8;
          padding: 3px 8px; border-radius: 6px; font-size: 0.75rem;
        }
        .status-dot {
          padding: 3px 10px; border-radius: 999px; font-size: 0.75rem;
          font-weight: 700; color: #fff; text-transform: capitalize;
        }
        .role-badge {
          padding: 3px 10px; border-radius: 999px; font-size: 0.72rem; font-weight: 700;
        }
        .role-admin { background: rgba(16,185,129,0.15); color: #10b981; }
        .role-owner { background: rgba(59,130,246,0.15); color: #60a5fa; }
        .role-seeker { background: rgba(100,116,139,0.15); color: #94a3b8; }

        .small-text { font-size: 0.78rem; color: #64748b; }

        .action-cell { display: flex; gap: 8px; }
        .tbl-btn {
          padding: 6px 12px; border-radius: 6px; border: 1px solid transparent;
          font-family: inherit; font-size: 0.75rem; font-weight: 600; cursor: pointer; transition: all 0.2s;
        }
        .tbl-btn.promote { background: rgba(16,185,129,0.1); color: #10b981; border-color: rgba(16,185,129,0.3); }
        .tbl-btn.promote:hover { background: #10b981; color: #000; }
        .tbl-btn.ban { background: rgba(239,68,68,0.1); color: #ef4444; border-color: rgba(239,68,68,0.3); }
        .tbl-btn.ban:hover { background: #ef4444; color: #fff; }
        .tbl-btn.unban { background: rgba(59,130,246,0.1); color: #60a5fa; border-color: rgba(59,130,246,0.3); }
        .tbl-btn.unban:hover { background: #3b82f6; color: #fff; }

        /* ── States ── */
        .loading-msg, .empty-msg, .error-msg {
          padding: 60px; text-align: center; font-size: 0.9rem;
          color: #64748b; display: flex; align-items: center; justify-content: center;
        }
        .error-msg { color: #ef4444; }

        .admin-loading {
          min-height: 100vh; display: flex; flex-direction: column;
          align-items: center; justify-content: center;
          background: #0a0f1e; gap: 16px; color: #64748b;
        }
        .spinner {
          width: 40px; height: 40px; border: 3px solid #1e293b;
          border-top-color: #10b981; border-radius: 50%; animation: spin 0.8s linear infinite;
        }
        @keyframes spin { to { transform: rotate(360deg); } }

        @media (max-width: 768px) {
          .admin-sidebar { width: 220px; padding: 16px 12px; }
          .admin-content { padding: 20px 16px; }
          .admin-header { padding: 20px 16px; }
          .stats-grid { grid-template-columns: 1fr 1fr; }
          .payments-header { flex-direction: column; align-items: flex-start; }
        }
      `}</style>
    </div>
  );
}
