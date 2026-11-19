import { z } from "zod";

/**
 * Environment validation. Parsed once per process; a misconfigured deployment
 * fails loudly at startup instead of at the first request that needs a secret.
 */
const optionalString = z.string().trim().optional().transform((v) => (v === "" ? undefined : v));

const DEFAULT_DEV_SECRET = "konnekt-ai-studio-local-secret-key-min-32-chars";

const schema = z
  .object({
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
    APP_URL: z
      .string()
      .optional()
      .transform((v) => (v && v.trim() ? v.trim() : "http://localhost:3000")),
    DATABASE_URL: z
      .string()
      .optional()
      .transform((v) => v?.trim() ?? ""),
    DIRECT_URL: optionalString,
    AUTH_SECRET: z
      .string()
      .optional()
      .transform((v) => (v && v.trim().length >= 32 ? v.trim() : DEFAULT_DEV_SECRET)),
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
export const hasDatabase = Boolean(env.DATABASE_URL);
export const hasCloudinary = Boolean(env.CLOUDINARY_CLOUD_NAME && env.CLOUDINARY_API_KEY && env.CLOUDINARY_API_SECRET);
export const hasRedis = Boolean(env.UPSTASH_REDIS_REST_URL && env.UPSTASH_REDIS_REST_TOKEN);
export const hasResend = Boolean(env.RESEND_API_KEY);
