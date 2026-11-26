/**
 * Check that a Vercel project environment exposes every required variable NAME.
 * It never requests decrypted values and never prints a value, only names.
 *
 * Usage: node scripts/check-vercel-env.mjs --target=production
 */
const targetArg = process.argv.find((arg) => arg.startsWith("--target="));
const target = targetArg?.slice("--target=".length) || "production";
if (target !== "production" && target !== "preview" && target !== "development") {
  console.error("Usage: node scripts/check-vercel-env.mjs --target=production");
  process.exit(1);
}

const token = process.env.VERCEL_TOKEN;
const projectId = process.env.VERCEL_PROJECT_ID;
const teamId = process.env.VERCEL_ORG_ID;
const missingCredentials = [
  ["VERCEL_TOKEN", token],
  ["VERCEL_PROJECT_ID", projectId],
  ["VERCEL_ORG_ID", teamId],
]
  .filter(([, value]) => !value)
  .map(([name]) => name);
if (missingCredentials.length) {
  console.error(`Vercel environment check cannot run: missing ${missingCredentials.join(", ")}.`);
  process.exit(1);
}

const required = [
  "APP_URL",
  "DATABASE_URL",
  "AUTH_SECRET",
  "RESEND_API_KEY",
  "EMAIL_FROM",
  "CLOUDINARY_CLOUD_NAME",
  "CLOUDINARY_API_KEY",
  "CLOUDINARY_API_SECRET",
  "UPSTASH_REDIS_REST_URL",
  "UPSTASH_REDIS_REST_TOKEN",
  "NEXT_PUBLIC_TURNSTILE_SITE_KEY",
  "TURNSTILE_SECRET_KEY",
];

const query = new URLSearchParams({ decrypt: "false" });
if (teamId) query.set("teamId", teamId);
const response = await fetch(`https://api.vercel.com/v9/projects/${encodeURIComponent(projectId)}/env?${query}`, {
  headers: { Authorization: `Bearer ${token}` },
});
const body = await response.json().catch(() => ({}));
if (!response.ok) {
  const reason = typeof body?.error?.message === "string" ? body.error.message : `HTTP ${response.status}`;
  console.error(`Vercel environment check failed: ${reason}`);
  process.exit(1);
}

const entries = Array.isArray(body?.envs) ? body.envs : [];
const names = new Set(
  entries
    .filter((entry) => {
      const targets = Array.isArray(entry?.target) ? entry.target : [entry?.target];
      return targets.includes(target);
    })
    .map((entry) => entry?.key)
    .filter((key) => typeof key === "string"),
);
const missing = required.filter((name) => !names.has(name));
if (missing.length) {
  console.error(`Vercel ${target} environment is missing required names:`);
  for (const name of missing) console.error(`- ${name}`);
  process.exit(1);
}
console.log(`Vercel ${target} environment exposes all ${required.length} required variable names.`);
