import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { login } from "./helpers";

async function switchUser(page: import("@playwright/test").Page, email: string) {
  await page.context().clearCookies();
  await login(page, email);
}

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

  test("a student creates an event and another student RSVPs through the UI", async ({ page }) => {
    test.setTimeout(120_000);
    await login(page, STUDENT);
    await page.goto("/events/new", { waitUntil: "networkidle" });
    const title = `E2E Created Event ${Date.now()}`;
    await page.getByLabel("Title").fill(title);
    await page.getByLabel("Description").fill("Created by the Playwright student flow.");
    await page.getByRole("textbox", { name: "Venue", exact: true }).fill("E2E Main Hall");
    await page.getByLabel("Capacity").fill("12");
    await page.getByRole("button", { name: "Create event", exact: true }).click();
    await page.waitForURL(/\/events\/[^/]+$/, { timeout: 30_000 });
    await expect(page.getByRole("heading", { name: title })).toBeVisible();
    const eventUrl = page.url();

    await switchUser(page, "levelmate@nova.edu.ng");
    await page.goto(eventUrl, { waitUntil: "networkidle" });
    await expect(page.getByRole("heading", { name: title })).toBeVisible();
    await page.getByRole("button", { name: "I'm going", exact: true }).click();
    await expect(page.getByRole("heading", { name: "You're going!" })).toBeVisible();
  });

  test("a full event waitlists a student and promotes them when a seat opens", async ({ page }) => {
    test.setTimeout(120_000);
    await login(page, STUDENT);
    await page.goto("/events/e2e-event-full", { waitUntil: "networkidle" });
    await expect(page.getByRole("button", { name: "You're going", exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Cancel RSVP", exact: true }).click();
    await expect(page.getByRole("button", { name: "I'm going", exact: true })).toBeVisible();

    await switchUser(page, "levelmate@nova.edu.ng");
    await page.goto("/events/e2e-event-full", { waitUntil: "networkidle" });
    await expect(page.getByRole("button", { name: "You're going", exact: true })).toBeVisible();
    await expect(page.getByText("You're on the waitlist.")).toHaveCount(0);
  });

  test("the scanner checks in once, reports duplicates and replays an offline scan", async ({ page, context }) => {
    test.setTimeout(150_000);
    await login(page, STUDENT);
    await page.goto("/events/e2e-event-robotics/scan", { waitUntil: "networkidle" });
    await expect(page.getByRole("heading", { name: "E2E Robotics Night" })).toBeVisible();

    const code = page.getByLabel("Ticket code");
    await code.fill("E2E_CHECKIN_TICKET_ALPHA_0001");
    await page.getByRole("button", { name: "Check in", exact: true }).click();
    await expect(page.getByText("Checked in", { exact: true })).toBeVisible();
    await expect(page.getByText("Aisha Bello")).toBeVisible();

    await page.getByRole("button", { name: "Scan next", exact: true }).click();
    await code.fill("E2E_CHECKIN_TICKET_ALPHA_0001");
    await page.getByRole("button", { name: "Check in", exact: true }).click();
    await expect(page.getByText("Already checked in", { exact: true })).toBeVisible();

    await context.setOffline(true);
    await page.getByRole("button", { name: "Scan next", exact: true }).click();
    await code.fill("E2E_OFFLINE_TICKET_BRAVO_0001");
    await page.getByRole("button", { name: "Check in", exact: true }).click();
    await expect(page.getByText(/queued scan waiting/)).toBeVisible();
    await expect(page.getByText("Offline — scans are saved on this device and sent when you reconnect.")).toBeVisible();

    await context.setOffline(false);
    await expect(page.getByText("Queued scan checked in.")).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText("Tunde Adeyemi")).toBeVisible();
  });

  test("an organiser update and event cancellation are visible to students", async ({ page }) => {
    test.setTimeout(120_000);
    await login(page, STUDENT);
    await page.goto("/events/e2e-event-updated", { waitUntil: "networkidle" });
    const updated = page.getByText("Updated by the organiser", { exact: true });
    await expect(updated).toBeVisible();
    await updated.click();
    await expect(page.getByText(/venue changed/)).toBeVisible();
    await expect(page.getByText(/previous venue: E2E Old Hall/)).toBeVisible();

    await page.goto("/events/e2e-event-cancel", { waitUntil: "networkidle" });
    await page.getByRole("button", { name: "Event options" }).click();
    await page.getByRole("button", { name: "Cancel event", exact: true }).first().click();
    await page.getByLabel("Reason for attendees").fill("Playwright cancellation flow.");
    await page.getByRole("button", { name: "Cancel event", exact: true }).last().click();
    await expect(page.getByText("This event was cancelled.")).toBeVisible();
    await expect(page.getByRole("status").filter({ hasText: "Playwright cancellation flow." })).toBeVisible();
    await expect(page.getByText("RSVPs are closed.")).toBeVisible();
  });

  test("a community event is visible only to active community members", async ({ page }) => {
    test.setTimeout(120_000);
    await login(page, STUDENT);
    const member = await page.goto("/events/e2e-event-community", { waitUntil: "networkidle" });
    expect(member?.status()).toBe(200);
    await expect(page.getByRole("heading", { name: "E2E Community Meetup" })).toBeVisible();

    await switchUser(page, OTHER_COLLEGE);
    const outsider = await page.goto("/events/e2e-event-community", { waitUntil: "networkidle" });
    expect(outsider?.status()).toBe(404);
    await expect(page.getByRole("heading", { name: "404" })).toBeVisible();
  });

  test("a departmental announcement is hidden from another department", async ({ page }) => {
    test.setTimeout(120_000);
    await login(page, STUDENT);
    await page.goto("/official", { waitUntil: "networkidle" });
    await expect(page.getByRole("link", { name: "E2E Software Engineering departmental notice", exact: true })).toBeVisible();

    await switchUser(page, OTHER_COLLEGE);
    await page.goto("/official", { waitUntil: "networkidle" });
    await expect(page.getByText("E2E Software Engineering departmental notice")).toHaveCount(0);
  });

  test("the public share card never leaks a private event's details", async ({ page }) => {
    test.setTimeout(90_000);
    await page.context().clearCookies();
    const privateCard = await page.goto("/e/e2e-event-private", { waitUntil: "networkidle" });
    expect(privateCard?.status()).toBe(200);
    const privateBody = await page.locator("body").innerText();
    expect(privateBody).toContain("This event is private");
    expect(privateBody).not.toContain("E2E Private Share Event");
    expect(privateBody).not.toContain("E2E Secret Hall");

    await page.goto("/e/e2e-event-open", { waitUntil: "networkidle" });
    await expect(page.getByRole("heading", { name: "E2E Open Mic" })).toBeVisible();
  });

  test("My Events lists RSVPs and exports a valid .ics with only visible events", async ({ page }) => {
    test.setTimeout(90_000);
    await login(page, STUDENT);
    await page.goto("/events/mine", { waitUntil: "networkidle" });
    await expect(page.getByRole("heading", { name: "My events" })).toBeVisible();
    await expect(page.getByText("E2E Robotics Night")).toBeVisible();
    const response = await page.request.get("/api/events/ics");
    expect(response.status()).toBe(200);
    const ics = await response.text();
    expect(ics).toContain("BEGIN:VCALENDAR");
    expect(ics).toContain("SUMMARY:");
    expect(ics).toContain("E2E Robotics Night");
    expect(ics).not.toContain("E2E Community Meetup");
  });

  test("hiding attendance removes a student from another student's attendee preview", async ({ page }) => {
    test.setTimeout(120_000);
    await login(page, STUDENT);
    await page.goto("/settings/privacy", { waitUntil: "networkidle" });
    const showGoing = page.getByLabel("Show my attendance on events");
    if (await showGoing.isChecked()) await showGoing.uncheck();
    await expect(showGoing).not.toBeChecked();

    await switchUser(page, "levelmate@nova.edu.ng");
    await page.goto("/events/e2e-event-robotics", { waitUntil: "networkidle" });
    const attendees = page.locator('section[aria-labelledby="attendees"]');
    await expect(attendees).not.toContainText("Chinedu Okafor");
    await expect(attendees).toContainText("keeping their attendance private");

    await switchUser(page, STUDENT);
    await page.goto("/settings/privacy", { waitUntil: "networkidle" });
    await page.getByLabel("Show my attendance on events").check();
  });

  test("an organiser adds and removes check-in staff", async ({ page }) => {
    test.setTimeout(120_000);
    await login(page, STUDENT);
    await page.goto("/events/e2e-event-robotics/dashboard", { waitUntil: "networkidle" });
    await page.getByRole("button", { name: "Add staff", exact: true }).click();
    await page.getByLabel("Search students").fill("Aisha");
    const sheet = page.getByRole("dialog");
    await expect(sheet.getByText("Aisha Bello")).toBeVisible();
    await sheet.getByRole("button", { name: "Check-in", exact: true }).click();
    const staff = page.locator('section[aria-labelledby="staff-heading"]');
    await expect(staff).toContainText("Aisha Bello");
    await expect(staff).toContainText("Check-in");
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await staff.getByRole("button", { name: "Remove", exact: true }).click();
    await expect(staff).not.toContainText("Aisha Bello");
    await expect(staff).toContainText("No staff yet.");
  });

  test("logging out on a shared phone ends the session and clears the next screen", async ({ page }) => {
    test.setTimeout(120_000);
    await login(page, STUDENT);
    await page.goto("/settings/account", { waitUntil: "networkidle" });
    await page.getByRole("button", { name: "Your account menu" }).click();
    await page.getByRole("button", { name: "Log out", exact: true }).click();
    await page.waitForURL(/\/login/, { timeout: 30_000 });
    await page.goto("/events", { waitUntil: "networkidle" });
    await page.waitForURL(/\/login/, { timeout: 30_000 });
    await expect(page.getByRole("heading", { name: "Welcome back" })).toBeVisible();
  });
});
