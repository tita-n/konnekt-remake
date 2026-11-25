/**
 * Official accounts are organisation identities created by university admins.
 * Posting rights are never derived from a role name alone: a user must be an
 * assigned staff member of the specific account (admins may publish as any
 * account in their university).
 */

export type OfficialAccountCategory =
  | "ICT"
  | "STUDENT_AFFAIRS"
  | "REGISTRY"
  | "LIBRARY"
  | "STUDENTS_UNION"
  | "ACADEMIC"
  | "SPORTS"
  | "SECURITY"
  | "OTHER";

export type OfficialAccountStatus = "ACTIVE" | "SUSPENDED";

export const OFFICIAL_ACCOUNT_CATEGORIES: ReadonlyArray<{ value: OfficialAccountCategory; label: string }> = [
  { value: "ICT", label: "ICT office" },
  { value: "STUDENT_AFFAIRS", label: "Student affairs" },
  { value: "REGISTRY", label: "Registry" },
  { value: "LIBRARY", label: "Library" },
  { value: "STUDENTS_UNION", label: "Students' union" },
  { value: "ACADEMIC", label: "Academic affairs" },
  { value: "SPORTS", label: "Sports" },
  { value: "SECURITY", label: "Security" },
  { value: "OTHER", label: "Other" },
];

export const OFFICIAL_ACCOUNT_CATEGORY_LABELS: Record<OfficialAccountCategory, string> = Object.fromEntries(
  OFFICIAL_ACCOUNT_CATEGORIES.map((entry) => [entry.value, entry.label]),
) as Record<OfficialAccountCategory, string>;

export const MAX_OFFICIAL_STAFF = 12;
export const OFFICIAL_DESCRIPTION_MAX = 600;
export const OFFICIAL_NAME_MAX = 60;

export function isOfficialCategory(value: unknown): value is OfficialAccountCategory {
  return typeof value === "string" && OFFICIAL_ACCOUNT_CATEGORIES.some((entry) => entry.value === value);
}

export function officialCategoryLabel(value: OfficialAccountCategory | string): string {
  return OFFICIAL_ACCOUNT_CATEGORY_LABELS[value as OfficialAccountCategory] ?? "Other";
}

export function normalizeOfficialName(name: string): string {
  return name
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]/g, "");
}

export function officialNameError(name: string): string | null {
  const trimmed = name.trim();
  if (trimmed.length < 3) return "Use at least 3 characters.";
  if (trimmed.length > OFFICIAL_NAME_MAX) return "Keep the name under 60 characters.";
  if (!/[\p{L}\p{N}]/u.test(trimmed)) return "Use letters or numbers in the name.";
  return null;
}

export function officialSlugError(slug: string): string | null {
  if (!/^[a-z0-9][a-z0-9-]{2,48}[a-z0-9]$/.test(slug)) {
    return "Use 4-50 lowercase letters, numbers or hyphens.";
  }
  return null;
}

export function slugifyOfficialName(name: string): string {
  return name
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}

export function officialDescriptionError(description: string): string | null {
  const trimmed = description.trim();
  if (trimmed.length < 10) return "Add a short description of this office.";
  if (trimmed.length > OFFICIAL_DESCRIPTION_MAX) return "Keep the description under 600 characters.";
  return null;
}

export interface OfficialActor {
  userId: string;
  isUniversityAdmin: boolean;
  isUniversityModerator: boolean;
  staff?: { canPublishCritical: boolean } | null;
  isActiveStaff?: boolean;
}

export function canManageOfficialAccounts(actor: Pick<OfficialActor, "isUniversityAdmin">): boolean {
  return actor.isUniversityAdmin;
}

export function canPublishAsOfficial(
  actor: OfficialActor,
  account: { status: OfficialAccountStatus },
): boolean {
  if (account.status !== "ACTIVE") return false;
  if (actor.isUniversityAdmin) return true;
  return Boolean(actor.staff && actor.isActiveStaff);
}

export function canPublishCritical(
  actor: OfficialActor,
  account: { status: OfficialAccountStatus },
): boolean {
  if (account.status !== "ACTIVE") return false;
  if (actor.isUniversityAdmin) return true;
  return Boolean(actor.isActiveStaff && actor.staff?.canPublishCritical);
}

/** Announcements and events only; official accounts may never author posts. */
export const OFFICIAL_ALLOWED_CONTENT = ["ANNOUNCEMENT", "EVENT"] as const;
