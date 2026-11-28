import { chromium } from "@playwright/test";

const baseUrl = (process.argv[2] || process.env.SMOKE_BASE_URL || "").replace(/\/$/, "");
if (!baseUrl) {
  console.error("Usage: npm run smoke:staging -- https://staging.example");
  process.exit(1);
}

const bypass = process.env.SMOKE_PROTECTION_BYPASS;
const headers = bypass ? { "x-vercel-protection-bypass": bypass } : {};
const failures = [];
function check(condition, message) {
  if (condition) console.log(`ok  ${message}`);
  else {
    console.error(`FAIL ${message}`);
    failures.push(message);
  }
}

async function request(path, init = {}) {
  return fetch(`${baseUrl}${path}`, { redirect: "manual", headers: { ...headers, ...(init.headers ?? {}) }, ...init });
}

const health = await request("/api/health");
const healthBody = await health.json().catch(() => ({}));
check(health.status === 200 && healthBody.status === "ok", `health endpoint (${health.status})`);
check(healthBody.schemaReady === true, "health reports the migrated schema");
check(
  healthBody.migrationReady === true,
  `health reports the expected migration (${healthBody.expectedMigration ?? "unknown"}; applied ${healthBody.appliedMigration ?? "none"})`,
);

const home = await request("/");
const csp = home.headers.get("content-security-policy") ?? "";
check(csp.includes("frame-ancestors 'none'"), "CSP frame-ancestors none");
check(!csp.includes("'unsafe-eval'"), "CSP has no unsafe-eval");
check(!/(^|[\s;])\*/.test(csp), "CSP has no wildcard sources");
check(home.headers.get("x-frame-options") === "DENY", "X-Frame-Options DENY");
check(home.headers.get("x-content-type-options") === "nosniff", "nosniff");
check(Boolean(home.headers.get("referrer-policy")), "Referrer-Policy present");
check(Boolean(home.headers.get("permissions-policy")), "Permissions-Policy present");
check(Boolean(home.headers.get("strict-transport-security")), "HSTS present");

const design = await request("/design");
check(design.status === 404, `/design is 404 (${design.status})`);

const manifest = await request("/manifest.webmanifest");
const manifestBody = await manifest.json().catch(() => ({}));
check(manifest.status === 200 && Array.isArray(manifestBody.icons) && manifestBody.icons.length > 0, "manifest with icons");
check(Boolean(manifestBody.start_url), "manifest start_url");
const sw = await request("/sw.js");
check(sw.status === 200, `service worker available (${sw.status})`);

const previewPath = process.env.SMOKE_PUBLIC_POST_PATH || "/p/00000000-0000-4000-8000-000000000000";
const preview = await request(previewPath);
const previewHtml = await preview.text();
check(preview.status < 500, `public preview responds (${preview.status})`);
check(/noindex,\s*nofollow/i.test(previewHtml) || /noindex/i.test(previewHtml), "public preview is noindex");
check(!/<meta[^>]+property=["']og:/i.test(previewHtml), "public preview has no Open Graph metadata");
if (process.env.SMOKE_PRIVATE_MARKER) {
  check(!previewHtml.includes(process.env.SMOKE_PRIVATE_MARKER), "public preview does not leak the private marker");
}

if (process.env.SMOKE_TEST_EMAIL && process.env.SMOKE_TEST_PASSWORD) {
  const browser = await chromium.launch();
  try {
    const context = await browser.newContext({ baseURL: baseUrl, extraHTTPHeaders: headers });
    const page = await context.newPage();
    await page.goto("/login");
    await page.getByLabel("Email or username").fill(process.env.SMOKE_TEST_EMAIL);
    await page.getByLabel("Password", { exact: true }).fill(process.env.SMOKE_TEST_PASSWORD);
    const loginButton = page.getByRole("button", { name: "Log in" });
    let enabled = await loginButton.isEnabled();
    for (let attempt = 0; attempt < 20 && !enabled; attempt += 1) {
      await page.waitForTimeout(500);
      enabled = await loginButton.isEnabled();
    }
    if (!enabled) {
      // A real Turnstile key intentionally blocks automation. Only skip when
      // the challenge widget is actually present; a disabled button without it
      // is a real UI failure.
      const challenge = page.locator(
        'iframe[src*="challenges.cloudflare.com"], input[name="cf-turnstile-response"]',
      );
      if ((await challenge.count()) > 0) {
        console.log("skip real login: Turnstile requires a real browser; verify login and cookie flags manually.");
      } else {
        check(false, "login button stayed disabled without a Turnstile challenge");
      }
    } else {
      await loginButton.click();
      await page.waitForURL((url) => !url.pathname.startsWith("/login"), { timeout: 30_000 });
      const cookies = await context.cookies();
      const session = cookies.find((cookie) => cookie.name === "konnekt_session");
      const csrf = cookies.find((cookie) => cookie.name === "konnekt_csrf");
      check(Boolean(session), "login sets the session cookie");
      check(session?.httpOnly === true && session?.secure === true && session?.sameSite === "Lax", "session cookie is httpOnly, Secure, SameSite=Lax");
      check(Boolean(csrf) && csrf?.httpOnly === false, "CSRF cookie is readable");
    }
  } finally {
    await browser.close();
  }
} else {
  console.log("skip real login: set SMOKE_TEST_EMAIL and SMOKE_TEST_PASSWORD to enable it.");
}

if (failures.length) {
  console.error(`Staging smoke failed with ${failures.length} issue(s).`);
  process.exit(1);
}
console.log("Staging smoke passed.");
