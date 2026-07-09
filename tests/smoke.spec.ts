/**
 * Smoke test: all 5 main tabs must render without triggering the ErrorBoundary.
 *
 * The Cases tab once crashed for every user due to a hook-ordering bug
 * (refetch referenced before it was declared). This test catches that class
 * of regression automatically by:
 *   1. Registering a fresh account via the API (no seeded data)
 *   2. Injecting the auth token into localStorage so the app boots logged in
 *   3. Hard-asserting the authenticated tab bar is visible before proceeding
 *   4. Navigating through all 5 bottom tabs (each click is mandatory)
 *   5. Asserting the ErrorBoundary fallback never appears on any tab
 *
 * Run:  npm run test:smoke
 * Requires the app server to be running on http://localhost:5000
 */

import { test, expect, Page } from "@playwright/test";

const BASE_URL = process.env.TEST_BASE_URL || "http://localhost:5000";
const CRASH_STRINGS = ["Something went wrong", "Please reload the app"];

type AuthResult = {
  access_token: string;
  user: { id: string; name: string; email: string };
};

async function registerViaApi(email: string): Promise<AuthResult> {
  const res = await fetch(`${BASE_URL}/api/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: "Smoke Test", email, password: "SmokeTest123!" }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Registration failed (${res.status}): ${body}`);
  }
  return res.json();
}

async function seedAuthIntoLocalStorage(page: Page, auth: AuthResult) {
  await page.addInitScript(
    ({ token, user }) => {
      window.localStorage.setItem("token", token);
      window.localStorage.setItem("user", JSON.stringify(user));
      window.localStorage.setItem("auth_method", "email");
    },
    { token: auth.access_token, user: auth.user }
  );
}

async function assertNoCrash(page: Page, tabName: string) {
  for (const text of CRASH_STRINGS) {
    const count = await page.getByText(text, { exact: false }).count();
    expect(
      count,
      `ErrorBoundary crash detected on "${tabName}" tab — "${text}" found on screen`
    ).toBe(0);
  }
}

test("all 5 main tabs load without crashing", async ({ page }) => {
  const email = `smoke_${Date.now()}@ermate-test.com`;
  const auth = await registerViaApi(email);

  await seedAuthIntoLocalStorage(page, auth);

  await page.goto("/", { waitUntil: "domcontentloaded" });

  // Hard-assert the authenticated tab bar is present before proceeding.
  // If auth injection failed or the app is still on the login screen this
  // assertion will fail immediately — no silent skip, no false positive.
  const dashboardTab = page.getByText("Dashboard").last();
  await expect(dashboardTab).toBeVisible({ timeout: 20_000 });

  const tabs = ["Dashboard", "Cases", "Learn", "Logs", "Profile"];

  for (const tabName of tabs) {
    // Each tab button must be present and clickable — no conditional skip.
    const tabButton = page.getByText(tabName).last();
    await expect(tabButton).toBeVisible({
      timeout: 5_000,
    });
    await tabButton.click();

    // Wait for the tab content to settle, then assert no crash.
    await page.waitForTimeout(2_500);
    await assertNoCrash(page, tabName);
  }
});
