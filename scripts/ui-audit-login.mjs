import { mkdir, readFile, rm } from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright";

const PASSWORD = "KonnektDemo123!";

function parseArgs(argv) {
  const args = {};
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith("--")) continue;
    const key = token.slice(2);
    const value = argv[index + 1];
    if (!value || value.startsWith("--")) args[key] = true;
    else {
      args[key] = value;
      index += 1;
    }
  }
  return args;
}

async function login(page, baseUrl, email) {
  await page.goto(`${baseUrl}/login`, { waitUntil: "domcontentloaded", timeout: 30_000 });
  await page.getByLabel("Email or username").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(PASSWORD);
  const submit = page.getByRole("button", { name: "Log in" });
  await submit.waitFor({ state: "visible", timeout: 20_000 });
  if (await submit.isDisabled()) {
    // Development login has Turnstile bypassed, so the button must not wait on
    // a widget. Fail loudly rather than pretending a session exists.
    throw new Error(`Login button disabled for ${email}; dev Turnstile bypass is not active`);
  }
  await submit.click();
  await page.waitForURL((url) => !url.pathname.startsWith("/login"), { timeout: 30_000 });
  await page.waitForLoadState("domcontentloaded").catch(() => undefined);
}

async function run() {
  const args = parseArgs(process.argv.slice(2));
  const baseUrl = args["base-url"] ?? "http://127.0.0.1:3102";
  const routesFile = args.routes ?? "design/audit-routes.json";
  const outDir = path.resolve(args.out ?? ".ui-audit/auth");
  const config = JSON.parse(await readFile(routesFile, "utf8"));
  await rm(outDir, { recursive: true, force: true });
  await mkdir(outDir, { recursive: true });

  const browser = await chromium.launch({ headless: true });
  try {
    for (const [role, email] of Object.entries(config.roles ?? {})) {
      if (!email) continue;
      const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
      const page = await context.newPage();
      try {
        await login(page, baseUrl, email);
        const pathName = path.join(outDir, `${role}.json`);
        await context.storageState({ path: pathName });
        console.log(`Saved ${role} session`);
      } finally {
        await context.close();
      }
    }
  } finally {
    await browser.close();
  }
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
