export function maskMatricNumber(matric: string | null | undefined): string {
  const raw = matric?.trim();
  if (!raw) return "—";
  if (raw.length <= 4) return raw;
  const slashIndex = raw.lastIndexOf("/");
  if (slashIndex >= 0 && raw.length - slashIndex > 3) {
    const prefix = raw.slice(0, slashIndex + 2);
    const suffix = raw.slice(-1);
    const maskedLen = Math.max(2, raw.length - prefix.length - 1);
    return `${prefix}${"*".repeat(maskedLen)}${suffix}`;
  }
  const head = raw.slice(0, Math.max(2, raw.length - 4));
  const tail = raw.slice(-1);
  return `${head}***${tail}`;
}

export function formatReportDisplayId(id: string, createdAtIso: string): string {
  const parsed = new Date(createdAtIso);
  const year = Number.isNaN(parsed.getTime()) ? new Date().getFullYear() : parsed.getUTCFullYear();
  let hash = 0;
  for (let i = 0; i < id.length; i += 1) {
    hash = (hash * 31 + id.charCodeAt(i)) % 10000;
  }
  const suffix = String(Math.abs(hash)).padStart(4, "0");
  return `RP-${year}-${suffix}`;
}

export function pollTimeRemaining(endsAtIso: string, isOpen: boolean, nowMs = Date.now()): string {
  if (!isOpen) return "Poll ended";
  const endMs = new Date(endsAtIso).getTime();
  if (Number.isNaN(endMs)) return "Poll open";
  const diffMs = endMs - nowMs;
  if (diffMs <= 0) return "Poll ended";
  const days = Math.max(1, Math.ceil(diffMs / 86_400_000));
  return days === 1 ? "1 day left" : `${days} days left`;
}

export function truncatePostBody(
  body: string,
  expanded: boolean,
  limit = 260,
): { text: string; truncated: boolean } {
  if (expanded || body.length <= limit) {
    return { text: body, truncated: body.length > limit };
  }
  const slice = body.slice(0, limit - 20);
  const lastSpace = slice.lastIndexOf(" ");
  const cut = lastSpace > limit * 0.6 ? slice.slice(0, lastSpace) : slice;
  return { text: `${cut.trimEnd()}...`, truncated: true };
}
