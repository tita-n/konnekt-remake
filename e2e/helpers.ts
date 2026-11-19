import { expect, type Cookie, type Page } from "@playwright/test";

const sessionCache = new Map<string, Cookie[]>();

export const DEMO_PASSWORD = "KonnektDemo123!";

/** Log in through the real UI, waiting for the post-login destination. */
export async function login(page: Page, identifier: string, password = DEMO_PASSWORD): Promise<void> {
  await page.goto("/login", { waitUntil: "networkidle" });
  await page.getByLabel("Email or username").fill(identifier);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Log in" }).click();
  await page.waitForURL((url) => !url.pathname.startsWith("/login"), { timeout: 20_000 });
  await expect(page.locator("body")).not.toContainText("That email/username and password don't match");
}

/** Sign in once per role and reuse the cookie state for a whole spec. */
export async function loginAs(page: Page, role: "student" | "admin" | "reviewer" | "platform"): Promise<void> {
  const identifiers = {
    student: "student@nova.edu.ng",
    admin: "admin@nova.edu.ng",
    reviewer: "reviewer@nova.edu.ng",
    platform: "admin@konnekt.ng",
  } as const;
  const cached = sessionCache.get(role);
  if (cached) {
    await page.context().addCookies(cached);
    await page.goto("/pulse", { waitUntil: "networkidle" });
    return;
  }
  await login(page, identifiers[role]);
  sessionCache.set(role, await page.context().cookies());
}
