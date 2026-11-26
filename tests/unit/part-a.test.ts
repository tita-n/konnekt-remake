import { describe, expect, it } from "vitest";
import { assertSeedAllowed, isProductionEnvironment, DEMO_PASSWORD } from "../../prisma/seed-guard";
import { adapterStatus, assertProductionServices, productionEnvironmentProblems } from "@/lib/adapters";

describe("production seed guard", () => {
  it("recognises every production marker", () => {
    expect(isProductionEnvironment({ NODE_ENV: "production" })).toBe(true);
    expect(isProductionEnvironment({ VERCEL_ENV: "production" })).toBe(true);
    expect(isProductionEnvironment({ APP_ENV: "prod" })).toBe(true);
    expect(isProductionEnvironment({ KONNEKT_ENV: "PRODUCTION" })).toBe(true);
    expect(isProductionEnvironment({ NODE_ENV: "development" })).toBe(false);
    expect(isProductionEnvironment({ NODE_ENV: "test" })).toBe(false);
  });

  it("fails loudly in production and on a production-looking database", () => {
    expect(() => assertSeedAllowed({ NODE_ENV: "production" })).toThrow(/Refusing to seed/i);
    expect(() => assertSeedAllowed({ NODE_ENV: "development", VERCEL_ENV: "production" })).toThrow(/Refusing to seed/i);
    expect(() =>
      assertSeedAllowed({ NODE_ENV: "development", DATABASE_URL: "postgres://u:p@prod-db.internal/konnekt" }),
    ).toThrow(/production database/i);
    expect(() => assertSeedAllowed({ NODE_ENV: "test" })).not.toThrow();
  });

  it("keeps the demo password out of any production seed run", () => {
    expect(DEMO_PASSWORD).toMatch(/Demo/);
    expect(() => {
      assertSeedAllowed({ NODE_ENV: "production", SEED_PASSWORD: DEMO_PASSWORD });
    }).toThrow();
  });
});

describe("service adapters", () => {
  it("falls back to local adapters when keys are absent", () => {
    const status = adapterStatus({ NODE_ENV: "test" });
    expect(status.every((adapter) => adapter.mode === "local")).toBe(true);
    expect(status.find((adapter) => adapter.service === "rate-limit")?.provider).toBe("upstash-redis");
  });

  it("uses real adapters once keys are supplied", () => {
    const status = adapterStatus({
      NODE_ENV: "production",
      RESEND_API_KEY: "re_test",
      CLOUDINARY_CLOUD_NAME: "c",
      CLOUDINARY_API_KEY: "k",
      CLOUDINARY_API_SECRET: "s",
      UPSTASH_REDIS_REST_URL: "https://example.invalid",
      UPSTASH_REDIS_REST_TOKEN: "t",
      TURNSTILE_SECRET_KEY: "x",
      NEXT_PUBLIC_TURNSTILE_SITE_KEY: "y",
      SENTRY_DSN: "https://example.invalid/1",
    });
    expect(status.every((adapter) => adapter.mode === "real")).toBe(true);
    expect(() => assertProductionServices({
      NODE_ENV: "production",
      DATABASE_URL: "postgresql://u:p@db/konnekt",
      AUTH_SECRET: "0123456789abcdef0123456789abcdef",
      APP_URL: "https://konnekt.example",
      EMAIL_FROM: "Konnekt <hello@konnekt.ng>",
      RESEND_API_KEY: "re_test",
      CLOUDINARY_CLOUD_NAME: "c",
      CLOUDINARY_API_KEY: "k",
      CLOUDINARY_API_SECRET: "s",
      UPSTASH_REDIS_REST_URL: "https://example.invalid",
      UPSTASH_REDIS_REST_TOKEN: "t",
      TURNSTILE_SECRET_KEY: "x",
      NEXT_PUBLIC_TURNSTILE_SITE_KEY: "y",
    })).not.toThrow();
  });

  it("refuses to boot in production when a required key is missing", () => {
    expect(() => assertProductionServices({ NODE_ENV: "production" })).toThrow(/production environment has/i);
    expect(() =>
      assertProductionServices({
        NODE_ENV: "production",
        DATABASE_URL: "postgresql://u:p@db/konnekt",
        AUTH_SECRET: "0123456789abcdef0123456789abcdef",
        APP_URL: "https://konnekt.example",
        EMAIL_FROM: "Konnekt <hello@konnekt.ng>",
        RESEND_API_KEY: "re_test",
        CLOUDINARY_CLOUD_NAME: "c",
        CLOUDINARY_API_KEY: "k",
        CLOUDINARY_API_SECRET: "s",
        UPSTASH_REDIS_REST_URL: "https://example.invalid",
        UPSTASH_REDIS_REST_TOKEN: "t",
        TURNSTILE_SECRET_KEY: "x",
        NEXT_PUBLIC_TURNSTILE_SITE_KEY: "y",
        TURNSTILE_BYPASS: "1",
      }),
    ).toThrow(/TURNSTILE_BYPASS/i);
    expect(() => assertProductionServices({ NODE_ENV: "development" })).not.toThrow();
  });

  it("reports every missing required variable in one failure", () => {
    expect(() => assertProductionServices({ NODE_ENV: "production" })).toThrow(
      /DATABASE_URL[\s\S]*AUTH_SECRET[\s\S]*APP_URL[\s\S]*RESEND_API_KEY[\s\S]*CLOUDINARY_CLOUD_NAME[\s\S]*UPSTASH_REDIS_REST_URL[\s\S]*TURNSTILE_SECRET_KEY/,
    );
  });

  it("reports every malformed value with a name and a reason", () => {
    const problems = productionEnvironmentProblems(
      {
        NODE_ENV: "production",
        DATABASE_URL: "mysql://db/konnekt",
        AUTH_SECRET: "too-short",
        APP_URL: "https://konnekt.example/",
        EMAIL_FROM: "nobody",
        RESEND_API_KEY: "re_test",
        CLOUDINARY_CLOUD_NAME: "c",
        CLOUDINARY_API_KEY: "k",
        CLOUDINARY_API_SECRET: "s",
        UPSTASH_REDIS_REST_URL: "http://redis.example",
        UPSTASH_REDIS_REST_TOKEN: "t",
        NEXT_PUBLIC_TURNSTILE_SITE_KEY: "x",
        TURNSTILE_SECRET_KEY: "y",
        TURNSTILE_BYPASS: "1",
        SENTRY_DSN: "not-a-dsn",
      },
      { requireDirectUrl: true, requireHttpsAppUrl: true },
    );
    const formatted = problems.map((problem) => `${problem.name}: ${problem.reason}`).join("\n");
    expect(formatted).toMatch(/DATABASE_URL: must be a postgres/);
    expect(formatted).toMatch(/AUTH_SECRET: must be at least 32/);
    expect(formatted).toMatch(/APP_URL: must not end with a trailing slash/);
    expect(formatted).toMatch(/EMAIL_FROM: must contain an email/);
    expect(formatted).toMatch(/UPSTASH_REDIS_REST_URL: must be an https:\/\//);
    expect(formatted).toMatch(/DIRECT_URL: is required/);
    expect(formatted).toMatch(/TURNSTILE_BYPASS: must be 0/);
    expect(formatted).toMatch(/SENTRY_DSN: must be an http\(s\) DSN/);
  });

  it("identifies quoted values and refuses plain-http APP_URL at deploy time", () => {
    const base = {
      NODE_ENV: "production",
      DATABASE_URL: "postgresql://u:p@db/konnekt",
      AUTH_SECRET: "0123456789abcdef0123456789abcdef",
      APP_URL: "http://konnekt.example",
      EMAIL_FROM: "Konnekt <hello@konnekt.ng>",
      RESEND_API_KEY: "\"re_quoted\"",
      CLOUDINARY_CLOUD_NAME: "c",
      CLOUDINARY_API_KEY: "k",
      CLOUDINARY_API_SECRET: "s",
      UPSTASH_REDIS_REST_URL: "https://redis.example",
      UPSTASH_REDIS_REST_TOKEN: "t",
      NEXT_PUBLIC_TURNSTILE_SITE_KEY: "x",
      TURNSTILE_SECRET_KEY: "y",
    };
    const problems = productionEnvironmentProblems(base, { requireHttpsAppUrl: true });
    const formatted = problems.map((problem) => `${problem.name}: ${problem.reason}`).join("\n");
    expect(formatted).toMatch(/APP_URL: must be an https:\/\/ URL/);
    expect(formatted).toMatch(/RESEND_API_KEY: includes quotes/);
    expect(formatted).not.toContain("re_quoted");
  });

  it("never includes any configured value in a startup error", () => {
    const secret = "sk_live_value_that_must_never_be_logged_0123456789";
    const database = "postgresql://user:super-secret-password@db.example/konnekt";
    let message = "";
    try {
      assertProductionServices({
        NODE_ENV: "production",
        DATABASE_URL: database,
        AUTH_SECRET: secret,
        APP_URL: "https://konnekt.example/",
        EMAIL_FROM: "Konnekt <hello@konnekt.ng>",
        RESEND_API_KEY: secret,
        CLOUDINARY_CLOUD_NAME: "c",
        CLOUDINARY_API_KEY: secret,
        CLOUDINARY_API_SECRET: secret,
        UPSTASH_REDIS_REST_URL: "https://redis.example",
        UPSTASH_REDIS_REST_TOKEN: secret,
        NEXT_PUBLIC_TURNSTILE_SITE_KEY: secret,
        TURNSTILE_SECRET_KEY: secret,
      });
    } catch (error) {
      message = error instanceof Error ? error.message : String(error);
    }
    expect(message).toContain("APP_URL");
    expect(message).not.toContain(secret);
    expect(message).not.toContain("super-secret-password");
    expect(message).not.toContain("https://konnekt.example/");
  });
});
