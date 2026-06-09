const API_BASE = process.env.NEXT_PUBLIC_FASTAPI_URL || "http://localhost:8000";

async function request(path, { method = "GET", body, token } = {}) {
  const headers = {};
  if (body) {
    headers["Content-Type"] = "application/json";
  }
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE}${path}`, {
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

export async function getMe(token) {
  return request("/users/me", { token });
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
