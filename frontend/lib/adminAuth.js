/**
 * Admin Auth Utilities
 *
 * Completely isolated from the regular user auth (lib/auth.js).
 * Uses separate localStorage keys so admin and user sessions never mix.
 */

const ADMIN_TOKEN_KEY = "rs_admin_token";
const ADMIN_USER_KEY  = "rs_admin_user";

const API = process.env.NEXT_PUBLIC_API_URL || process.env.NEXT_PUBLIC_FASTAPI_URL || "";

if (!API) {
  const msg =
    "[RoomSathi Admin] NEXT_PUBLIC_FASTAPI_URL (or NEXT_PUBLIC_API_URL) is not set. " +
    "Refusing to fall back to localhost.";
  console.error(msg);
  if (typeof window !== "undefined" && typeof document !== "undefined") {
    if (!document.getElementById("roomsathi-admin-api-url-banner")) {
      const banner = document.createElement("div");
      banner.id = "roomsathi-admin-api-url-banner";
      banner.setAttribute("role", "alert");
      banner.style.cssText =
        "position:fixed;bottom:0;left:0;right:0;z-index:99999;" +
        "background:#7f1d1d;color:#fff;padding:12px 16px;font:14px/1.4 system-ui,sans-serif;" +
        "text-align:center";
      banner.textContent = "Admin misconfigured: backend URL env var is missing.";
      const mount = () => {
        if (document.body && !document.getElementById("roomsathi-admin-api-url-banner")) {
          document.body.appendChild(banner);
        }
      };
      if (document.body) mount();
      else document.addEventListener("DOMContentLoaded", mount);
    }
  }
}

/* ── Storage helpers ─────────────────────────────────────────── */

export function getAdminToken() {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(ADMIN_TOKEN_KEY);
}

export function getAdminUser() {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(ADMIN_USER_KEY);
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return null; }
}

export function setAdminSession(token, user) {
  if (typeof window === "undefined") return;
  localStorage.setItem(ADMIN_TOKEN_KEY, token);
  localStorage.setItem(ADMIN_USER_KEY, JSON.stringify(user));
}

export function clearAdminSession() {
  if (typeof window === "undefined") return;
  localStorage.removeItem(ADMIN_TOKEN_KEY);
  localStorage.removeItem(ADMIN_USER_KEY);
}

/* ── Server validation ───────────────────────────────────────── */

/**
 * Validate the stored admin token against the server.
 * Returns the fresh user object if valid + admin role, otherwise null.
 */
export async function validateAdminToken(token) {
  if (!token) return null;
  try {
    const res = await fetch(`${API}/users/me`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return null;
    const user = await res.json();
    if (user.role !== "admin") return null;
    return user;
  } catch {
    return null;
  }
}

/**
 * Login via /auth/dev-login, verify admin role, store admin session.
 * Throws a string message on failure.
 */
export async function adminLogin(email, password) {
  const res = await fetch(`${API}/auth/admin-login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data.detail || "Authentication failed");

  const { access_token, user } = data;
  if (!user || user.role !== "admin") {
    throw new Error("Access denied — this account does not have admin privileges.");
  }

  setAdminSession(access_token, user);
  return { access_token, user };
}
