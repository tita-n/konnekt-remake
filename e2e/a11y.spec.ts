import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { loginAs } from "./helpers";

const SERIOUS = new Set(["serious", "critical"]);

async function scan(page: Page, label: string) {
  const results = await new AxeBuilder({ page: page as never })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();
  const blocking = results.violations.filter((violation) => SERIOUS.has(violation.impact ?? ""));
  if (blocking.length > 0) {
    console.log(
      label,
      blocking.map((violation) => ({
        id: violation.id,
        impact: violation.impact,
        nodes: violation.nodes.map((node) => node.target.join(" ")).slice(0, 4),
      })),
    );
  }
  expect(blocking, `${label} has serious or critical accessibility violations`).toEqual([]);
}

test("public welcome, login and signup pass axe", async ({ page }) => {
  await page.goto("/", { waitUntil: "networkidle" });
  await scan(page, "welcome");
  await page.goto("/login", { waitUntil: "networkidle" });
  await scan(page, "login");
  await page.goto("/signup", { waitUntil: "networkidle" });
  await scan(page, "signup");
});

test("student shell and settings pass axe", async ({ page }) => {
  await loginAs(page, "student");
  for (const path of ["/pulse", "/profile/me", "/settings", "/settings/privacy", "/settings/appearance"]) {
    await page.goto(path, { waitUntil: "networkidle" });
    await scan(page, `student ${path}`);
  }
});

test("Phase 2 community screens pass axe", async ({ page }) => {
  await loginAs(page, "admin");
  for (const path of ["/communities", "/communities/new"]) {
    await page.goto(path, { waitUntil: "networkidle" });
    await scan(page, `communities ${path}`);
  }

  const token = (await page.context().cookies()).find((cookie) => cookie.name === "konnekt_csrf")?.value ?? "";
  const created = await page.request.fetch("/api/admin/communities", {
    method: "POST",
    headers: { "x-konnekt-csrf": token },
    data: {
      name: `A11y Circle ${Date.now().toString(36)}`,
      description: "A community created for the accessibility scan.",
      category: "ACADEMIC",
      privacy: "PUBLIC",
    },
  });
  expect(created.status()).toBe(201);
  const community = (await created.json()) as { slug: string };

  await page.goto(`/c/${community.slug}`, { waitUntil: "networkidle" });
  await scan(page, "community posts");
  await page.getByRole("button", { name: "Resources" }).click();
  await scan(page, "community resources");
  await page.getByRole("button", { name: "Members" }).click();
  await scan(page, "community members");
  await page.getByRole("button", { name: "About" }).click();
  await scan(page, "community about");

  await page.goto(`/c/${community.slug}/settings`, { waitUntil: "networkidle" });
  await scan(page, "community settings");
  await page.goto("/admin/communities", { waitUntil: "networkidle" });
  await scan(page, "admin communities");
});

test("verification queue passes axe", async ({ page }) => {
  await loginAs(page, "admin");
  await page.goto("/admin/verification", { waitUntil: "networkidle" });
  await scan(page, "admin verification");
  await page.getByRole("link", { name: /Emeka Nwosu/ }).first().click();
  await page.waitForURL(/\/admin\/verification\/.+/, { timeout: 20_000 });
  await expect(page.getByText("Check the details")).toBeVisible({ timeout: 20_000 });
  await scan(page, "admin verification detail");
});
