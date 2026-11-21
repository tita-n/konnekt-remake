import { loadEnvFile } from "./e2e-guard";
import { envSchema } from "../src/lib/env-schema";

const target = process.argv[2];
if (target !== "staging" && target !== "production") {
  console.error("Usage: npm run check:env -- <staging|production> [--env-file .env.staging]");
  process.exit(1);
}
const fileIndex = process.argv.indexOf("--env-file");
const envFile = fileIndex === -1 ? undefined : process.argv[fileIndex + 1];
if (envFile) loadEnvFile(envFile);

const raw: Record<string, string | undefined> = { ...process.env, NODE_ENV: "production" };
delete raw.NEXT_PHASE;
const parsed = envSchema.safeParse(raw);
const issues: Array<{ path: PropertyKey[]; message: string }> = parsed.success ? [] : parsed.error.issues;

if (parsed.success && !parsed.data.APP_URL.startsWith("https://")) {
  issues.push({ path: ["APP_URL"], message: "must use https:// outside local development" });
}
if (parsed.success && !raw.DIRECT_URL) {
  issues.push({ path: ["DIRECT_URL"], message: "is required for deploy-time Prisma migrations" });
}

if (issues.length) {
  console.error(`Environment check failed for ${target}. Missing or malformed values (values are never printed):`);
  console.error(issues.map((issue) => `${issue.path.join(".") || "env"}: ${issue.message}`).join("\n"));
  process.exit(1);
}

console.log(`Environment check passed for ${target}: required variables are present and well-formed.`);
