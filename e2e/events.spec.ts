import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { login } from "./helpers";

const STUDENT = "student@nova.edu.ng";
const OTHER_COLLEGE = "othercollege@nova.edu.ng";
const ADMIN = "admin@nova.edu.ng";

test.describe("Events and the official channel", () => {
  test("a student can find an event, RSVP and generate a QR ticket", async ({ page }) => {
    test.setTimeout(120_000);
    await login(page, STUDENT);
    await page.goto("/events", { waitUntil: "networkidle" });
    await expect(page.getByRole("heading", { name: "Events", exact: true })).toBeVisible();
    const results = await new AxeBuilder({ page: page as never }).analyze();
    expect(results.violations.filter((violation) => violation.impact === "serious" || violation.impact === "critical")).toEqual([]);
    await page.getByRole("link", { name: /E2E Open Mic/ }).click();
    await expect(page.getByRole("heading", { name: "E2E Open Mic" })).toBeVisible();
    const cancelRsvp = page.getByRole("button", { name: "Cancel RSVP", exact: true });
    if ((await cancelRsvp.count()) > 0) await cancelRsvp.click();
    await page.getByRole("button", { name: "I'm going", exact: true }).click();
    await expect(page.getByRole("heading", { name: "You're going!" })).toBeVisible();
    await page.getByRole("link", { name: "Open my ticket" }).click();
    const generate = page.getByRole("button", { name: /Generate ticket|Show a new code/ });
    if ((await generate.count()) > 0) await generate.click();
    await expect(page.getByLabel("Ticket QR code")).toBeVisible();
  });

  test("the critical banner persists until acknowledged", async ({ page }) => {
    test.setTimeout(90_000);
    await login(page, OTHER_COLLEGE);
    await page.goto("/official", { waitUntil: "networkidle" });
    const banner = page.getByRole("region", { name: /E2E registration closes Friday/ });
    await expect(banner).toBeVisible();
    await banner.getByRole("button", { name: "I understand" }).click();
    await expect(page.getByRole("region", { name: /E2E registration closes Friday/ })).toHaveCount(0, {
      timeout: 20_000,
    });
    await page.reload({ waitUntil: "networkidle" });
    await expect(page.getByRole("region", { name: /E2E registration closes Friday/ })).toHaveCount(0);
  });

  test("a moderator sees the event in the admin console with axe-clean structure", async ({ page }) => {
    test.setTimeout(90_000);
    await login(page, ADMIN);
    await page.goto("/admin/events", { waitUntil: "networkidle" });
    await expect(page.getByRole("heading", { name: "Events", exact: true })).toBeVisible();
    await expect(page.getByText("E2E Robotics Night")).toBeVisible();
    await expect(page.getByText("E2E Open Mic")).toBeVisible();
    const results = await new AxeBuilder({ page: page as never }).analyze();
    expect(results.violations.filter((violation) => violation.impact === "serious" || violation.impact === "critical")).toEqual([]);
  });
});
