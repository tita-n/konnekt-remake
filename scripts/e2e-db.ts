import { spawnSync } from "node:child_process";
import { guardFromEnvironment, loadEnvFile } from "./e2e-guard";

loadEnvFile(".env");
loadEnvFile(".env.e2e.local");

const command = process.argv[2];
const e2eUrl = guardFromEnvironment();

function run(commandName: string, args: string[]): void {
  const result = spawnSync(commandName, args, {
    stdio: "inherit",
    env: { ...process.env, NODE_ENV: "development", DATABASE_URL: e2eUrl },
  });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

if (command === "up") {
  const docker = spawnSync("docker", ["--version"], { stdio: "ignore" });
  if (docker.status !== 0) {
    console.error("Docker is not available. Create a Neon branch/database ending in _e2e and put its URL in E2E_DATABASE_URL (see docs/ENV.md).");
    process.exit(1);
  }
  const exists = spawnSync("docker", ["inspect", "konnekt-e2e-postgres"], { stdio: "ignore" }).status === 0;
  if (exists) {
    run("docker", ["start", "konnekt-e2e-postgres"]);
  } else {
    run("docker", [
      "run",
      "--name",
      "konnekt-e2e-postgres",
      "-e",
      "POSTGRES_HOST_AUTH_METHOD=trust",
      "-e",
      "POSTGRES_DB=konnekt_e2e",
      "-p",
      "55433:5432",
      "-d",
      "postgres:16",
    ]);
  }
  console.log("E2E Postgres is listening on 127.0.0.1:55433 (database konnekt_e2e).");
  process.exit(0);
}

if (command === "prepare") {
  run("npx", ["prisma", "migrate", "deploy"]);
  run("npx", ["tsx", "prisma/seed-e2e.ts"]);
  process.exit(0);
}

if (command === "reset") {
  run("npx", ["prisma", "migrate", "reset", "--force", "--skip-seed"]);
  run("npx", ["tsx", "prisma/seed-e2e.ts"]);
  process.exit(0);
}

console.error("Usage: tsx scripts/e2e-db.ts <up|prepare|reset>");
process.exit(1);
