/**
 * Phase 2 Item 9 — Token expiry / 401 handling in apiFetch.
 * @jest-environment node
 */

function installBrowserGlobals(pathname = "/home") {
  const store = new Map();
  global.window = {
    location: { href: "", pathname },
  };
  global.localStorage = {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: (k) => store.delete(k),
    clear: () => store.clear(),
  };
}

describe("apiFetch 401 session handling", () => {
  let apiFetch;

  beforeEach(async () => {
    jest.resetModules();
    process.env.NEXT_PUBLIC_FASTAPI_URL = "http://api.test";
    installBrowserGlobals("/home");
    global.fetch = jest.fn();
    ({ apiFetch } = await import("../lib/api.js"));
  });

  test("9.1 expired token triggers redirect to /login", async () => {
    localStorage.setItem("roomsathi_access_token", "expired-jwt");
    localStorage.setItem("roomsathi_user", JSON.stringify({ id: "1" }));
    global.fetch.mockResolvedValue({ status: 401, ok: false });

    await expect(
      apiFetch("/users/me", {
        headers: { Authorization: "Bearer expired-jwt" },
      })
    ).rejects.toThrow("Session expired");

    expect(window.location.href).toContain("/login?reason=session_expired");
    expect(window.location.href).toContain("next=");
  });

  test("9.2 localStorage cleared on 401", async () => {
    localStorage.setItem("roomsathi_access_token", "expired-jwt");
    localStorage.setItem("roomsathi_user", JSON.stringify({ id: "1" }));
    global.fetch.mockResolvedValue({ status: 401, ok: false });

    try {
      await apiFetch("/users/me", {
        headers: { Authorization: "Bearer expired-jwt" },
      });
    } catch (_) {}

    expect(localStorage.getItem("roomsathi_access_token")).toBeNull();
    expect(localStorage.getItem("roomsathi_user")).toBeNull();
  });

  test("9.3 redirect includes session_expired reason for login message", async () => {
    localStorage.setItem("roomsathi_access_token", "expired-jwt");
    global.fetch.mockResolvedValue({ status: 401, ok: false });

    try {
      await apiFetch("/users/me", {
        headers: { Authorization: "Bearer expired-jwt" },
      });
    } catch (_) {}

    expect(window.location.href).toContain("reason=session_expired");
  });

  test("9.4 does not logout on 403 or 404", async () => {
    localStorage.setItem("roomsathi_access_token", "valid-jwt");
    localStorage.setItem("roomsathi_user", JSON.stringify({ id: "1" }));

    global.fetch.mockResolvedValue({ status: 403, ok: false });
    const res403 = await apiFetch("/users/me", {
      headers: { Authorization: "Bearer valid-jwt" },
    });
    expect(res403.status).toBe(403);
    expect(localStorage.getItem("roomsathi_access_token")).toBe("valid-jwt");
    expect(window.location.href).toBe("");

    global.fetch.mockResolvedValue({ status: 404, ok: false });
    const res404 = await apiFetch("/listings/missing", {
      headers: { Authorization: "Bearer valid-jwt" },
    });
    expect(res404.status).toBe(404);
    expect(localStorage.getItem("roomsathi_access_token")).toBe("valid-jwt");
  });

  test("9.5 logic lives in central apiFetch only", () => {
    const fs = require("fs");
    const path = require("path");
    const apiSrc = fs.readFileSync(
      path.join(__dirname, "../lib/api.js"),
      "utf8"
    );
    expect(apiSrc).toContain("res.status === 401");
    expect(apiSrc).toContain("session_expired");

    const libDir = path.join(__dirname, "../lib");
    const offenders = fs
      .readdirSync(libDir)
      .filter((f) => f.endsWith(".js") && f !== "api.js")
      .filter((f) => {
        const text = fs.readFileSync(path.join(libDir, f), "utf8");
        return (
          text.includes("session_expired") ||
          (text.includes("status === 401") &&
            text.includes("removeItem") &&
            text.includes("roomsathi_access_token"))
        );
      });
    expect(offenders).toEqual([]);
  });

  test("9.6 no redirect when 401 without Authorization header", async () => {
    installBrowserGlobals("/login");
    jest.resetModules();
    process.env.NEXT_PUBLIC_FASTAPI_URL = "http://api.test";
    global.fetch = jest.fn().mockResolvedValue({ status: 401, ok: false });
    ({ apiFetch } = await import("../lib/api.js"));

    localStorage.setItem("roomsathi_access_token", "expired-jwt");
    const res = await apiFetch("/auth/send-otp", { method: "POST" });
    expect(res.status).toBe(401);
    expect(localStorage.getItem("roomsathi_access_token")).toBe("expired-jwt");
    expect(window.location.href).toBe("");
  });
});

describe("login page session expired message", () => {
  test("9.3b login.js shows session expired copy when reason query set", () => {
    const fs = require("fs");
    const path = require("path");
    const loginSrc = fs.readFileSync(
      path.join(__dirname, "../pages/login.js"),
      "utf8"
    );
    expect(loginSrc).toContain('reason === "session_expired"');
    expect(loginSrc.toLowerCase()).toMatch(/session expired/);
  });
});
