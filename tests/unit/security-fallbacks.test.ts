import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  env: {
    NODE_ENV: "production",
    APP_URL: "https://konnekt.example",
    DATABASE_URL: "postgresql://u:p@db/konnekt",
    AUTH_SECRET: "0123456789abcdef0123456789abcdef",
    SESSION_TTL_DAYS: 30,
    TURNSTILE_BYPASS: false,
    EMAIL_FROM: "Konnekt <hello@konnekt.ng>",
    RESEND_API_KEY: undefined,
    CLOUDINARY_CLOUD_NAME: undefined,
    CLOUDINARY_API_KEY: undefined,
    CLOUDINARY_API_SECRET: undefined,
    UPSTASH_REDIS_REST_URL: undefined,
    UPSTASH_REDIS_REST_TOKEN: undefined,
    NEXT_PUBLIC_TURNSTILE_SITE_KEY: undefined,
    TURNSTILE_SECRET_KEY: undefined,
  } as Record<string, unknown>,
}));

vi.mock("@/lib/env", () => ({
  env: mocks.env,
  isProduction: true,
  isTest: false,
  hasCloudinary: false,
  hasRedis: false,
  hasResend: false,
}));

import { putPrivateImage } from "@/lib/media/private-store";
import { putPublicAvatar } from "@/lib/media/avatar-store";
import { sendVerificationCode } from "@/lib/email";
import { rateLimit } from "@/lib/security/rate-limit";
import { verifyTurnstile } from "@/lib/security/turnstile";
import { cloudinarySignature } from "@/lib/media/post-media";

describe("production services fail closed", () => {
  it("does not write private ID images or avatars to local disk", async () => {
    await expect(putPrivateImage(Buffer.from("x"), "verification")).rejects.toThrow(/not configured/i);
    await expect(putPublicAvatar(Buffer.from("x"))).rejects.toThrow(/not configured/i);
    expect(cloudinarySignature({ folder: "konnekt/posts" })).toBeNull();
  });

  it("surfaces missing/failed email instead of logging only", async () => {
    await expect(sendVerificationCode("student@example.com", "123456", "SIGNUP_EMAIL")).rejects.toThrow(
      /RESEND_API_KEY is not configured/i,
    );
  });

  it("denies rate-limited work when the production store is unavailable", async () => {
    const result = await rateLimit("postCreate", "user-1");
    expect(result.success).toBe(false);
    expect(result.resetSeconds).toBeGreaterThan(0);
  });

  it("cannot enable the Turnstile dev bypass in production and rejects a missing token", async () => {
    mocks.env.TURNSTILE_BYPASS = true;
    const missing = await verifyTurnstile(null);
    expect(missing.success).toBe(false);
    expect(missing.errorCodes).toContain("missing-input-response");

    mocks.env.TURNSTILE_BYPASS = false;
    mocks.env.TURNSTILE_SECRET_KEY = "secret";
    const empty = await verifyTurnstile("");
    expect(empty.success).toBe(false);
  });
});
