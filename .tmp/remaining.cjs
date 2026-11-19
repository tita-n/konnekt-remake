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
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${OUT}/${name}.png`, fullPage });
  console.log(name);
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const mobile = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  const page = await mobile.newPage();
  await login(page, "student@demo.edu.ng");

  await page.goto(`${BASE}/p/06842494-ad28-48bb-bd2d-34aca02ed671`, { waitUntil: "networkidle" });
  await shot(page, "post-image-detail");
  await page.getByRole("button", { name: "Open image viewer" }).click();
  await shot(page, "image-viewer");

  await page.goto(`${BASE}/p/cmwl9pylr003cijt6zk0ql8y6`, { waitUntil: "networkidle" });
  await shot(page, "question-detail");
  await page.goto(`${BASE}/p/cmwl9pys100guijt67xijxmw2`, { waitUntil: "networkidle" });
  await shot(page, "poll-detail");
  await mobile.close();

  const guest = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  const publicPage = await guest.newPage();
  await publicPage.goto(`${BASE}/p/17f4d53e-4372-4628-b9fd-eaf0ed400e1f`, { waitUntil: "networkidle" });
  await shot(publicPage, "public-share", true);
  await guest.close();

  const desktop = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const admin = await desktop.newPage();
  await login(admin, "admin@demo.edu.ng");
  const reportId = fs.readFileSync("/tmp/report-id", "utf8").trim();
  await admin.goto(`${BASE}/admin/reports/${reportId}`, { waitUntil: "networkidle" });
  await shot(admin, "admin-report-detail");
  await desktop.close();

  await browser.close();
})();
