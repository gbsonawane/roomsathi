import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { useAuth } from "../context/AuthContext";
import {
  getNotifications,
  markNotificationRead,
  markAllNotificationsRead,
} from "../lib/api";
import { SkeletonNotificationRow } from "../components/Skeleton";

function getRelativeTime(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days === 1) return "yesterday";
  return `${days}d ago`;
}

export default function NotificationsPage() {
  const router = useRouter();
  const { user, token, loading: authLoading } = useAuth();
  const [tab, setTab] = useState("all"); // all | unread
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [markingAll, setMarkingAll] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) {
      router.replace("/login");
    }
  }, [user, authLoading, router]);

  const fetchData = async () => {
    if (!token) return;
    setLoading(true);
    setError("");
    try {
      const data = await getNotifications(token, tab === "unread");
      setNotifications(Array.isArray(data) ? data : data?.items || []);
    } catch (err) {
      setError(err.message || "Failed to load. Try again.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user && token) {
      fetchData();
    }
  }, [user, token, tab]);

  const handleMarkRead = async (id) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, is_read: true } : n))
    );
    try {
      await markNotificationRead(id, token);
    } catch {
      fetchData();
    }
  };

  const handleMarkAllRead = async () => {
    setMarkingAll(true);
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
    try {
      await markAllNotificationsRead(token);
      if (tab === "unread") {
        setNotifications([]);
      }
    } catch {
      fetchData();
    } finally {
      setMarkingAll(false);
    }
  };

  if (authLoading || !user) {
    return (
      <div style={{ textAlign: "center", padding: "48px 0" }}>
        <h2>Loading...</h2>
      </div>
    );
  }

  const unreadCount = notifications.filter((n) => !n.is_read).length;
  const allRead = unreadCount === 0;

  return (
    <div className="notifications-page">
      <div className="notifications-header">
        <h1 className="page-title" style={{ margin: 0 }}>
          Notifications
        </h1>
        <button
          type="button"
          className="outline"
          onClick={handleMarkAllRead}
          disabled={allRead || markingAll || loading}
          style={{
            opacity: allRead ? 0.45 : 1,
            fontSize: "0.85rem",
            padding: "8px 16px",
          }}
        >
          {markingAll ? "Marking..." : "Mark all read"}
        </button>
      </div>

      <div className="notifications-tabs">
        <button
          type="button"
          className={`notif-tab ${tab === "all" ? "active" : ""}`}
          onClick={() => setTab("all")}
        >
          All
        </button>
        <button
          type="button"
          className={`notif-tab ${tab === "unread" ? "active" : ""}`}
          onClick={() => setTab("unread")}
        >
          Unread only
        </button>
      </div>

      <div className="card notifications-list" style={{ padding: 0, overflow: "hidden" }}>
        {loading ? (
          <>
            <SkeletonNotificationRow />
            <SkeletonNotificationRow />
            <SkeletonNotificationRow />
            <SkeletonNotificationRow />
          </>
        ) : error ? (
          <div style={{ padding: "40px 24px", textAlign: "center" }}>
            <p style={{ color: "#dc2626", margin: "0 0 12px" }}>
              Failed to load. Try again.
            </p>
            <button type="button" className="primary" onClick={fetchData}>
              Retry
            </button>
          </div>
        ) : notifications.length === 0 ? (
          <div style={{ padding: "48px 24px", textAlign: "center", color: "#6b7280" }}>
            {tab === "unread"
              ? "No unread notifications"
              : "You're all caught up! 🎉"}
          </div>
        ) : (
          notifications.map((n) => (
            <button
              key={n.id}
              type="button"
              onClick={() => !n.is_read && handleMarkRead(n.id)}
              className={`notification-row ${n.is_read ? "read" : "unread"}`}
            >
              <div className="notification-row-main">
                <strong className="notification-title">{n.title}</strong>
                {n.body && <p className="notification-body">{n.body}</p>}
              </div>
              <span className="notification-time">
                {getRelativeTime(n.created_at)}
              </span>
            </button>
          ))
        )}
      </div>

      <style jsx>{`
        .notifications-page {
          max-width: 720px;
          margin: 0 auto;
        }
        .notifications-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
          margin-bottom: 20px;
        }
        .notifications-tabs {
          display: flex;
          gap: 8px;
          margin-bottom: 16px;
          border-bottom: 1px solid #e5e7eb;
          padding-bottom: 8px;
        }
        .notif-tab {
          background: transparent;
          border: none;
          padding: 8px 16px;
          font-weight: 600;
          font-size: 0.95rem;
          color: #6b7280;
          cursor: pointer;
          border-radius: 999px;
        }
        .notif-tab:hover {
          background: #f3f4f6;
          color: #111827;
        }
        .notif-tab.active {
          background: #065f46;
          color: white;
        }
        .notification-row {
          width: 100%;
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 16px;
          padding: 14px 16px;
          border: none;
          border-bottom: 1px solid #f3f4f6;
          background: white;
          text-align: left;
          cursor: pointer;
          font: inherit;
        }
        .notification-row.unread {
          border-left: 3px solid #065f46;
          background: #f0fdf4;
        }
        .notification-row.read {
          border-left: 3px solid transparent;
          background: white;
        }
        .notification-row:hover {
          filter: brightness(0.98);
        }
        .notification-row-main {
          flex: 1;
          min-width: 0;
        }
        .notification-title {
          display: block;
          color: #111827;
          font-size: 0.95rem;
          margin-bottom: 4px;
        }
        .notification-body {
          margin: 0;
          color: #6b7280;
          font-size: 0.875rem;
          line-height: 1.4;
        }
        .notification-time {
          flex-shrink: 0;
          color: #9ca3af;
          font-size: 0.8rem;
          white-space: nowrap;
        }
      `}</style>
    </div>
  );
}
