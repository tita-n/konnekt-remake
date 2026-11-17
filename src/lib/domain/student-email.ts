/** Student-email domain checks for automatic verification. */

export function normalizeDomain(domain: string): string {
  return domain.trim().toLowerCase().replace(/^@/, "").replace(/\.$/, "");
}

export function emailDomain(email: string): string | null {
  const at = email.lastIndexOf("@");
  if (at <= 0 || at === email.length - 1) return null;
  return normalizeDomain(email.slice(at + 1));
}

export function normalizeDomains(domains: readonly string[]): string[] {
  return Array.from(new Set(domains.map(normalizeDomain).filter(Boolean)));
}

/** Exact domain match: sub.example.edu.ng does not grant example.edu.ng. */
export function isStudentEmail(email: string, domains: readonly string[]): boolean {
  const domain = emailDomain(email);
  if (!domain) return false;
  return normalizeDomains(domains).includes(domain);
}

/** Domains we refuse to treat as institutional even if an admin enters them. */
const PUBLIC_MAIL_DOMAINS = new Set([
  "gmail.com",
  "googlemail.com",
  "yahoo.com",
  "yahoo.co.uk",
  "outlook.com",
  "hotmail.com",
  "live.com",
  "icloud.com",
  "proton.me",
  "protonmail.com",
  "aol.com",
  "mail.com",
  "gmx.com",
  "yandex.com",
]);

export function isPublicMailDomain(domain: string): boolean {
  return PUBLIC_MAIL_DOMAINS.has(normalizeDomain(domain));
}

export function domainProblem(domain: string): string | null {
  const normalized = normalizeDomain(domain);
  if (!normalized) return "Enter a domain.";
  if (normalized.includes("@")) return "Enter the domain only, without the @.";
  if (!/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)+$/.test(normalized)) {
    return "That does not look like a domain (e.g. student.unilag.edu.ng).";
  }
  if (isPublicMailDomain(normalized)) return "Public email domains cannot be used to verify students.";
  return null;
}
