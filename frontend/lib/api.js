const API_BASE = process.env.NEXT_PUBLIC_FASTAPI_URL || "";

function warnMissingApiBase() {
  const msg =
    "[RoomSathi] NEXT_PUBLIC_FASTAPI_URL is not set. " +
    "API calls will fail. Set it in .env / Vercel env (e.g. https://your-api.up.railway.app).";
  console.error(msg);
  if (typeof window !== "undefined" && typeof document !== "undefined") {
    if (!document.getElementById("roomsathi-api-url-banner")) {
      const banner = document.createElement("div");
      banner.id = "roomsathi-api-url-banner";
      banner.setAttribute("role", "alert");
      banner.style.cssText =
        "position:fixed;bottom:0;left:0;right:0;z-index:99999;" +
        "background:#7f1d1d;color:#fff;padding:12px 16px;font:14px/1.4 system-ui,sans-serif;" +
        "text-align:center;box-shadow:0 -4px 20px rgba(0,0,0,.25)";
      banner.textContent =
        "RoomSathi misconfigured: NEXT_PUBLIC_FASTAPI_URL is missing. Contact the site admin.";
      const mount = () => {
        if (document.body && !document.getElementById("roomsathi-api-url-banner")) {
          document.body.appendChild(banner);
        }
      };
      if (document.body) mount();
      else document.addEventListener("DOMContentLoaded", mount);
    }
  }
}

if (!API_BASE) {
  warnMissingApiBase();
}

export async function apiFetch(url, options = {}) {
  if (!API_BASE && !String(url).startsWith("http")) {
    warnMissingApiBase();
    throw new Error(
      "NEXT_PUBLIC_FASTAPI_URL is not configured — refusing to call a localhost fallback"
    );
  }
  const fullUrl = String(url).startsWith("http") ? url : `${API_BASE}${url}`;
  const res = await fetch(fullUrl, options);

  if (res.status === 401) {
    const headers = options.headers || {};
    const hadAuth = Boolean(headers.Authorization || headers.authorization);
    if (hadAuth && typeof window !== "undefined") {
      localStorage.removeItem("roomsathi_access_token");
      localStorage.removeItem("roomsathi_user");
      const currentPath = encodeURIComponent(window.location.pathname);
      window.location.href = `/login?reason=session_expired&next=${currentPath}`;
      throw new Error("Session expired");
    }
  }

  return res;
}

async function request(path, { method = "GET", body, token } = {}) {
  const headers = {};
  if (body) {
    headers["Content-Type"] = "application/json";
  }
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const response = await apiFetch(`${API_BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  const text = await response.text();
  const json = text ? JSON.parse(text) : null;

  if (!response.ok) {
    const message = json?.detail || json?.message || response.statusText;
    throw new Error(message || "API request failed");
  }

  return json;
}

export async function sendOtp(phone) {
  return request("/auth/send-otp", { method: "POST", body: { phone } });
}

export async function verifyOtp(phone, otp, full_name) {
  return request("/auth/verify-otp", {
    method: "POST",
    body: { phone, otp, full_name },
  });
}

export async function devLogin(phone, full_name) {
  return request("/auth/dev-login", {
    method: "POST",
    body: { phone, otp: "000000", full_name },
  });
}

export async function googleLogin(idToken) {
  return request("/auth/google", {
    method: "POST",
    body: { token: idToken },
  });
}

export async function getMe(token) {
  return request("/users/me", { token });
}

export async function updateMe(data, token) {
  return request("/users/me", { method: "PATCH", body: data, token });
}

export async function getListings(query = {}) {
  const params = new URLSearchParams();
  Object.entries(query).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      params.append(key, value);
    }
  });
  return request(`/listings?${params.toString()}`);
}

export async function getListing(listingId, token) {
  return request(`/listings/${listingId}`, { token });
}

export async function createListing(data, token) {
  return request("/listings", { method: "POST", body: data, token });
}

export async function uploadPhotos(files, token) {
  const formData = new FormData();
  for (let i = 0; i < files.length; i++) {
    formData.append("files", files[i]);
  }
  const headers = {};
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  const response = await apiFetch(`${API_BASE}/listings/upload-photos`, {
    method: "POST",
    headers,
    body: formData,
  });
  if (!response.ok) {
    const text = await response.text();
    const json = text ? JSON.parse(text) : null;
    const message = json?.detail || json?.message || response.statusText;
    throw new Error(message || "Photo upload failed");
  }
  return response.json();
}

export async function createPlanOrder(planType, token) {
  return request("/payments/order", {
    method: "POST",
    body: { plan_type: planType },
    token,
  });
}

export async function getPayments(token) {
  return request("/payments", { token });
}

export async function saveListing(listingId, token) {
  return request("/saved", {
    method: "POST",
    body: { listing_id: listingId },
    token,
  });
}

export async function unsaveListing(listingId, token) {
  return request(`/saved/${listingId}`, { method: "DELETE", token });
}

export async function getSavedListings(token) {
  return request("/saved", { token });
}

export async function getOwnerListings(token) {
  return request("/listings?owner=me", { token });
}

export async function unlockContact(listingId, unlockType, token) {
  return request("/unlock", {
    method: "POST",
    body: { listing_id: listingId, unlock_type: unlockType },
    token,
  });
}

export async function confirmUnlock(payload, token) {
  return request("/unlock/confirm", {
    method: "POST",
    body: payload,
    token,
  });
}

export async function boostListing(listingId, boostDays, token) {
  return request("/boost", {
    method: "POST",
    body: { listing_id: listingId, boost_days: boostDays },
    token,
  });
}

export async function confirmBoost(payload, token) {
  return request("/boost/confirm", {
    method: "POST",
    body: payload,
    token,
  });
}

export async function generateDescription(data, token) {
  return request("/listings/generate-description", {
    method: "POST",
    body: data,
    token,
  });
}

export async function generateTitle(data, token) {
  return request("/listings/generate-title", {
    method: "POST",
    body: data,
    token,
  });
}

export async function scoreDescription(data, token) {
  return request("/listings/score-description", {
    method: "POST",
    body: data,
    token,
  });
}

export async function parseSearchQuery(query, token) {
  try {
    return await request("/listings/parse-search", {
      method: "POST",
      body: { query },
      token,
    });
  } catch (err) {
    return {};
  }
}

export async function chatWithAssistant(listingId, messages, listingContext, token) {
  return request(`/listings/${listingId}/chat`, {
    method: "POST",
    body: { messages, listing_context: listingContext },
    token,
  });
}

export async function getNotifications(token, unreadOnly = false) {
  const qs = unreadOnly ? "?unread_only=true" : "";
  return request(`/notifications${qs}`, { token });
}

export async function markNotificationRead(id, token) {
  return request(`/notifications/${id}/read`, { method: "PATCH", token });
}

export async function markAllNotificationsRead(token) {
  return request("/notifications/read-all", { method: "PATCH", token });
}
