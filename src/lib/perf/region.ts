/** Pure helpers for region diagnostics; no network and no secrets. */

/** Extract only a region-looking segment from a hostname, never the hostname. */
export function regionSegment(hostname: string | null | undefined): string | null {
  if (!hostname) return null;
  const labels = hostname.split(".");
  const region =
    labels.find((label) => /^[a-z]{2,4}-[a-z]+-\d$/.test(label)) ??
    labels.find((label) => /^[a-z]{2,4}\d?-[a-z]+-\d$/.test(label));
  return region ?? null;
}

export function hostOf(url: string | undefined): string | null {
  if (!url) return null;
  try {
    return new URL(url).hostname;
  } catch {
    return null;
  }
}

export function nearestRank(samples: number[], percentile: number): number {
  if (samples.length === 0) return 0;
  const sorted = [...samples].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil((percentile / 100) * sorted.length) - 1));
  return Number((sorted[index] ?? 0).toFixed(2));
}
