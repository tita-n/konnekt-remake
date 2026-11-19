import { expect, test } from "@playwright/test";
import { loginAs } from "./helpers";

test.describe("verified student", () => {
  test("lands in the branded shell with the live Pulse feed", async ({ page }) => {
    await loginAs(page, "student");
    await page.goto("/pulse", { waitUntil: "networkidle" });

    await expect(page.getByRole("heading", { name: "Pulse", level: 1 })).toBeVisible();
    await expect(page.getByText("Nova", { exact: true }).first()).toBeVisible();
    await expect(page.getByRole("group", { name: "Filter your Pulse" })).toBeVisible();
    await expect(page.getByRole("region", { name: "Trending on campus" })).toBeVisible();
    await expect(page.locator('article[aria-label^="Post by"]').first()).toBeVisible();

    for (const tab of ["Communities", "Events", "Inbox"]) {
      await page.getByRole("link", { name: new RegExp(tab, "i") }).last().click();
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    }
  });

  test("profile shows department, level and privacy-aware details", async ({ page }) => {
    await loginAs(page, "student");
    await page.goto("/profile/me", { waitUntil: "networkidle" });

    await expect(page.getByRole("heading", { name: "Chinedu Okafor", exact: false })).toBeVisible();
    await expect(page.getByText("Software Engineering", { exact: false }).first()).toBeVisible();
    await expect(page.getByText("300", { exact: false }).first()).toBeVisible();
    await expect(page.getByText("Verified student").first()).toBeVisible();
  });

  test("settings exposes account, privacy and data controls", async ({ page }) => {
    await loginAs(page, "student");
    await page.goto("/settings", { waitUntil: "networkidle" });
    await expect(page.getByRole("heading", { name: "Settings", level: 1 })).toBeVisible();

    await page.getByRole("link", { name: "Privacy", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Privacy", level: 1 })).toBeVisible();
    await expect(page.getByText(/who can see/i).first()).toBeVisible();
  });
});
