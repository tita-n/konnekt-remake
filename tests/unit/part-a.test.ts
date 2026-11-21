import { describe, expect, it } from "vitest";
import { assertSeedAllowed, isProductionEnvironment, DEMO_PASSWORD } from "../../prisma/seed-guard";
import { adapterStatus, assertProductionServices } from "@/lib/adapters";

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
    expect(() => assertProductionServices({ NODE_ENV: "production" })).toThrow(/required production services/i);
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
});
