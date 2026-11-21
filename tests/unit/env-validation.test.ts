import { spawnSync } from "node:child_process";
import { describe, expect, it } from "vitest";

const BASE: Record<string, string> = {
  NODE_ENV: "production",
  APP_URL: "https://konnekt.example",
  DATABASE_URL: "postgresql://user:pass@db.example/konnekt",
  AUTH_SECRET: "0123456789abcdef0123456789abcdef01234567",
  TURNSTILE_BYPASS: "0",
  RESEND_API_KEY: "re_test",
  EMAIL_FROM: "Konnekt <hello@konnekt.ng>",
  CLOUDINARY_CLOUD_NAME: "konnekt",
  CLOUDINARY_API_KEY: "123456789012345",
  CLOUDINARY_API_SECRET: "secret",
  UPSTASH_REDIS_REST_URL: "https://redis.example",
  UPSTASH_REDIS_REST_TOKEN: "token",
  NEXT_PUBLIC_TURNSTILE_SITE_KEY: "1x00000000000000000000AA",
  TURNSTILE_SECRET_KEY: "1x0000000000000000000000000000000AA",
};

function loadEnv(overrides: Record<string, string | undefined>): { status: number; output: string } {
  const childEnv: NodeJS.ProcessEnv = { ...process.env, ...BASE, ...overrides };
  delete childEnv.NEXT_PHASE;
  for (const [key, value] of Object.entries(overrides)) {
    if (value === undefined) delete childEnv[key];
  }
  const result = spawnSync(
    process.execPath,
    [
      "--import",
      "tsx",
      "--eval",
      "import('./src/lib/env.ts').then(() => console.log('ENV_OK')).catch((error) => { console.error(error.message); process.exit(2); })",
    ],
    { cwd: process.cwd(), env: childEnv, encoding: "utf8", timeout: 20_000 },
  );
  return { status: result.status ?? 1, output: `${result.stdout ?? ""}${result.stderr ?? ""}` };
}

describe("production environment validation", () => {
  it("accepts a complete production environment", () => {
    const result = loadEnv({});
    expect(result.output).toContain("ENV_OK");
    expect(result.status).toBe(0);
  });

  for (const key of [
    "DATABASE_URL",
    "AUTH_SECRET",
    "RESEND_API_KEY",
    "CLOUDINARY_CLOUD_NAME",
    "CLOUDINARY_API_KEY",
    "CLOUDINARY_API_SECRET",
    "UPSTASH_REDIS_REST_URL",
    "UPSTASH_REDIS_REST_TOKEN",
    "NEXT_PUBLIC_TURNSTILE_SITE_KEY",
    "TURNSTILE_SECRET_KEY",
  ]) {
    it(`refuses to load production without ${key}`, () => {
      const result = loadEnv({ [key]: undefined });
      expect(result.status).not.toBe(0);
      expect(result.output).toContain(key);
    });
  }

  it("rejects malformed service values and a production Turnstile bypass", () => {
    for (const [key, value] of [
      ["DATABASE_URL", "not-a-postgres-url"],
      ["APP_URL", "not-a-url"],
      ["AUTH_SECRET", "short"],
      ["EMAIL_FROM", "nobody"],
      ["UPSTASH_REDIS_REST_URL", "http://redis.example"],
      ["SENTRY_DSN", "not-a-dsn"],
      ["TURNSTILE_BYPASS", "1"],
    ] as const) {
      const result = loadEnv({ [key]: value });
      expect(result.status, `${key} should be rejected`).not.toBe(0);
      expect(result.output).toContain(key);
    }
  });
});
