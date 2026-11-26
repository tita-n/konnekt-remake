import { loadEnvFile } from "./e2e-guard";
import { formatEnvironmentProblems, productionEnvironmentProblems } from "../src/lib/adapters";

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
const problems = productionEnvironmentProblems(raw, { requireDirectUrl: true, requireHttpsAppUrl: true });

if (problems.length) {
  console.error(`Environment check failed for ${target}. Missing or malformed values (values are never printed):`);
  console.error(formatEnvironmentProblems(problems));
  process.exit(1);
}

console.log(`Environment check passed for ${target}: required variables are present and well-formed.`);
