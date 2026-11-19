import { expect, test } from "@playwright/test";
import { loginAs } from "./helpers";

test.describe("university console", () => {
  test("admin sees the queue and a private ID image", async ({ page }) => {
    await loginAs(page, "admin");
    await page.goto("/admin/verification", { waitUntil: "networkidle" });

    await expect(page.getByRole("heading", { name: "Verification queue" })).toBeVisible();
    await expect(page.getByRole("link", { name: /Emeka Nwosu/ })).toBeVisible();

    await page.getByRole("link", { name: /Emeka Nwosu/ }).first().click();
    await expect(page.getByRole("heading", { name: "Emeka Nwosu" })).toBeVisible();
    await expect(page.getByText("Check the details")).toBeVisible();

    const image = page.getByAltText(/Student ID submitted by/);
    await expect(image).toBeVisible();
    const src = await image.getAttribute("src");
    expect(src).toContain("/api/admin/verification/");

    const response = await page.request.get(src!);
    expect(response.status()).toBe(200);
    expect(response.headers()["content-type"]).toContain("image/");

    await expect(page.getByRole("button", { name: "Approve student" })).toBeVisible();
    await expect(page.getByText("Decline", { exact: true })).toBeVisible();
  });

  test("admin can open the academic tree and settings with contrast gate", async ({ page }) => {
    await loginAs(page, "admin");
    await page.goto("/admin/academic", { waitUntil: "networkidle" });
    await expect(page.getByRole("heading", { name: "Academic tree" })).toBeVisible();
    await expect(page.getByText(/order controls the signup picker/i)).toBeVisible();

    await page.goto("/admin/settings", { waitUntil: "networkidle" });
    await expect(page.getByRole("heading", { name: "University settings" })).toBeVisible();
    await expect(page.getByText("Passes WCAG AA")).toBeVisible();

    // A failing accent disables saving.
    await page.getByLabel("Accent colour", { exact: true }).fill("#FFFF00");
    await expect(page.getByText("Fails contrast", { exact: false }).or(page.getByText(/Too light|Too dark|Text on this accent/)).first()).toBeVisible();
    await expect(page.getByRole("button", { name: "Save university settings" })).toBeDisabled();
  });

  test("reviewer cannot reach students or team management", async ({ page }) => {
    await loginAs(page, "reviewer");
    await page.goto("/admin", { waitUntil: "networkidle" });
    await expect(page.getByRole("heading", { name: "University console" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Students" })).toHaveCount(0);

    const response = await page.goto("/admin/students");
    expect(response?.status()).toBe(404);
  });

  test("student cannot reach either console", async ({ page }) => {
    await loginAs(page, "student");
    const admin = await page.goto("/admin");
    expect(admin?.status()).toBe(404);
    const platform = await page.goto("/platform");
    expect(platform?.status()).toBe(404);
  });
});

test.describe("platform console", () => {
  test("platform admin creates a space and sees the audit trail", async ({ page }) => {
    await loginAs(page, "platform");
    await page.goto("/platform/universities", { waitUntil: "networkidle" });
    await expect(page.getByRole("heading", { name: "Universities" })).toBeVisible();
    await expect(page.getByText("Nova University").first()).toBeVisible();

    const suffix = Date.now().toString(36).slice(-5);
    await page.getByLabel("University name").fill(`E2E University ${suffix}`);
    await page.getByLabel("Short name").fill(`E2E-${suffix}`.slice(0, 10));
    await page.getByLabel("URL slug").fill(`e2e-${suffix}`);
    await page.getByRole("button", { name: /Create and switch on/ }).click();
    await expect(page.getByText(/University created and switched on/i)).toBeVisible();
    await expect(page.getByText(`E2E University ${suffix}`).first()).toBeVisible();

    await page.goto("/platform/audit", { waitUntil: "networkidle" });
    await expect(page.getByRole("heading", { name: "Audit log" })).toBeVisible();
    await expect(page.getByText("platform.university_created").first()).toBeVisible();
  });

  test("waitlist export is a CSV", async ({ page }) => {
    await loginAs(page, "platform");
    const response = await page.request.get("/platform/waitlist/export");
    expect(response.status()).toBe(200);
    expect(response.headers()["content-type"]).toContain("text/csv");
    expect(await response.text()).toContain("kind,university,email,created_at");
  });
});
