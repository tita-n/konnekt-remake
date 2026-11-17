import { z } from "zod";

/**
 * Environment validation. Parsed once per process; a misconfigured deployment
 * fails loudly at startup instead of at the first request that needs a secret.
 */
const optionalString = z.string().trim().optional().transform((v) => (v === "" ? undefined : v));

const schema = z
  .object({
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
    APP_URL: z.string().url().default("http://localhost:3000"),
    DATABASE_URL: z.string().min(1),
    DIRECT_URL: optionalString,
    AUTH_SECRET: z.string().min(32, "AUTH_SECRET must be at least 32 characters"),
    SESSION_TTL_DAYS: z.coerce.number().int().min(1).max(90).default(30),
    TURNSTILE_BYPASS: z
      .enum(["0", "1"])
      .default("0")
      .transform((v) => v === "1"),
    RESEND_API_KEY: optionalString,
    EMAIL_FROM: z.string().default("Konnekt <hello@konnekt.ng>"),
    EMAIL_REDIRECT_TO: optionalString,
    CLOUDINARY_CLOUD_NAME: optionalString,
    CLOUDINARY_API_KEY: optionalString,
    CLOUDINARY_API_SECRET: optionalString,
    UPSTASH_REDIS_REST_URL: optionalString,
    UPSTASH_REDIS_REST_TOKEN: optionalString,
    NEXT_PUBLIC_TURNSTILE_SITE_KEY: optionalString,
    TURNSTILE_SECRET_KEY: optionalString,
    NEXT_PUBLIC_SENTRY_DSN: optionalString,
    SENTRY_DSN: optionalString,
    SENTRY_ENVIRONMENT: optionalString,
    SEED_PLATFORM_ADMIN_EMAIL: optionalString,
  })
  .superRefine((value, ctx) => {
    // `next build` runs with NODE_ENV=production but without runtime secrets.
    // Deploy-time validation still applies to every real server process.
    const isBuildPhase = process.env.NEXT_PHASE === "phase-production-build";
    if (value.NODE_ENV !== "production" || isBuildPhase) return;
    if (value.TURNSTILE_BYPASS) {
      ctx.addIssue({ code: "custom", message: "TURNSTILE_BYPASS must be off in production", path: ["TURNSTILE_BYPASS"] });
    }
    const required: Array<[keyof typeof value, string]> = [
      ["UPSTASH_REDIS_REST_URL", "rate limiting"],
      ["UPSTASH_REDIS_REST_TOKEN", "rate limiting"],
      ["CLOUDINARY_CLOUD_NAME", "private ID card storage"],
      ["CLOUDINARY_API_KEY", "private ID card storage"],
      ["CLOUDINARY_API_SECRET", "private ID card storage"],
      ["TURNSTILE_SECRET_KEY", "bot protection"],
      ["NEXT_PUBLIC_TURNSTILE_SITE_KEY", "bot protection"],
      ["RESEND_API_KEY", "transactional email"],
    ];
    for (const [key, purpose] of required) {
      if (!value[key]) {
        ctx.addIssue({ code: "custom", message: `${key} is required in production (${purpose})`, path: [key] });
      }
    }
  });

function load() {
  const parsed = schema.safeParse(process.env);
  if (!parsed.success) {
    const details = parsed.error.issues.map((i) => `${i.path.join(".") || "env"}: ${i.message}`).join("\n");
    throw new Error(`Invalid environment configuration:\n${details}`);
  }
  return parsed.data;
}

export const env = load();

export const isProduction = env.NODE_ENV === "production";
export const isTest = env.NODE_ENV === "test";
export const hasCloudinary = Boolean(env.CLOUDINARY_CLOUD_NAME && env.CLOUDINARY_API_KEY && env.CLOUDINARY_API_SECRET);
export const hasRedis = Boolean(env.UPSTASH_REDIS_REST_URL && env.UPSTASH_REDIS_REST_TOKEN);
export const hasResend = Boolean(env.RESEND_API_KEY);
