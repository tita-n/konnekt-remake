import { expect, test, type Page } from "@playwright/test";
import { login } from "./helpers";

async function codeFor(page: Page, email: string): Promise<string> {
  const response = await page.request.get(`/api/dev/last-email?email=${encodeURIComponent(email)}`);
  expect(response.status()).toBe(200);
  const data = (await response.json()) as { code?: string | null };
  expect(data.code).toMatch(/^\d{6}$/);
  return data.code!;
}

async function fillCode(page: Page, code: string): Promise<void> {
  const digits = page.locator('input[aria-label^="Digit "]');
  for (let index = 0; index < code.length; index += 1) {
    await digits.nth(index).fill(code[index]!);
  }
}

async function createAccount(page: Page, options: { fullName: string; username: string; email: string; password: string }): Promise<void> {
  await page.getByLabel("Full name").fill(options.fullName);
  await page.getByLabel("Username").fill(options.username);
  await expect(page.getByText("That username is free.")).toBeVisible({ timeout: 10_000 });
  const email = page.getByLabel("Email address");
  if (await email.isEditable()) {
    await email.fill(options.email);
  } else {
    expect(await email.inputValue()).toBe(options.email);
  }
  await page.getByLabel("Password", { exact: true }).fill(options.password);
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Create account" }).click();
}

test.describe("student signup journeys", () => {
  test("student email domain verifies automatically and goes straight to onboarding", async ({ page }) => {
    test.setTimeout(120_000);
    const suffix = Date.now().toString(36).slice(-6);
    const email = `e2e_${suffix}@student.nova.edu.ng`;

    await page.goto("/signup/nova-university/email", { waitUntil: "networkidle" });
    await page.getByLabel(/Nova student email/).fill(email);
    await page.getByRole("button", { name: "Send my code" }).click();
    await expect(page.getByText(/We sent a 6-digit code/)).toBeVisible();

    const code = await codeFor(page, email);
    await fillCode(page, code);
    await page.getByRole("button", { name: "Verify my student email" }).click();

    await page.waitForURL(/\/signup\/nova-university\/account/, { timeout: 30_000 });
    await expect(page.getByText(/student email is verified/i)).toBeVisible();
    await createAccount(page, {
      fullName: "Ada Eze",
      username: `email_${suffix}`,
      email,
      password: "KonnektE2E123!",
    });

    await page.waitForURL(/\/onboarding/, { timeout: 30_000 });
    await expect(page.getByRole("heading", { name: "Make your profile yours" })).toBeVisible();
  });

  test("ID card signup waits for review, then the approved student enters the shell", async ({ page }) => {
    test.setTimeout(180_000);
    const suffix = Date.now().toString(36).slice(-6);
    const nameSuffix = suffix.replace(/[0-9]/g, (digit) => "abcdefghij"[Number(digit)]!);
    const email = `id_${suffix}@example.com`;
    const fullName = `Chidi Eze ${nameSuffix}`;

    await page.goto("/signup/nova-university/id", { waitUntil: "networkidle" });
    await page.getByLabel("Matric number").fill(`SWE/2026/${String(Date.now()).slice(-4)}`);
    await page.locator("#id-photo").setInputFiles("public/icons/icon-192.png");
    await expect(page.getByText(/Compressed to/)).toBeVisible({ timeout: 20_000 });
    await page.getByRole("button", { name: "Submit for review" }).click();

    await page.waitForURL(/\/signup\/nova-university\/account/, { timeout: 30_000 });
    await createAccount(page, {
      fullName,
      username: `id_${suffix}`,
      email,
      password: "KonnektE2E123!",
    });

    await page.waitForURL(/\/account\/verify/, { timeout: 30_000 });
    const accountCode = await codeFor(page, email);
    await fillCode(page, accountCode);
    await page.getByRole("button", { name: "Confirm and continue" }).click();

    await page.waitForURL(/\/onboarding/, { timeout: 30_000 });
    const department = page.getByLabel("Department");
    const softwareEngineering = (await department.locator("option").allTextContents()).find((text) =>
      text.startsWith("Software Engineering"),
    );
    expect(softwareEngineering).toBeTruthy();
    await department.selectOption({ label: softwareEngineering! });
    await page.getByLabel("Level").selectOption({ label: "300 level" });
    await page.getByRole("button", { name: "Continue" }).click();
    await expect(page.getByRole("heading", { name: "What are you into?" })).toBeVisible();

    const interests = page.getByRole("group", { name: "Your interests" }).getByRole("button");
    await interests.nth(0).click();
    await interests.nth(1).click();
    await interests.nth(2).click();
    await page.getByRole("button", { name: /Finish and enter Konnekt/ }).click();
    await page.waitForURL(/\/status/, { timeout: 30_000 });

    await page.context().clearCookies();
    await login(page, "admin@nova.edu.ng");
    await page.goto("/admin/verification", { waitUntil: "networkidle" });
    await page.getByRole("link").filter({ hasText: fullName }).first().click();
    await page.getByRole("button", { name: "Approve student" }).click();
    await expect(page.getByText(/approved|verified/i).first()).toBeVisible();

    await page.context().clearCookies();
    await login(page, email, "KonnektE2E123!");
    await page.goto("/profile/me", { waitUntil: "networkidle" });
    await expect(page.getByText(fullName).first()).toBeVisible();
    await expect(page.getByText(/Software Engineering/).first()).toBeVisible();
    await expect(page.getByText(/300/).first()).toBeVisible();
  });
});
