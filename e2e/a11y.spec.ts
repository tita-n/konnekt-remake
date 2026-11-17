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

test("verification queue passes axe", async ({ page }) => {
  await loginAs(page, "admin");
  await page.goto("/admin/verification", { waitUntil: "networkidle" });
  await scan(page, "admin verification");
  await page.getByRole("link", { name: /Emeka Nwachukwu/ }).first().click();
  await page.waitForURL(/\/admin\/verification\/.+/, { timeout: 20_000 });
  await expect(page.getByText("Check the details")).toBeVisible({ timeout: 20_000 });
  await scan(page, "admin verification detail");
});
