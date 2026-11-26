/**
 * Real-service staging verification. Runs inside GitHub Actions with the
 * staging environment secrets. It prints check names and static failure
 * reasons only; it never prints a secret, signed URL, email address or token.
 */
import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { Resend } from "resend";
import { v2 as cloudinary } from "cloudinary";
import { Redis } from "@upstash/redis";
import { Ratelimit } from "@upstash/ratelimit";

const baseUrl = (process.argv[2] || process.env.STAGING_BASE_URL || "").replace(/\/$/, "");
if (!baseUrl) {
  console.error("Usage: node scripts/staging-verify.mjs https://staging.example");
  process.exit(1);
}

const bypass = process.env.SMOKE_PROTECTION_BYPASS;
const baseHeaders = bypass ? { "x-vercel-protection-bypass": bypass } : {};
const results = [];
function pass(name, reason = "") {
  results.push({ status: "PASS", name, reason });
  console.log(`PASS ${name}${reason ? ` — ${reason}` : ""}`);
}
function fail(name, reason) {
  results.push({ status: "FAIL", name, reason });
  console.error(`FAIL ${name} — ${reason}`);
}
function skip(name, reason) {
  results.push({ status: "SKIP", name, reason });
  console.log(`SKIP ${name} — ${reason}`);
}
async function check(name, fn) {
  try {
    await fn();
  } catch (error) {
    fail(name, error instanceof Error ? error.message : "unknown error");
  }
}
async function request(path, init = {}) {
  return fetch(`${baseUrl}${path}`, {
    redirect: "manual",
    ...init,
    headers: { ...baseHeaders, ...(init.headers ?? {}) },
  });
}
function assert(condition, reason) {
  if (!condition) throw new Error(reason);
}

// ---------------------------------------------------------------------------
// HTTP, headers, PWA and public privacy
// ---------------------------------------------------------------------------
await check("health endpoint", async () => {
  const response = await request("/api/health");
  const body = await response.json().catch(() => ({}));
  assert(response.status === 200 && body.status === "ok", `health returned HTTP ${response.status}`);
  assert(body.database === true, "health reports database unavailable");
  const configured = (body.services ?? []).filter((service) => service.requiredInProduction && !service.configured);
  assert(configured.length === 0, "health reports a required real service unconfigured");
});

await check("security headers match snapshot", async () => {
  const snapshot = JSON.parse(readFileSync("security/headers.snapshot.json", "utf8"));
  const response = await request("/");
  assert(response.status === 200, `home returned HTTP ${response.status}`);
  for (const [name, expected] of Object.entries(snapshot)) {
    const actual = response.headers.get(name);
    assert(Boolean(actual), `${name} is missing`);
    const normalised = name === "content-security-policy" ? actual.replace(/nonce-[^']+/g, "nonce-<nonce>") : actual;
    assert(normalised === expected, `${name} differs from the committed snapshot`);
  }
});

await check("/design is 404 in staging", async () => {
  const response = await request("/design");
  assert(response.status === 404, `expected 404, got ${response.status}`);
});

await check("manifest and service worker are served", async () => {
  const manifest = await request("/manifest.webmanifest");
  const body = await manifest.json().catch(() => ({}));
  assert(manifest.status === 200 && Array.isArray(body.icons) && body.icons.length > 0, "manifest is missing icons");
  assert(Boolean(body.start_url), "manifest is missing start_url");
  const worker = await request("/sw.js");
  assert(worker.status === 200, `service worker returned HTTP ${worker.status}`);
  const workerBody = await worker.text();
  assert(workerBody.length > 0, "service worker is empty");
});

await check("public share previews stay private", async () => {
  for (const path of ["/p/00000000-0000-4000-8000-000000000000", "/e/00000000-0000-4000-8000-000000000000"]) {
    const response = await request(path);
    const html = await response.text();
    assert(response.status < 500, `${path} returned HTTP ${response.status}`);
    assert(/noindex/i.test(html), `${path} is not noindex`);
    assert(!/<meta[^>]+property=["']og:/i.test(html), `${path} exposes Open Graph metadata`);
    if (process.env.SMOKE_PRIVATE_MARKER) {
      assert(!html.includes(process.env.SMOKE_PRIVATE_MARKER), `${path} leaks the private marker`);
    }
  }
});

// ---------------------------------------------------------------------------
// Turnstile server-side rejection (no browser automation)
// ---------------------------------------------------------------------------
await check("Turnstile rejects missing and invalid tokens", async () => {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  assert(Boolean(secret), "TURNSTILE_SECRET_KEY is not available");
  const verify = async (token) => {
    const body = new URLSearchParams({ secret });
    if (token !== undefined) body.set("response", token);
    const response = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body,
    });
    assert(response.ok, `Turnstile siteverify returned HTTP ${response.status}`);
    return response.json();
  };
  const missing = await verify(undefined);
  assert(missing.success === false, "Turnstile accepted a missing token");
  const invalid = await verify(`invalid-${randomUUID()}`);
  assert(invalid.success === false, "Turnstile accepted an invalid token");
  const page = await request("/login");
  const html = await page.text();
  assert(html.includes("challenges.cloudflare.com"), "login page does not render the Turnstile widget");
});

// ---------------------------------------------------------------------------
// Resend
// ---------------------------------------------------------------------------
await check("Resend accepts a staging verification email", async () => {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;
  const redirect = process.env.EMAIL_REDIRECT_TO;
  assert(Boolean(key && from), "Resend credentials are not available");
  assert(Boolean(redirect), "EMAIL_REDIRECT_TO is not set, refusing to mail a real address");
  const resend = new Resend(key);
  const { error } = await resend.emails.send({
    from,
    to: redirect,
    subject: "Konnekt staging verification",
    text: `Staging email verification at ${new Date().toISOString()}. No action is needed.`,
  });
  assert(!error, `Resend rejected the message (${error?.name ?? "unknown"})`);
});

// ---------------------------------------------------------------------------
// Cloudinary: signed private image, private access, deletion and expiry
// ---------------------------------------------------------------------------
const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
const cloudKey = process.env.CLOUDINARY_API_KEY;
const cloudSecret = process.env.CLOUDINARY_API_SECRET;
if (cloudName && cloudKey && cloudSecret) {
  cloudinary.config({ cloud_name: cloudName, api_key: cloudKey, api_secret: cloudSecret, secure: true });
}

async function signedUpload(bytes, mime, filename, params, resourceType) {
  const timestamp = Math.floor(Date.now() / 1000);
  const form = new FormData();
  form.append("file", new Blob([bytes], { type: mime }), filename);
  form.append("api_key", cloudKey);
  form.append("timestamp", String(timestamp));
  for (const [key, value] of Object.entries(params)) form.append(key, String(value));
  form.append("signature", cloudinary.utils.api_sign_request({ ...params, timestamp }, cloudSecret));
  const response = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/${resourceType}/upload`, {
    method: "POST",
    body: form,
  });
  assert(response.ok, `Cloudinary upload returned HTTP ${response.status}`);
  return response.json();
}

const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=",
  "base64",
);
const PDF = Buffer.from("%PDF-1.4\n1 0 obj<</Type/Catalog>>endobj\ntrailer<<>>\n%%EOF\n", "ascii");

await check("Cloudinary signed private image access, expiry and deletion", async () => {
  assert(Boolean(cloudName && cloudKey && cloudSecret), "Cloudinary credentials are not available");
  const uploaded = await signedUpload(
    PNG,
    "image/png",
    "verify.png",
    { folder: `konnekt/staging-verify/${randomUUID()}`, type: "authenticated" },
    "image",
  );
  try {
    const signed = cloudinary.url(uploaded.public_id, {
      type: "authenticated",
      sign_url: true,
      secure: true,
      resource_type: "image",
      expires_at: Math.floor(Date.now() / 1000) + 6,
    });
    const signedResponse = await fetch(signed, { cache: "no-store" });
    assert(signedResponse.ok, `signed private image returned HTTP ${signedResponse.status}`);
    const unsigned = `https://res.cloudinary.com/${cloudName}/image/authenticated/${uploaded.public_id}`;
    const unsignedResponse = await fetch(unsigned, { cache: "no-store" });
    assert(!unsignedResponse.ok, "private image is readable without a signature");
    await new Promise((resolve) => setTimeout(resolve, 8000));
    const expired = await fetch(signed, { cache: "no-store" });
    assert(!expired.ok, "expired signed image URL still works");
  } finally {
    await cloudinary.uploader.destroy(uploaded.public_id, {
      type: "authenticated",
      resource_type: "image",
      invalidate: true,
    });
  }
  const afterDelete = cloudinary.url(uploaded.public_id, {
    type: "authenticated",
    sign_url: true,
    secure: true,
    resource_type: "image",
    expires_at: Math.floor(Date.now() / 1000) + 300,
  });
  const deleted = await fetch(afterDelete, { cache: "no-store" });
  assert(!deleted.ok, "deleted private image is still readable");
});

await check("Phase 3 announcement attachment signs and expires", async () => {
  assert(Boolean(cloudName && cloudKey && cloudSecret), "Cloudinary credentials are not available");
  const uploaded = await signedUpload(
    PDF,
    "application/pdf",
    "attachment.pdf",
    { folder: `konnekt/community-resources/${randomUUID()}`, type: "authenticated" },
    "raw",
  );
  try {
    const signed = cloudinary.utils.private_download_url(uploaded.public_id, "", {
      resource_type: "raw",
      type: "authenticated",
      attachment: true,
      expires_at: Math.floor(Date.now() / 1000) + 6,
    });
    const response = await fetch(signed, { cache: "no-store" });
    assert(response.ok, `signed attachment returned HTTP ${response.status}`);
    const contentType = response.headers.get("content-type") ?? "";
    assert(contentType.includes("pdf"), "signed attachment is not served as a PDF");
    await new Promise((resolve) => setTimeout(resolve, 8000));
    const expired = await fetch(signed, { cache: "no-store" });
    assert(!expired.ok, "expired attachment URL still works");
  } finally {
    await cloudinary.uploader.destroy(uploaded.public_id, {
      type: "authenticated",
      resource_type: "raw",
      invalidate: true,
    });
  }
});

// ---------------------------------------------------------------------------
// Upstash
// ---------------------------------------------------------------------------
await check("Upstash sliding-window limit actually limits", async () => {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  assert(Boolean(url && token), "Upstash credentials are not available");
  const redis = new Redis({ url, token });
  assert((await redis.ping()) === "PONG", "Upstash ping failed");
  const limiter = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(3, "20 s"),
    prefix: `konnekt:staging-verify:${randomUUID()}`,
    analytics: false,
  });
  const outcomes = [];
  for (let attempt = 0; attempt < 4; attempt += 1) outcomes.push((await limiter.limit("staging-verify")).success);
  assert(outcomes.slice(0, 3).every(Boolean), "Upstash allowed fewer than three requests");
  assert(outcomes[3] === false, "Upstash did not reject the fourth request");
});

// ---------------------------------------------------------------------------
// Database migrations, tenant and feed index
// ---------------------------------------------------------------------------
await check("database migrations are applied and the feed index is usable", async () => {
  const url = process.env.DATABASE_URL;
  assert(Boolean(url), "DATABASE_URL is not available");
  const db = new PrismaClient({ datasources: { db: { url } } });
  try {
    const migrations = await db.$queryRawUnsafe(
      'SELECT COUNT(*)::int AS total, COUNT(*) FILTER (WHERE finished_at IS NULL)::int AS pending FROM "_prisma_migrations"',
    );
    assert(migrations[0].total > 0, "no migrations are recorded");
    assert(migrations[0].pending === 0, "a migration is unfinished");
    const university = await db.university.findUnique({ where: { slug: "nova-university" }, select: { id: true } });
    assert(Boolean(university), "Nova University is missing; run staging bootstrap");
    const plan = await db.$transaction(async (tx) => {
      await tx.$executeRawUnsafe("SET LOCAL enable_seqscan = off");
      return tx.$queryRawUnsafe(
        `EXPLAIN (FORMAT JSON)
         SELECT id, "rankAt" FROM "Post"
         WHERE "universityId" = $1 AND status = 'ACTIVE'::"PostStatus" AND "audienceKind" = 'PUBLIC'::"AudienceKind"
         ORDER BY "rankAt" DESC, id DESC LIMIT 21`,
        university.id,
      );
    });
    const planText = JSON.stringify(plan);
    assert(planText.includes("Post_universityId_status_rankAt_id_idx"), "feed query lacks the ranking index");
  } finally {
    await db.$disconnect();
  }
});

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------
const failures = results.filter((result) => result.status === "FAIL");
const skipped = results.filter((result) => result.status === "SKIP");
console.log(`Staging verification: ${results.length - failures.length - skipped.length} passed, ${failures.length} failed, ${skipped.length} skipped.`);
if (failures.length) process.exit(1);
