import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

const SAFE_DATABASE = /_(e2e|test)$/i;
const PRODUCTION_MARKERS = /(^|[-_.])prod(uction)?([-_.]|$)|(^|[-_.])live([-_.]|$)/i;

export interface E2EDatabaseInput {
  e2eUrl: string | undefined;
  devUrl: string | undefined;
  allowRemote?: boolean;
}

/** Minimal dotenv parser. Loads a file without printing values and never overrides existing env. */
export function loadEnvFile(file: string): void {
  const full = path.resolve(process.cwd(), file);
  if (!existsSync(full)) return;
  for (const raw of readFileSync(full, "utf8").split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const match = line.match(/^([A-Z_][A-Z0-9_]*)\s*=\s*(.*)$/);
    if (!match) continue;
    const key = match[1]!;
    let value = match[2]!.trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = value;
  }
}

function parse(value: string, label: string): URL {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error(`${label} is not a valid PostgreSQL URL.`);
  }
  if (url.protocol !== "postgres:" && url.protocol !== "postgresql:") {
    throw new Error(`${label} must use postgres:// or postgresql://.`);
  }
  return url;
}

export function databaseName(value: string, label = "database URL"): string {
  const url = parse(value, label);
  const name = decodeURIComponent(url.pathname.replace(/^\//, ""));
  if (!name) throw new Error(`${label} does not name a database.`);
  return name;
}

function identity(value: string): string {
  const url = parse(value, "database URL");
  return `${url.hostname}:${url.port || "5432"}/${decodeURIComponent(url.pathname.replace(/^\//, ""))}`;
}

/**
 * Refuse to run e2e against anything that could be a real deployment or the
 * development database. This is deliberately strict: a dedicated database is
 * cheaper than recovering demo or production data.
 */
export function assertSafeE2EDatabase(input: E2EDatabaseInput): string {
  const { e2eUrl, devUrl, allowRemote = false } = input;
  if (!e2eUrl) {
    throw new Error(
      "E2E_DATABASE_URL is required. Use a dedicated database ending in _e2e or _test; see docs/ENV.md.",
    );
  }
  if (!devUrl) {
    throw new Error("DATABASE_URL (or DEV_DATABASE_URL) is required so e2e can prove it is not using the dev database.");
  }

  const e2e = parse(e2eUrl, "E2E_DATABASE_URL");
  const e2eName = decodeURIComponent(e2e.pathname.replace(/^\//, ""));
  if (identity(e2eUrl) === identity(devUrl)) {
    throw new Error("Refusing to run e2e: E2E_DATABASE_URL must be a different database from DATABASE_URL.");
  }
  if (!SAFE_DATABASE.test(e2eName)) {
    throw new Error(
      `Refusing to run e2e: database "${e2eName}" must end in _e2e or _test. Never point e2e at a shared or production database.`,
    );
  }
  if (PRODUCTION_MARKERS.test(e2e.hostname) || PRODUCTION_MARKERS.test(e2eName)) {
    throw new Error("Refusing to run e2e: E2E_DATABASE_URL looks like a production database.");
  }
  const localHost = ["localhost", "127.0.0.1", "::1"].includes(e2e.hostname);
  if (!localHost && !allowRemote) {
    throw new Error(
      "Refusing to run e2e against a remote database without E2E_ALLOW_REMOTE=1. Remote databases are only safe when they are a dedicated branch/database.",
    );
  }
  return e2eUrl;
}

export function guardFromEnvironment(): string {
  loadEnvFile(".env");
  loadEnvFile(".env.e2e.local");
  return assertSafeE2EDatabase({
    e2eUrl: process.env.E2E_DATABASE_URL,
    devUrl: process.env.DEV_DATABASE_URL ?? process.env.DATABASE_URL,
    allowRemote: process.env.E2E_ALLOW_REMOTE === "1",
  });
}
