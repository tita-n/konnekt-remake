import { expect, test, type Page } from "@playwright/test";
import { login } from "./helpers";

const STUDENT = "student@nova.edu.ng";
const LEVELMATE = "levelmate@nova.edu.ng";
const BODY = "What's happening on campus?";

async function openComposer(page: Page) {
  await page.goto("/compose?type=post", { waitUntil: "networkidle" });
  await expect(page.getByLabel(BODY)).toBeVisible();
}

test.describe("local-first drafts", () => {
  test("typing then reloading restores the draft", async ({ page }) => {
    test.setTimeout(90_000);
    const marker = `E2E draft restore ${Date.now()}`;
    await login(page, STUDENT);
    await openComposer(page);
    await page.getByLabel(BODY).fill(marker);
    await expect(page.locator("p[role=\"status\"]")).toHaveText(/Saved/);
    // Give the two-second server sync time to land before reloading.
    await page.waitForTimeout(2600);
    await page.reload({ waitUntil: "networkidle" });
    await expect(page.getByLabel(BODY)).toHaveValue(marker);
    await expect(page.getByText(/picked up where you left off/i)).toBeVisible();
  });

  test("offline typing syncs when the connection returns", async ({ page, context }) => {
    test.setTimeout(90_000);
    const marker = `E2E draft offline ${Date.now()}`;
    await login(page, STUDENT);
    await openComposer(page);
    await context.setOffline(true);
    await page.getByLabel(BODY).fill(marker);
    await expect(page.locator("p[role=\"status\"]")).toHaveText(/Saved on this device/);
    await context.setOffline(false);
    await page.waitForTimeout(3000);
    await page.reload({ waitUntil: "networkidle" });
    await expect(page.getByLabel(BODY)).toHaveValue(marker);
  });

  test("posting removes the draft everywhere", async ({ page }) => {
    test.setTimeout(120_000);
    const marker = `E2E draft posted ${Date.now()}`;
    await login(page, STUDENT);
    await openComposer(page);
    await page.getByLabel(BODY).fill(marker);
    await page.waitForTimeout(2600);
    await page.getByRole("banner").getByRole("button", { name: "Post", exact: true }).click();
    await page.waitForURL(/\/pulse/, { timeout: 30_000 });
    await expect(page.getByTestId("pending-post")).toHaveCount(0, { timeout: 30_000 });
    await page.waitForTimeout(500);
    await page.goto("/drafts", { waitUntil: "networkidle" });
    await expect(page.getByText(marker)).toHaveCount(0);
  });

  test("two tabs never clobber each other", async ({ page, context }) => {
    test.setTimeout(120_000);
    const first = `E2E draft tab A ${Date.now()}`;
    const second = `E2E draft tab B ${Date.now()}`;
    await login(page, STUDENT);
    const other = await context.newPage();
    await openComposer(page);
    await openComposer(other);

    await page.getByLabel(BODY).fill(first);
    await page.waitForTimeout(2800);
    await other.getByLabel(BODY).fill(second);
    await other.waitForTimeout(2800);

    // The stale tab must not overwrite the newer write on reload.
    await page.reload({ waitUntil: "networkidle" });
    await expect(page.getByLabel(BODY)).toHaveValue(second);
    await other.close();
  });

  test("Pulse shows a Continue your draft card", async ({ page }) => {
    test.setTimeout(90_000);
    const marker = `E2E draft card ${Date.now()}`;
    await login(page, STUDENT);
    await openComposer(page);
    await page.getByLabel(BODY).fill(marker);
    await page.waitForTimeout(2600);
    await page.goto("/pulse", { waitUntil: "networkidle" });
    const card = page.getByTestId("continue-draft");
    await expect(card).toBeVisible();
    await expect(card.getByText(marker)).toBeVisible();
    await card.getByRole("link", { name: "Continue" }).click();
    await expect(page.getByLabel(BODY)).toHaveValue(marker);
  });

  test("logout clears local drafts on a shared phone", async ({ page }) => {
    test.setTimeout(90_000);
    const marker = `E2E draft logout ${Date.now()}`;
    await login(page, STUDENT);
    await openComposer(page);
    await page.getByLabel(BODY).fill(marker);
    await page.waitForTimeout(800);
    await page.goto("/pulse", { waitUntil: "networkidle" });
    await page.getByRole("button", { name: /account menu/i }).click();
    await page.getByRole("button", { name: /log out/i }).click();
    await page.waitForURL(/\/login/, { timeout: 20_000 });
    const databases = await page.evaluate(async () => (await indexedDB.databases()).map((entry) => entry.name));
    expect(databases.filter((name) => name?.includes("konnekt"))).toEqual([]);
    await login(page, LEVELMATE);
    await openComposer(page);
    await expect(page.getByLabel(BODY)).toHaveValue("");
  });
});
