import { expect, test } from "@playwright/test";
import { loginAs } from "./helpers";

test.describe("verified student", () => {
  test("lands in the branded shell and sees honest empty states", async ({ page }) => {
    await loginAs(page, "student");
    await page.goto("/pulse", { waitUntil: "networkidle" });

    await expect(page.getByRole("heading", { name: "Pulse", level: 1 })).toBeVisible();
    await expect(page.getByText("Demo", { exact: true }).first()).toBeVisible();
    await expect(page.getByText(/nothing is faked/i)).toBeVisible();

    for (const tab of ["Communities", "Events", "Inbox"]) {
      await page.getByRole("link", { name: new RegExp(tab, "i") }).last().click();
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    }
  });

  test("profile shows department, level and privacy-aware details", async ({ page }) => {
    await loginAs(page, "student");
    await page.goto("/profile/me", { waitUntil: "networkidle" });

    await expect(page.getByRole("heading", { name: "Adaeze Okonkwo", exact: false })).toBeVisible();
    await expect(page.getByText("Computer Science", { exact: false }).first()).toBeVisible();
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
