import "server-only";
import { env, isProduction } from "@/lib/env";

const VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

export interface TurnstileResult {
  success: boolean;
  errorCodes: string[];
}

/**
 * Verify a Turnstile token server-side. Tokens are single-use and scoped to
 * the site key, so verification must happen exactly once per submission.
 */
export async function verifyTurnstile(token: string | null | undefined, remoteIp?: string | null): Promise<TurnstileResult> {
  if (env.TURNSTILE_BYPASS && !isProduction) return { success: true, errorCodes: [] };
  if (!token) return { success: false, errorCodes: ["missing-input-response"] };
  if (!env.TURNSTILE_SECRET_KEY) return { success: false, errorCodes: ["missing-secret"] };

  try {
    const body = new URLSearchParams({ secret: env.TURNSTILE_SECRET_KEY, response: token });
    if (remoteIp) body.set("remoteip", remoteIp);
    const response = await fetch(VERIFY_URL, {
      method: "POST",
      body,
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      cache: "no-store",
    });
    if (!response.ok) return { success: false, errorCodes: [`http-${response.status}`] };
    const data = (await response.json()) as { success: boolean; "error-codes"?: string[] };
    return { success: data.success === true, errorCodes: data["error-codes"] ?? [] };
  } catch {
    return { success: false, errorCodes: ["verification-unreachable"] };
  }
}

export function turnstileSiteKey(): string {
  return env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? "";
}
