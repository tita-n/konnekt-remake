/**
 * Matriculation number handling. Nigerian matric numbers are written many
 * ways ("2020/1234", "F/HD/20/321005", "190404021"), so comparison always uses
 * a normalized form while display keeps the student's original formatting.
 */
export function normalizeMatric(raw: string): string {
  return raw
    .normalize("NFKC")
    .toUpperCase()
    // unicode dashes → ASCII dash
    .replace(/[\u2010-\u2015\u2212]/g, "-")
    .replace(/\s+/g, "");
}

const patternCache = new Map<string, RegExp>();

function compile(pattern: string): RegExp {
  const cached = patternCache.get(pattern);
  if (cached) return cached;
  const compiled = new RegExp(pattern);
  patternCache.set(pattern, compiled);
  return compiled;
}

export interface MatricValidation {
  ok: boolean;
  normalized: string;
  error?: "EMPTY" | "TOO_LONG" | "INVALID_PATTERN" | "FORMAT";
}

export function validateMatric(raw: string, pattern: string): MatricValidation {
  const normalized = normalizeMatric(raw ?? "");
  if (!normalized) return { ok: false, normalized, error: "EMPTY" };
  if (normalized.length > 32) return { ok: false, normalized, error: "TOO_LONG" };
  let regex: RegExp;
  try {
    regex = compile(pattern);
  } catch {
    // A broken university pattern must never admit anyone.
    return { ok: false, normalized, error: "INVALID_PATTERN" };
  }
  return regex.test(normalized) ? { ok: true, normalized } : { ok: false, normalized, error: "FORMAT" };
}

/** Basic pattern sanity check used by the admin matric-pattern tester. */
export function matricPatternProblem(pattern: string): string | null {
  if (!pattern || pattern.length > 200) return "Pattern must be between 1 and 200 characters.";
  try {
    new RegExp(pattern);
  } catch {
    return "That is not a valid regular expression.";
  }
  if (/[+*]\s*[+*]/.test(pattern)) return "Nested quantifiers are not allowed.";
  return null;
}
