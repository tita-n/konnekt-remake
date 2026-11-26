/**
 * External service adapters.
 *
 * Every outbound dependency has one interface and two implementations: a real
 * provider selected by environment keys, and a local/dev implementation that
 * exercises the same code path without a third party. `assertProductionServices`
 * runs at process start, so a deployment missing a required key refuses to boot
 * instead of failing on the first request that needs it.
 */
export type AdapterMode = "real" | "local";

export interface AdapterStatus {
  service: "email" | "image-storage" | "rate-limit" | "bot-protection" | "error-tracking";
  provider: string;
  mode: AdapterMode;
  requiredInProduction: boolean;
  configured: boolean;
}

type Env = Record<string, string | undefined>;

export interface EnvironmentProblem {
  name: string;
  reason: string;
}

interface EnvironmentProblemOptions {
  /** Deploy validation also needs the unpooled Prisma migration URL. */
  requireDirectUrl?: boolean;
  /** Deploy validation refuses a plain-http public origin. */
  requireHttpsAppUrl?: boolean;
}

const QUOTES = /^[\s]*["']|[\s]*["'][\s]*$/;

/**
 * Collect every production problem before refusing to boot. Reasons are static
 * text: this function never interpolates a configured value, so a secret can
 * never reach a startup log. The same collector powers `check:env`.
 */
export function productionEnvironmentProblems(
  env: Env = process.env,
  options: EnvironmentProblemOptions = {},
): EnvironmentProblem[] {
  if (env.NODE_ENV !== "production" || env.NEXT_PHASE === "phase-production-build") return [];
  const problems: EnvironmentProblem[] = [];
  const add = (name: string, reason: string) => problems.push({ name, reason });
  const value = (name: string) => env[name]?.trim() ?? "";
  const present = (name: string) => Boolean(value(name));

  const required: Array<[string, string]> = [
    ["DATABASE_URL", "the database"],
    ["AUTH_SECRET", "session and CSRF signing"],
    ["APP_URL", "absolute links and request origin checks"],
    ["EMAIL_FROM", "transactional email"],
    ["RESEND_API_KEY", "transactional email via Resend"],
    ["CLOUDINARY_CLOUD_NAME", "private ID card storage via Cloudinary"],
    ["CLOUDINARY_API_KEY", "private ID card storage via Cloudinary"],
    ["CLOUDINARY_API_SECRET", "private ID card storage via Cloudinary"],
    ["UPSTASH_REDIS_REST_URL", "rate limiting via Upstash"],
    ["UPSTASH_REDIS_REST_TOKEN", "rate limiting via Upstash"],
    ["NEXT_PUBLIC_TURNSTILE_SITE_KEY", "bot protection via Turnstile"],
    ["TURNSTILE_SECRET_KEY", "bot protection via Turnstile"],
  ];
  const missing = required.filter(([name]) => !present(name));
  for (const [name, purpose] of missing) {
    add(name, `is required in production (${purpose})`);
  }
  if (options.requireDirectUrl && !present("DIRECT_URL")) {
    add("DIRECT_URL", "is required for deploy-time Prisma migrations");
  }

  // Format problems are checked even when a value is missing would double the
  // report, so skip a key that is already listed as missing.
  const malformed = (name: string): boolean => !missing.some(([missingName]) => missingName === name);
  for (const [name] of required) {
    if (!malformed(name)) continue;
    const raw = env[name] ?? "";
    if (raw !== raw.trim()) add(name, "has leading or trailing whitespace");
    if (QUOTES.test(raw)) add(name, "includes quotes; store the bare value");
  }

  if (malformed("DATABASE_URL") && !/^postgres(ql)?:\/\//i.test(value("DATABASE_URL"))) {
    add("DATABASE_URL", "must be a postgres:// or postgresql:// URL");
  }
  if (malformed("AUTH_SECRET") && value("AUTH_SECRET").length < 32) {
    add("AUTH_SECRET", "must be at least 32 characters");
  }
  if (malformed("APP_URL")) {
    const appUrl = value("APP_URL");
    if (options.requireHttpsAppUrl && !/^https:\/\//i.test(appUrl)) {
      add("APP_URL", "must be an https:// URL with no trailing slash or quotes");
    } else if (!/^https?:\/\//i.test(appUrl)) {
      add("APP_URL", "must be an http(s) URL");
    } else if (/\/$/.test(appUrl)) {
      add("APP_URL", "must not end with a trailing slash");
    }
  }
  if (malformed("EMAIL_FROM") && !value("EMAIL_FROM").includes("@")) {
    add("EMAIL_FROM", "must contain an email address");
  }
  if (malformed("UPSTASH_REDIS_REST_URL") && !/^https:\/\//i.test(value("UPSTASH_REDIS_REST_URL"))) {
    add("UPSTASH_REDIS_REST_URL", "must be an https:// URL");
  }
  if (options.requireDirectUrl && present("DIRECT_URL") && !/^postgres(ql)?:\/\//i.test(value("DIRECT_URL"))) {
    add("DIRECT_URL", "must be a postgres:// or postgresql:// URL");
  }
  if (present("TURNSTILE_BYPASS") && env.TURNSTILE_BYPASS === "1") {
    add("TURNSTILE_BYPASS", "must be 0 in production");
  }
  for (const name of ["SENTRY_DSN", "NEXT_PUBLIC_SENTRY_DSN"] as const) {
    if (present(name) && !/^https?:\/\//i.test(value(name))) {
      add(name, "must be an http(s) DSN");
    }
  }
  return problems;
}

export function formatEnvironmentProblems(problems: EnvironmentProblem[]): string {
  return problems.map((problem) => `- ${problem.name}: ${problem.reason}`).join("\n");
}

export function adapterStatus(env: Env = process.env): AdapterStatus[] {
  const has = (...keys: string[]) => keys.every((key) => Boolean(env[key]?.trim()));
  return [
    {
      service: "email",
      provider: "resend",
      mode: has("RESEND_API_KEY") ? "real" : "local",
      requiredInProduction: true,
      configured: has("RESEND_API_KEY"),
    },
    {
      service: "image-storage",
      provider: "cloudinary",
      mode: has("CLOUDINARY_CLOUD_NAME", "CLOUDINARY_API_KEY", "CLOUDINARY_API_SECRET") ? "real" : "local",
      requiredInProduction: true,
      configured: has("CLOUDINARY_CLOUD_NAME", "CLOUDINARY_API_KEY", "CLOUDINARY_API_SECRET"),
    },
    {
      service: "rate-limit",
      provider: "upstash-redis",
      mode: has("UPSTASH_REDIS_REST_URL", "UPSTASH_REDIS_REST_TOKEN") ? "real" : "local",
      requiredInProduction: true,
      configured: has("UPSTASH_REDIS_REST_URL", "UPSTASH_REDIS_REST_TOKEN"),
    },
    {
      service: "bot-protection",
      provider: "cloudflare-turnstile",
      mode: has("TURNSTILE_SECRET_KEY", "NEXT_PUBLIC_TURNSTILE_SITE_KEY") ? "real" : "local",
      requiredInProduction: true,
      configured: has("TURNSTILE_SECRET_KEY", "NEXT_PUBLIC_TURNSTILE_SITE_KEY"),
    },
    {
      service: "error-tracking",
      provider: "sentry",
      mode: has("SENTRY_DSN") ? "real" : "local",
      requiredInProduction: false,
      configured: has("SENTRY_DSN"),
    },
  ];
}

export function assertProductionServices(env: Env = process.env): void {
  const problems = productionEnvironmentProblems(env);
  if (problems.length === 0) return;
  throw new Error(
    `Refusing to start: production environment has ${problems.length} problem${problems.length === 1 ? "" : "s"}:\n${formatEnvironmentProblems(problems)}`,
  );
}
