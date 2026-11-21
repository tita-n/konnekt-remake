import { spawn, spawnSync } from "node:child_process";
import { createHmac, randomBytes } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { chromium } from "@playwright/test";
import { PrismaClient } from "@prisma/client";

/**
 * Runs against a real `next start` production build. The services are fake
 * values except the database, and the rate-limit URL is intentionally
 * unreachable so every write endpoint must fail closed.
 */
const PORT = 3200;
const BASE = `http://127.0.0.1:${PORT}`;
const DATABASE_URL = process.env.SECURITY_DATABASE_URL ?? process.env.E2E_DATABASE_URL;
const AUTH_SECRET = "security-invariant-secret-0123456789abcdef";
if (!DATABASE_URL) throw new Error("SECURITY_DATABASE_URL or E2E_DATABASE_URL is required");

const env = {
  ...process.env,
  NODE_ENV: "production",
  APP_URL: BASE,
  DATABASE_URL,
  AUTH_SECRET,
  TURNSTILE_BYPASS: "0",
  UPSTASH_REDIS_REST_URL: "https://127.0.0.1:59999",
  UPSTASH_REDIS_REST_TOKEN: "unreachable",
  CLOUDINARY_CLOUD_NAME: "ci",
  CLOUDINARY_API_KEY: "123456789012345",
  CLOUDINARY_API_SECRET: "ci-secret",
  RESEND_API_KEY: "re_ci",
  EMAIL_FROM: "Konnekt <hello@konnekt.ng>",
  NEXT_PUBLIC_TURNSTILE_SITE_KEY: "1x00000000000000000000AA",
  TURNSTILE_SECRET_KEY: "1x0000000000000000000000000000000AA",
  NEXT_PUBLIC_SENTRY_DSN: "",
  SENTRY_DSN: "",
};

const SECURITY_HEADERS = [
  "content-security-policy",
  "x-frame-options",
  "x-content-type-options",
  "referrer-policy",
  "permissions-policy",
  "strict-transport-security",
  "cross-origin-opener-policy",
];

function normalise(headers) {
  const result = {};
  for (const key of SECURITY_HEADERS) {
    let value = headers.get(key);
    if (!value) continue;
    value = value.replace(/'nonce-[^']+'/g, "'nonce-<nonce>'");
    result[key] = value;
  }
  return result;
}

async function waitReady(url, childLog) {
  for (let i = 0; i < 60; i += 1) {
    try {
      const response = await fetch(url);
      if (response.status > 0) return;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(`Server did not start:\n${childLog()}`);
}

function startServer(envOverrides = {}) {
  let log = "";
  const child = spawn(process.execPath, ["node_modules/next/dist/bin/next", "start", "-p", String(PORT)], {
    env: { ...env, ...envOverrides },
    stdio: ["ignore", "pipe", "pipe"],
  });
  child.stdout.on("data", (chunk) => (log += chunk));
  child.stderr.on("data", (chunk) => (log += chunk));
  return { child, log: () => log };
}

function stop(child) {
  child.kill("SIGTERM");
}

const db = new PrismaClient({ datasourceUrl: DATABASE_URL });
const university = await db.university.findUnique({ where: { slug: "nova-university" } });
const student = await db.user.findUnique({ where: { email: "student@nova.edu.ng" } });
const post = await db.post.findFirst({
  where: { universityId: university?.id, status: "ACTIVE" },
  select: { id: true },
});
if (!university || !student || !post) {
  await db.$disconnect();
  throw new Error("Run `npm run e2e:db:prepare` first: the security invariants need the Nova e2e fixture.");
}

const sessionToken = randomBytes(32).toString("base64url");
const tokenHash = (await import("node:crypto")).createHash("sha256").update(sessionToken).digest("hex");
const csrf = createHmac("sha256", AUTH_SECRET).update(`csrf:${sessionToken}`).digest("hex");
await db.session.create({
  data: {
    userId: student.id,
    universityId: university.id,
    tokenHash,
    expiresAt: new Date(Date.now() + 60 * 60 * 1000),
  },
});
await db.$disconnect();

const server = startServer();
try {
  await waitReady(`${BASE}/legal/terms`, server.log);

  const pageResponse = await fetch(`${BASE}/legal/terms`);
  const actualHeaders = normalise(pageResponse.headers);
  const snapshotPath = "security/headers.snapshot.json";
  let snapshot;
  try {
    snapshot = JSON.parse(readFileSync(snapshotPath, "utf8"));
  } catch {
    writeFileSync(snapshotPath, `${JSON.stringify(actualHeaders, null, 2)}\n`);
    throw new Error(`Created ${snapshotPath}; review and commit it, then rerun.`);
  }
  assert(JSON.stringify(actualHeaders) === JSON.stringify(snapshot), "Security headers changed; review the committed snapshot for loosening.");
  assert(pageResponse.headers.get("x-powered-by") === null, "X-Powered-By must be absent");

  const csp = pageResponse.headers.get("content-security-policy") ?? "";
  assert(csp.includes("frame-ancestors 'none'"), "CSP must include frame-ancestors 'none'");
  assert(!csp.includes("'unsafe-eval'"), "Production CSP must not include unsafe-eval");
  assert(!/(^|[\s;])\*/.test(csp), "CSP has a wildcard source");
  assert(pageResponse.headers.get("x-frame-options") === "DENY", "X-Frame-Options must be DENY");
  assert(pageResponse.headers.get("x-content-type-options") === "nosniff", "nosniff missing");
  assert(pageResponse.headers.get("strict-transport-security")?.includes("max-age="), "HSTS missing");

  for (const [path, expected] of [["/design", 404], ["/design/preview/profile", 404], ["/api/dev/last-email", 404]]) {
    const response = await fetch(`${BASE}${path}`, { redirect: "manual" });
    assert(response.status === expected, `${path} must be ${expected} in production (got ${response.status})`);
  }

  const health = await fetch(`${BASE}/api/health`);
  const healthBody = await health.json();
  assert(health.status === 200 && healthBody.status === "ok", `health expected ok (${health.status} ${JSON.stringify(healthBody)})`);
  assert(!JSON.stringify(healthBody).includes("secret"), "health response leaked a secret-like value");

  const cookieHeader = `konnekt_session=${sessionToken}; konnekt_csrf=${csrf}`;
  const writes = [
    ["/api/uploads/sign", {}],
    ["/api/posts", { type: "POST", body: `security invariant ${Date.now()}`, audienceId: "university" }],
    [`/api/posts/${post.id}/comments`, { body: "security invariant comment" }],
    ["/api/reports", { targetType: "POST", targetId: post.id, reason: "SPAM" }],
  ];
  for (const [path, body] of writes) {
    const response = await fetch(`${BASE}${path}`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-konnekt-csrf": csrf, cookie: cookieHeader, origin: BASE },
      body: JSON.stringify(body),
    });
    assert(response.status === 429, `${path} must fail closed at 429 when Redis is unavailable (got ${response.status})`);
  }
  const verification = await fetch(`${BASE}/api/verification/id-card`, {
    method: "POST",
    headers: { "x-konnekt-csrf": csrf, cookie: cookieHeader, origin: BASE },
    body: new FormData(),
  });
  assert(verification.status === 429, `verification upload must fail closed at 429 (got ${verification.status})`);

  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ baseURL: BASE });
    await page.goto("/login");
    await page.getByLabel("Email or username").fill("student@nova.edu.ng");
    await page.getByLabel("Password", { exact: true }).fill("KonnektDemo123!");
    await page.getByRole("button", { name: "Log in" }).click();
    await page.getByText(/Too many attempts/i).waitFor({ timeout: 20_000 });
  } finally {
    await browser.close();
  }

  // Unreachable database: the server may start, but it must never serve data.
  stop(server.child);
  await new Promise((resolve) => setTimeout(resolve, 1000));
  const broken = startServer({ DATABASE_URL: "postgresql://postgres@127.0.0.1:59999/konnekt" });
  try {
    await waitReady(`${BASE}/api/health`, broken.log);
    const response = await fetch(`${BASE}/api/health`);
    assert(response.status === 503, `Unreachable DB health must be 503 (got ${response.status})`);
    const pulse = await fetch(`${BASE}/pulse`, { redirect: "manual" });
    assert(pulse.status !== 200, `Unreachable DB must not serve the feed (got ${pulse.status})`);
  } finally {
    stop(broken.child);
  }

  // Demo seed must refuse production even when all services are configured.
  const seed = spawnSync("npx", ["tsx", "prisma/seed.ts"], {
    env: { ...env, DATABASE_URL },
    encoding: "utf8",
  });
  assert(seed.status !== 0, "Demo seed must fail in production");

  console.log("Production security invariants passed.");
} finally {
  stop(server.child);
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}
