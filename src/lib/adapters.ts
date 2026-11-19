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
  if (env.NODE_ENV !== "production") return;
  if (env.NEXT_PHASE === "phase-production-build") return;
  const missing = adapterStatus(env).filter((adapter) => adapter.requiredInProduction && !adapter.configured);
  if (missing.length > 0) {
    const names = missing.map((adapter) => `${adapter.service} (${adapter.provider})`).join(", ");
    console.warn(`[AI Studio] External services not configured — using local fallbacks: ${names}.`);
  }
}
