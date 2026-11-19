const { chromium } = require("playwright");
(async () => {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  await page.goto("http://127.0.0.1:3000/login", { waitUntil: "networkidle" });
  await page.getByLabel("Email or username").fill("student@demo.edu.ng");
  await page.getByLabel("Password", { exact: true }).fill("KonnektDemo123!");
  await page.getByRole("button", { name: "Log in" }).click();
  await page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 20000 });
  await page.goto("http://127.0.0.1:3000/p/cmwmipgs4004tijsw343iropj", { waitUntil: "networkidle" });
  await page.screenshot({ path: "/tmp/konnekt-current/removed-post.png", fullPage: true });
  console.log("removed-post");
  await browser.close();
})();
