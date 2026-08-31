const { test, expect } = require("@playwright/test");
const path = require("path");

const FIXTURE = "file://" + path.resolve(__dirname, "fixtures/ux-polish.html").replace(/\\/g, "/");

test.describe("Phase 3 Item 10 — Notification bell", () => {
  test("10.1 bell renders when logged in", async ({ page }) => {
    await page.setViewportSize({ width: 1200, height: 800 });
    await page.goto(FIXTURE);
    await page.evaluate(() => window.__setLoggedIn(true));
    await expect(page.locator("#desktop-bell")).toBeVisible();
  });

  test("10.2 unread count badge shows 3", async ({ page }) => {
    await page.setViewportSize({ width: 1200, height: 800 });
    await page.goto(FIXTURE);
    await page.evaluate(() => window.__setUnread(3));
    await expect(page.locator("#desktop-badge")).toBeVisible();
    await expect(page.locator("#desktop-badge")).toHaveText("3");
  });

  test("10.3 badge clears when unread is 0", async ({ page }) => {
    await page.setViewportSize({ width: 1200, height: 800 });
    await page.goto(FIXTURE);
    await page.evaluate(() => window.__setUnread(0));
    await expect(page.locator("#desktop-badge")).toBeHidden();
  });

  test("10.4 notifications page lists all newest-style rows", async ({ page }) => {
    await page.goto(FIXTURE);
    await page.evaluate(() =>
      window.__setNotifications([
        { title: "First", body: "a", is_read: false },
        { title: "Second", body: "b", is_read: true },
      ])
    );
    await expect(page.locator("#notifications-view h1")).toHaveText("Notifications");
    await expect(page.locator(".notification-row")).toHaveCount(2);
  });

  test("10.5 empty state", async ({ page }) => {
    await page.goto(FIXTURE);
    await page.evaluate(() => window.__setNotifications([]));
    await expect(page.locator("#notif-empty")).toBeVisible();
    await expect(page.locator("#notif-empty")).toContainText("caught up");
  });

  test("10.6 logged-out hides bell", async ({ page }) => {
    await page.setViewportSize({ width: 1200, height: 800 });
    await page.goto(FIXTURE);
    await page.evaluate(() => window.__setLoggedIn(false));
    await expect(page.locator("#desktop-bell")).toBeHidden();
  });

  test("10.7 polling update without reload", async ({ page }) => {
    await page.setViewportSize({ width: 1200, height: 800 });
    await page.goto(FIXTURE);
    await page.evaluate(() => window.__setUnread(1));
    await expect(page.locator("#desktop-badge")).toHaveText("1");
    await page.evaluate(() => window.__setUnread(4));
    await expect(page.locator("#desktop-badge")).toHaveText("4");
  });
});

test.describe("Phase 3 Item 11 — Loading skeletons & empty/error", () => {
  test("11.1 skeleton shows during fetch", async ({ page }) => {
    await page.goto(FIXTURE);
    await page.evaluate(() => window.__showState("loading"));
    await expect(page.locator("#loading-view .skeleton-shimmer").first()).toBeVisible();
  });

  test("11.2 skeleton replaced by content", async ({ page }) => {
    await page.goto(FIXTURE);
    await page.evaluate(() => window.__showState("loading"));
    await page.evaluate(() => window.__showState("content"));
    await expect(page.locator("#loading-view")).toBeHidden();
    await expect(page.locator("#content-view")).toBeVisible();
    await expect(page.locator("#content-view article")).toHaveCount(2);
  });

  test("11.3 empty state for no listings", async ({ page }) => {
    await page.goto(FIXTURE);
    await page.evaluate(() => window.__showState("empty"));
    await expect(page.locator("#empty-view")).toContainText("No listings found");
  });

  test("11.5 error state distinct from empty", async ({ page }) => {
    await page.goto(FIXTURE);
    await page.evaluate(() => window.__showState("error"));
    await expect(page.locator("#error-view")).toContainText("Failed to load");
    await expect(page.locator("#retry")).toBeVisible();
    await expect(page.locator("#empty-view")).toBeHidden();
  });
});

test.describe("Phase 3 Item 12 — Mobile hamburger nav", () => {
  test("12.1 hamburger appears below 768px", async ({ page }) => {
    await page.setViewportSize({ width: 767, height: 800 });
    await page.goto(FIXTURE);
    await expect(page.locator("#hamburger")).toBeVisible();
    await expect(page.locator("#desktop-nav")).toBeHidden();
  });

  test("12.2 full nav above breakpoint", async ({ page }) => {
    await page.setViewportSize({ width: 769, height: 800 });
    await page.goto(FIXTURE);
    await expect(page.locator("#desktop-nav")).toBeVisible();
    await expect(page.locator("#hamburger")).toBeHidden();
  });

  test("12.3 menu opens and closes", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 800 });
    await page.goto(FIXTURE);
    await page.click("#hamburger");
    await expect(page.locator("#mobile-menu")).toHaveClass(/open/);
    await expect(page.locator("#hamburger")).toHaveAttribute("aria-expanded", "true");
    await page.click("#hamburger");
    await expect(page.locator("#mobile-menu")).not.toHaveClass(/open/);
  });

  test("12.4 mobile menu has same core links", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 800 });
    await page.goto(FIXTURE);
    await page.click("#hamburger");
    await expect(page.locator("#mobile-menu a[href='/search']")).toBeVisible();
    await expect(page.locator("#mobile-menu a[href='/create-listing']")).toBeVisible();
    await expect(page.locator("#mobile-menu a[href='/notifications']")).toBeVisible();
    await expect(page.locator("#mobile-menu a[href='/profile']")).toBeVisible();
  });

  test("12.5 menu closes on navigation click", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 800 });
    await page.goto(FIXTURE);
    await page.click("#hamburger");
    await page.click("#mobile-menu a[href='/search']");
    await expect(page.locator("#mobile-menu")).not.toHaveClass(/open/);
  });

  test("12.6 no horizontal overflow at phone widths", async ({ page }) => {
    for (const width of [320, 375, 414]) {
      await page.setViewportSize({ width, height: 800 });
      await page.goto(FIXTURE);
      const overflow = await page.evaluate(() => {
        return document.documentElement.scrollWidth > document.documentElement.clientWidth;
      });
      expect(overflow).toBe(false);
    }
  });

  test("12.7 accessible hamburger attributes", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 800 });
    await page.goto(FIXTURE);
    const btn = page.locator("#hamburger");
    await expect(btn).toHaveAttribute("aria-label", /menu/i);
    await expect(btn).toHaveAttribute("aria-expanded", "false");
    await btn.click();
    await expect(btn).toHaveAttribute("aria-expanded", "true");
  });
});
