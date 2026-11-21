import { z } from "zod";

const optionalString = z.string().trim().optional().transform((v) => (v === "" ? undefined : v));
const postgresUrl = z
  .string()
  .min(1)
  .refine((value) => /^postgres(ql)?:\/\//i.test(value), "must be a postgres:// or postgresql:// URL");
const httpsUrl = optionalString.refine(
  (value) => value === undefined || /^https:\/\//i.test(value),
  "must be an https:// URL",
);

/**
 * One schema for the app and `check:env`. Validation deliberately returns issue
 * paths only, never values, so a CI log cannot leak a secret.
 */
export const envSchema = z
  .object({
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
    APP_URL: z.string().url().default("http://localhost:3000"),
    DATABASE_URL: postgresUrl,
    DIRECT_URL: optionalString.refine(
      (value) => value === undefined || /^postgres(ql)?:\/\//i.test(value),
      "must be a postgres:// or postgresql:// URL",
    ),
    AUTH_SECRET: z.string().min(32, "AUTH_SECRET must be at least 32 characters"),
    SESSION_TTL_DAYS: z.coerce.number().int().min(1).max(90).default(30),
    TURNSTILE_BYPASS: z
      .enum(["0", "1"])
      .default("0")
      .transform((v) => v === "1"),
    RESEND_API_KEY: optionalString,
    EMAIL_FROM: z.string().default("Konnekt <hello@konnekt.ng>").refine((value) => value.includes("@"), "must contain an email address"),
    EMAIL_REDIRECT_TO: optionalString,
    CLOUDINARY_CLOUD_NAME: optionalString,
    CLOUDINARY_API_KEY: optionalString,
    CLOUDINARY_API_SECRET: optionalString,
    UPSTASH_REDIS_REST_URL: httpsUrl,
    UPSTASH_REDIS_REST_TOKEN: optionalString,
    NEXT_PUBLIC_TURNSTILE_SITE_KEY: optionalString,
    TURNSTILE_SECRET_KEY: optionalString,
    NEXT_PUBLIC_SENTRY_DSN: optionalString.refine(
      (value) => value === undefined || /^https?:\/\//i.test(value),
      "must be an http(s) DSN",
    ),
    SENTRY_DSN: optionalString.refine(
      (value) => value === undefined || /^https?:\/\//i.test(value),
      "must be an http(s) DSN",
    ),
    SENTRY_ENVIRONMENT: optionalString,
    SEED_PLATFORM_ADMIN_EMAIL: optionalString,
  })
  .superRefine((value, ctx) => {
    if (value.NODE_ENV !== "production" || isBuildPhase()) return;
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

function isBuildPhase(): boolean {
  return process.env.NEXT_PHASE === "phase-production-build";
}

export type Env = z.infer<typeof envSchema>;

export function formatEnvIssues(error: z.ZodError): string {
  return error.issues.map((issue) => `${issue.path.join(".") || "env"}: ${issue.message}`).join("\n");
}

export function validateEnvironment(raw: Record<string, string | undefined> = process.env): Env {
  const parsed = envSchema.safeParse(raw);
  if (!parsed.success) {
    throw new Error(`Invalid environment configuration:\n${formatEnvIssues(parsed.error)}`);
  }
  return parsed.data;
}
