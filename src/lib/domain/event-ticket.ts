import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

/**
 * Event tickets use an opaque 128-bit random code. Only the SHA-256 hash is
 * stored, so a database read cannot forge a ticket. The raw code is returned
 * once to the student who owns it and is never reconstructable server-side.
 */
export const TICKET_CODE_BYTES = 16;
const CODE_PATTERN = /^[A-Za-z0-9_-]{20,32}$/;

export function generateTicketCode(): string {
  return randomBytes(TICKET_CODE_BYTES).toString("base64url");
}

export function isTicketCodeShape(code: string): boolean {
  return CODE_PATTERN.test(code);
}

export function hashTicketCode(code: string): string {
  return createHash("sha256").update(code, "utf8").digest("hex");
}

/** Constant-time verification of a presented code against a stored hash. */
export function ticketCodeMatches(code: string, storedHash: string): boolean {
  if (!isTicketCodeShape(code)) return false;
  if (!/^[a-f0-9]{64}$/.test(storedHash)) return false;
  const presented = Buffer.from(hashTicketCode(code), "hex");
  const stored = Buffer.from(storedHash, "hex");
  if (presented.length !== stored.length) return false;
  return timingSafeEqual(presented, stored);
}
