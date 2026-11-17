import "server-only";
import { hash, verify } from "@node-rs/argon2";

/**
 * Argon2id parameters follow OWASP's 2024 guidance for interactive logins:
 * 19 MiB memory, 2 iterations, 1 lane. Raise memory before iterations.
 */
// 2 = Argon2id in @node-rs/argon2 (Argon2d = 0, Argon2i = 1). Referenced
// numerically because the package exports an ambient const enum, which is
// inaccessible under isolatedModules.
const OPTIONS = {
  algorithm: 2,
  memoryCost: 19456,
  timeCost: 2,
  parallelism: 1,
  outputLen: 32,
} as const;

export async function hashPassword(password: string): Promise<string> {
  return hash(password, OPTIONS);
}

export async function verifyPassword(passwordHash: string, password: string): Promise<boolean> {
  try {
    return await verify(passwordHash, password, OPTIONS);
  } catch {
    return false;
  }
}

export { passwordStrength } from "@/lib/domain/password-strength";
export type { PasswordStrength } from "@/lib/domain/password-strength";

/**
 * Breach check with the HIBP Pwned Passwords range API (k-anonymity).
 * The password never leaves the server, and only a 5-character SHA-1 prefix is
 * sent. Leaves the app usable if HIBP is unreachable, and says so in logs.
 */
export async function isPasswordBreached(password: string): Promise<boolean> {
  const { createHash } = await import("node:crypto");
  const digest = createHash("sha1").update(password, "utf8").digest("hex").toUpperCase();
  const prefix = digest.slice(0, 5);
  const suffix = digest.slice(5);

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 2500);
    const response = await fetch(`https://api.pwnedpasswords.com/range/${prefix}`, {
      headers: { "Add-Padding": "true", "User-Agent": "Konnekt-Password-Check" },
      signal: controller.signal,
      cache: "no-store",
    });
    clearTimeout(timeout);
    if (!response.ok) return false;
    const body = await response.text();
    for (const line of body.split("\n")) {
      const [hashSuffix, count] = line.trim().split(":");
      if (hashSuffix === suffix) return Number(count ?? "0") > 0;
    }
    return false;
  } catch {
    console.warn("[security] HIBP check unavailable; allowing password after local checks");
    return false;
  }
}
