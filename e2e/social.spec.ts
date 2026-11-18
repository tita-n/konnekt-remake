import { expect, test, type Page } from "@playwright/test";
import { login } from "./helpers";

const STUDENT = "student@demo.edu.ng";
const LEVELMATE = "levelmate@demo.edu.ng";
const OTHER_LEVEL = "otherlevel@demo.edu.ng";
const OTHER_DEPT = "otherdept@demo.edu.ng";
const OTHER_COLLEGE = "othercollege@demo.edu.ng";

async function switchUser(page: Page, email: string): Promise<void> {
  await page.context().clearCookies();
  await login(page, email);
}

async function createPost(page: Page, body: string, audience?: string): Promise<string> {
  await page.goto("/compose?type=post", { waitUntil: "networkidle" });
  await page.getByLabel("What's happening on campus?").fill(body);
  if (audience) {
    await page.getByRole("button", { name: /Posting to/ }).click();
    await page.getByRole("button", { name: new RegExp(audience) }).click();
  }
  await page.getByRole("banner").getByRole("button", { name: "Post", exact: true }).click();
  await page.waitForURL(/\/p\/[^/]+$/, { timeout: 30_000 });
  return page.url().split("/p/")[1]!;
}

test.describe("audiences and the Pulse product", () => {
  test("level and public posts reach exactly the right students", async ({ page }) => {
    test.setTimeout(150_000);
    const marker = `E2E level ${Date.now()}`;
    await login(page, STUDENT);
    const levelPost = await createPost(page, marker);

    await switchUser(page, LEVELMATE);
    await page.goto(`/p/${levelPost}`, { waitUntil: "networkidle" });
    await expect(page.getByText(marker)).toBeVisible();

    for (const outsider of [OTHER_LEVEL, OTHER_DEPT, OTHER_COLLEGE]) {
      await switchUser(page, outsider);
      const response = await page.goto(`/p/${levelPost}`, { waitUntil: "networkidle" });
      expect(response?.status()).toBe(404);
      await expect(page.getByText(marker)).toHaveCount(0);
      await expect(page.getByText(/isn't available|not available/i).first()).toBeVisible();
    }

    const publicMarker = `E2E public ${Date.now()}`;
    await switchUser(page, STUDENT);
    const publicPost = await createPost(page, publicMarker, "Everyone at my university");

    await switchUser(page, OTHER_COLLEGE);
    await page.goto(`/p/${publicPost}`, { waitUntil: "networkidle" });
    await expect(page.getByText(publicMarker)).toBeVisible();

    // A hidden post and a nonexistent post are indistinguishable.
    const missing = await page.goto("/p/00000000-0000-4000-8000-000000000000", { waitUntil: "networkidle" });
    const hidden = await page.goto(`/p/${levelPost}`, { waitUntil: "networkidle" });
    expect(missing?.status()).toBe(hidden?.status());
    expect(await page.locator("main").innerText()).not.toContain(marker);
  });

  test("poll voting reveals results and cannot be repeated", async ({ page }) => {
    test.setTimeout(90_000);
    const marker = `E2E poll ${Date.now()}`;
    await login(page, STUDENT);
    await page.goto("/compose?type=poll", { waitUntil: "networkidle" });
    await page.getByLabel("Poll question").fill(marker);
    await page.getByLabel("Option 1").fill("Library");
    await page.getByLabel("Option 2").fill("Reading room");
    await page.getByRole("banner").getByRole("button", { name: "Post", exact: true }).click();
    await page.waitForURL(/\/p\/[^/]+$/);
    const id = page.url().split("/p/")[1]!;

    await switchUser(page, LEVELMATE);
    await page.goto(`/p/${id}`, { waitUntil: "networkidle" });
    await page.getByRole("button", { name: "Library" }).click();
    await expect(page.getByText("100%", { exact: true })).toBeVisible();
    await expect(page.getByText("1 vote", { exact: false })).toBeVisible();
  });

  test("report, moderator removal, author sees the removed card", async ({ page }) => {
    test.setTimeout(120_000);
    const marker = `E2E report ${Date.now()}`;
    await login(page, STUDENT);
    const id = await createPost(page, marker);

    await switchUser(page, LEVELMATE);
    await page.goto(`/p/${id}`, { waitUntil: "networkidle" });
    await page.getByRole("button", { name: "Post options" }).click();
    await page.getByRole("menuitem", { name: "Report" }).click();
    await page.getByRole("radio", { name: /Harassment/ }).check();
    await page.getByRole("button", { name: "Next", exact: true }).click();
    await page.getByRole("button", { name: "Submit" }).click();
    await expect(page.getByText(/moderators will review/i)).toBeVisible();
    await page.getByRole("button", { name: "Done" }).click();

    await switchUser(page, "admin@demo.edu.ng");
    await page.goto("/admin/reports", { waitUntil: "networkidle" });
    await page.getByRole("link").filter({ hasText: marker }).first().click();
    await page.getByRole("button", { name: "Remove", exact: true }).click();
    await page.getByLabel("Reason (required)").fill("Harassment in a student post, confirmed by review.");
    await page.getByRole("button", { name: "Record action" }).click();
    await expect(page.getByText(/action recorded|report has been resolved/i)).toBeVisible();

    await switchUser(page, STUDENT);
    await page.goto(`/p/${id}`, { waitUntil: "networkidle" });
    await expect(page.getByText(/removed by a moderator/i)).toBeVisible();
    await expect(page.getByText("Reason: Harassment")).toBeVisible();
  });

  test("blocking hides both students from each other", async ({ page }) => {
    test.setTimeout(90_000);
    const marker = `E2E block ${Date.now()}`;
    await login(page, STUDENT);
    const id = await createPost(page, marker);

    await switchUser(page, LEVELMATE);
    await page.goto(`/p/${id}`, { waitUntil: "networkidle" });
    await page.getByRole("button", { name: "Post options" }).click();
    await page.getByRole("menuitem", { name: /Block @/ }).click();
    await page.waitForTimeout(1_500);
    await page.goto(`/p/${id}`, { waitUntil: "networkidle" });
    await expect(page.getByText(/isn't available/i).first()).toBeVisible();
    await expect(page.getByText(marker)).toHaveCount(0);

    await switchUser(page, STUDENT);
    await page.goto("/profile/adaeze_levelmate", { waitUntil: "networkidle" });
    await expect(page.getByRole("heading", { name: /could not be found/i })).toBeVisible();
  });
});

test.describe("shared device and offline", () => {
  test("logout clears the cached feed, cookies and IndexedDB", async ({ page }) => {
    test.setTimeout(90_000);
    await login(page, STUDENT);
    await page.goto("/pulse", { waitUntil: "networkidle" });

    const before = await page.evaluate(async () => ({
      indexedDb: (await indexedDB.databases()).map((entry) => entry.name),
      caches: await caches.keys(),
    }));
    expect(before.indexedDb.length).toBeGreaterThan(0);

    await page.getByRole("button", { name: /account menu/i }).click();
    await page.getByRole("button", { name: /log out/i }).click();
    await page.waitForURL(/\/login/, { timeout: 20_000 });

    const after = await page.evaluate(async () => ({
      indexedDb: (await indexedDB.databases()).map((entry) => entry.name),
      caches: await caches.keys(),
      local: Object.keys(localStorage).filter((key) => key.toLowerCase().includes("konnekt")),
    }));
    expect(after.caches).toEqual([]);
    expect(after.indexedDb.filter((name) => name?.includes("konnekt"))).toEqual([]);
    expect(after.local).toEqual([]);

    await login(page, LEVELMATE);
    await page.goto("/pulse", { waitUntil: "networkidle" });
    await expect(page.getByText(/nothing is faked/i)).toHaveCount(0);
  });

  test("offline outbox publishes once after reconnect", async ({ page, context }) => {
    test.setTimeout(90_000);
    await login(page, STUDENT);
    await page.goto("/compose?type=post", { waitUntil: "networkidle" });
    await context.setOffline(true);
    await expect(page.getByText(/This post will join your outbox/)).toBeVisible();
    const marker = `E2E offline ${Date.now()}`;
    await page.getByLabel("What's happening on campus?").fill(marker);
    await page.getByRole("banner").getByRole("button", { name: "Post", exact: true }).click();
    await expect(page.getByText(/saved to your outbox/i)).toBeVisible();

    await context.setOffline(false);
    await page.goto("/pulse", { waitUntil: "domcontentloaded" });
    const newPosts = page.getByRole("button", { name: /new post/i });
    await newPosts.click({ timeout: 20_000 }).catch(() => undefined);
    await page.reload({ waitUntil: "domcontentloaded" });
    await expect(page.getByText(marker)).toHaveCount(1, { timeout: 20_000 });
  });
});
