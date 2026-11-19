const { chromium } = require("playwright");
const fs = require("fs");

const BASE = "http://127.0.0.1:3000";
const OUT = "/tmp/konnekt-current";
fs.mkdirSync(OUT, { recursive: true });

async function login(page, email) {
  await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  await page.getByLabel("Email or username").fill(email);
  await page.getByLabel("Password", { exact: true }).fill("KonnektDemo123!");
  await page.getByRole("button", { name: "Log in" }).click();
  await page.waitForURL((url) => !url.pathname.startsWith("/login"), { timeout: 20000 });
}

async function shot(page, name, fullPage = false) {
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${OUT}/${name}.png`, fullPage });
  console.log(name);
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const mobile = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  const page = await mobile.newPage();
  await login(page, "student@demo.edu.ng");

  await page.goto(`${BASE}/pulse`, { waitUntil: "networkidle" });
  await shot(page, "pulse-mobile", true);
  await page.getByRole("button", { name: "Public" }).click();
  await page.waitForTimeout(1200);
  await shot(page, "pulse-public", true);

  const options = page.locator('article[aria-label="Post by Halima Abubakar"]').getByRole("button", { name: "Post options" });
  await options.click();
  await shot(page, "post-menu");
  await page.getByRole("menuitem", { name: "Report" }).click();
  await shot(page, "report-reason");
  await page.keyboard.press("Escape");

  await page.goto(`${BASE}/compose?type=post`, { waitUntil: "networkidle" });
  await shot(page, "compose-post", true);
  await page.getByRole("button", { name: /Posting to/ }).click();
  await shot(page, "audience-picker");
  await page.keyboard.press("Escape");

  await page.goto(`${BASE}/compose?type=question`, { waitUntil: "networkidle" });
  await shot(page, "compose-question", true);
  await page.goto(`${BASE}/compose?type=poll`, { waitUntil: "networkidle" });
  await shot(page, "compose-poll", true);

  await page.goto(`${BASE}/p/17f4d53e-4372-4628-b9fd-eaf0ed400e1f`, { waitUntil: "networkidle" });
  await shot(page, "post-detail", true);

  await page.goto(`${BASE}/profile/me`, { waitUntil: "networkidle" });
  await shot(page, "profile-me", true);
  await page.goto(`${BASE}/profile/nova_halima_10`, { waitUntil: "networkidle" });
  await shot(page, "profile-other", true);

  await page.goto(`${BASE}/bookmarks`, { waitUntil: "networkidle" });
  await shot(page, "bookmarks", true);
  await page.goto(`${BASE}/drafts`, { waitUntil: "networkidle" });
  await shot(page, "drafts", true);
  await page.goto(`${BASE}/settings/blocked`, { waitUntil: "networkidle" });
  await shot(page, "blocked-settings", true);

  await page.goto(`${BASE}/pulse`, { waitUntil: "networkidle" });
  await mobile.setOffline(true);
  await page.evaluate(() => window.dispatchEvent(new Event("offline")));
  await shot(page, "pulse-offline");
  await mobile.setOffline(false);
  await mobile.close();

  const desktop = await browser.newContext({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1 });
  const admin = await desktop.newPage();
  await login(admin, "admin@demo.edu.ng");
  await admin.goto(`${BASE}/admin/reports`, { waitUntil: "networkidle" });
  await shot(admin, "admin-reports");
  await admin.goto(`${BASE}/admin/students`, { waitUntil: "networkidle" });
  await shot(admin, "admin-students");
  await admin.goto(`${BASE}/admin/students/cmwkqtc1b001eijovknjs4kbd/moderation`, { waitUntil: "networkidle" });
  await shot(admin, "admin-student-moderation");
  await desktop.close();

  await browser.close();
})();
