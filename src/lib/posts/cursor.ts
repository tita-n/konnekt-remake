/**
 * Opaque keyset-pagination cursors.
 *
 * Every chronological feed orders by `(createdAt DESC, id DESC)` and continues
 * from that exact pair. The payload uses short keys to keep the URL small; the
 * decoder still accepts the retired `r` (rankAt) field so a cursor issued
 * before the ordering change is read as the same timestamp instead of breaking.
 */
export interface TimeCursor {
  createdAt: string;
  id: string;
}

export function encodeTimeCursor(createdAt: Date, id: string): string {
  return Buffer.from(JSON.stringify({ c: createdAt.toISOString(), i: id }), "utf8").toString("base64url");
}

export function decodeTimeCursor(value: string | null | undefined): TimeCursor | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(Buffer.from(value, "base64url").toString("utf8")) as {
      c?: unknown;
      r?: unknown;
      i?: unknown;
    };
    const timestamp = typeof parsed.c === "string" ? parsed.c : parsed.r;
    if (typeof timestamp !== "string" || typeof parsed.i !== "string") return null;
    if (Number.isNaN(new Date(timestamp).getTime()) || parsed.i.length > 64) return null;
    return { createdAt: timestamp, id: parsed.i };
  } catch {
    return null;
  }
}

export interface ScoreCursor {
  score: number;
  id: string;
}

export function encodeScoreCursor(score: number, id: string): string {
  return Buffer.from(JSON.stringify({ s: score, i: id }), "utf8").toString("base64url");
}

export function decodeScoreCursor(value: string | null | undefined): ScoreCursor | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(Buffer.from(value, "base64url").toString("utf8")) as { s?: unknown; i?: unknown };
    if (typeof parsed.s !== "number" || typeof parsed.i !== "string") return null;
    return { score: parsed.s, id: parsed.i };
  } catch {
    return null;
  }
}
