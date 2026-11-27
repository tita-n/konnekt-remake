import { expect, test } from "@playwright/test";
import { login } from "./helpers";

/**
 * Two tenants in the same deployment must never show each other's branding.
 * The e2e seed creates Nova University and Lakeside University with different
 * names, accents and email domains.
 */
test.describe("university branding is data-driven", () => {
  test("the public signup page shows only the chosen university", async ({ page }) => {
    await page.goto("/signup/lakeside-university", { waitUntil: "networkidle" });
    await expect(page.getByText("Lakeside University").first()).toBeVisible();
    await expect(page.locator("body")).not.toContainText("Nova University");
  });

  test("a signed-in student sees their own university and no other tenant", async ({ page }) => {
    await login(page, "student@lakeside.edu.ng");
    await page.goto("/pulse", { waitUntil: "networkidle" });
    await expect(page.locator("body")).toContainText("Lakeside");
    await expect(page.locator("body")).not.toContainText("Nova University");
  });
});
