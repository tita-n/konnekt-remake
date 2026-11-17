import "server-only";
import type { University } from "@prisma/client";
import { platformDb } from "@/lib/db/platform";
import { tenantDb } from "@/lib/db/tenant";

/**
 * Public university directory. The finder only ever lists ACTIVE universities;
 * waitlisted and switched-off spaces are not discoverable by students.
 */
export interface PublicUniversity {
  id: string;
  name: string;
  shortName: string;
  slug: string;
  logoUrl: string | null;
  accentColor: string;
  labels: LayerLabels;
  idCardEnabled: boolean;
  vouchingEnabled: boolean;
  studentEmailDomains: string[];
  matricPattern: string;
  policyVersion: string;
}

export interface LayerLabels {
  college: string;
  faculty: string;
  department: string;
}

export const DEFAULT_LABELS: LayerLabels = {
  college: "College",
  faculty: "Faculty",
  department: "Department",
};

export function parseLabels(value: unknown): LayerLabels {
  const raw = (value ?? {}) as Record<string, unknown>;
  const pick = (key: keyof LayerLabels) =>
    typeof raw[key] === "string" && (raw[key] as string).trim() ? (raw[key] as string).trim() : DEFAULT_LABELS[key];
  return { college: pick("college"), faculty: pick("faculty"), department: pick("department") };
}

export function parseFeatureFlags(value: unknown): Record<string, boolean> {
  if (!value || typeof value !== "object") return {};
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .filter((entry): entry is [string, boolean] => typeof entry[1] === "boolean")
      .slice(0, 20),
  );
}

function toPublic(university: University): PublicUniversity {
  return {
    id: university.id,
    name: university.name,
    shortName: university.shortName,
    slug: university.slug,
    logoUrl: university.logoUrl,
    accentColor: university.accentColor,
    labels: parseLabels(university.labels),
    idCardEnabled: university.idCardEnabled,
    vouchingEnabled: university.vouchingEnabled,
    studentEmailDomains: university.studentEmailDomains,
    matricPattern: university.matricPattern,
    policyVersion: university.policyVersion,
  };
}

export async function listActiveUniversities(): Promise<PublicUniversity[]> {
  const rows = await platformDb.university.findMany({
    where: { status: "ACTIVE" },
    orderBy: { name: "asc" },
    take: 500,
    select: {
      id: true,
      name: true,
      shortName: true,
      slug: true,
      logoUrl: true,
      accentColor: true,
      status: true,
      labels: true,
      featureFlags: true,
      studentEmailDomains: true,
      idCardEnabled: true,
      vouchingEnabled: true,
      matricPattern: true,
      policyVersion: true,
      createdAt: true,
      updatedAt: true,
    },
  });
  return rows.map((row) => toPublic(row as University));
}

export async function findActiveUniversityBySlug(slug: string): Promise<PublicUniversity | null> {
  const row = await platformDb.university.findFirst({
    where: { slug, status: "ACTIVE" },
  });
  return row ? toPublic(row) : null;
}

/** University record for a signed-in tenant, read through the tenant client. */
export async function getTenantUniversity(universityId: string) {
  const db = tenantDb(universityId);
  // University is platform-owned; tenant code reads it via this explicit
  // directory accessor rather than the tenant client.
  const row = await platformDb.university.findUnique({ where: { id: universityId } });
  if (!row) throw new Error("University not found");
  return { ...row, labels: parseLabels(row.labels), featureFlags: parseFeatureFlags(row.featureFlags) };
}

export { toPublic };
