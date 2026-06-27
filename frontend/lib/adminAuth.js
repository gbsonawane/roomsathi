/**
 * Admin Auth Utilities
 *
 * Completely isolated from the regular user auth (lib/auth.js).
 * Uses separate localStorage keys so admin and user sessions never mix.
 */

const ADMIN_TOKEN_KEY = "rs_admin_token";
const ADMIN_USER_KEY  = "rs_admin_user";

const API = process.env.NEXT_PUBLIC_API_URL ||
            process.env.NEXT_PUBLIC_FASTAPI_URL ||
            "http://localhost:8000";

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
export async function adminLogin(email) {
  const res = await fetch(`${API}/auth/dev-login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      phone: email,          // backend accepts email in the phone field
      otp: "000000",
      full_name: email.split("@")[0],
    }),
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
