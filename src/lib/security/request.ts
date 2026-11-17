import "server-only";
import { headers } from "next/headers";
import { env } from "@/lib/env";

/** Request metadata for server actions and route handlers (PII-free). */
export async function requestContext() {
  const store = await headers();
  const forwarded = store.get("x-forwarded-for");
  return {
    ip: forwarded?.split(",")[0]?.trim() ?? store.get("x-real-ip") ?? null,
    userAgent: store.get("user-agent")?.slice(0, 255) ?? null,
    origin: store.get("origin"),
    host: store.get("host"),
    nonce: store.get("x-nonce") ?? undefined,
  };
}

export function isSameOrigin(origin: string | null, host: string | null): boolean {
  if (!origin) return false;
  try {
    const expected = new URL(env.APP_URL);
    const actual = new URL(origin);
    if (actual.origin === expected.origin) return true;
    if (host && actual.host === host) return true;
    return false;
  } catch {
    return false;
  }
}

/** Guard for pre-session mutation endpoints. */
export async function assertSameOrigin(): Promise<boolean> {
  const context = await requestContext();
  return isSameOrigin(context.origin, context.host);
}

export function turnstileToken(formData: FormData): string | undefined {
  const value = formData.get("cf-turnstile-response");
  return typeof value === "string" && value.length > 0 ? value : undefined;
}
