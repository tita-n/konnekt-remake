/** Opaque, tamper-evident-enough cursor helpers for keyset pagination. */
export interface RankCursor {
  rankAt: string;
  id: string;
}

export function encodeRankCursor(rankAt: Date, id: string): string {
  return Buffer.from(JSON.stringify({ r: rankAt.toISOString(), i: id }), "utf8").toString("base64url");
}

export function decodeRankCursor(value: string | null | undefined): RankCursor | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(Buffer.from(value, "base64url").toString("utf8")) as { r?: unknown; i?: unknown };
    if (typeof parsed.r !== "string" || typeof parsed.i !== "string") return null;
    if (Number.isNaN(new Date(parsed.r).getTime()) || parsed.i.length > 64) return null;
    return { rankAt: parsed.r, id: parsed.i };
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
