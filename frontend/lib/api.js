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
  const API_BASE = process.env.NEXT_PUBLIC_FASTAPI_URL || "http://localhost:8000";
  const headers = {};
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  const response = await fetch(`${API_BASE}/listings/upload-photos`, {
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
