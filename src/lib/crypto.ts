import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { env } from "./env";

export function randomToken(bytes = 32): string {
  return randomBytes(bytes).toString("base64url");
}

export function sha256(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

export function hmac(value: string, key: string = env.AUTH_SECRET): string {
  return createHmac("sha256", key).update(value, "utf8").digest("hex");
}

/** Constant-time comparison of two hex or utf8 strings. */
export function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a, "utf8");
  const right = Buffer.from(b, "utf8");
  if (left.length !== right.length) {
    // Still run a comparison so length does not short-circuit the work.
    timingSafeEqual(left, left);
    return false;
  }
  return timingSafeEqual(left, right);
}

/** Six-digit numeric code, uniformly distributed. */
export function generateEmailCode(): string {
  return String(100000 + (randomBytes(4).readUInt32BE(0) % 900000));
}

export function hashCode(email: string, purpose: string, code: string): string {
  return hmac(`${email.toLowerCase()}:${purpose}:${code}`);
}

/** Hash an IP address before it is persisted. Raw IPs are never stored. */
export function hashIp(ip: string | null | undefined): string | null {
  if (!ip) return null;
  return sha256(`${ip}:${env.AUTH_SECRET}`).slice(0, 32);
}
