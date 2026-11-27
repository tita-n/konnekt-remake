import { INTEREST_CATALOG } from "@/lib/domain/interests";
import type { Voucher } from "@/lib/services/vouchers";

/**
 * Preview-only fixtures for the auth directions. These mirror the fields the
 * live screens receive  and add no new ones.
 * Nothing here is seed data and nothing is written to a database.
 */

export type DirectionUniversity = {
  id: string;
  name: string;
  shortName: string;
  slug: string;
  accentColor: string;
  logoUrl: string | null;
  studentEmailDomains: string[];
  idCardEnabled: boolean;
  vouchingEnabled: boolean;
  matricPattern: string;
  policyVersion: string;
  labels: { college: string; faculty: string; department: string };
};

/** A tiny inline SVG so the "has a logo" state needs no asset and no network. */
function inlineLogo(mark: string, accent: string): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40"><rect width="40" height="40" rx="11" fill="${accent}"/><text x="20" y="26" font-family="Inter,system-ui,sans-serif" font-size="15" font-weight="700" fill="#fff" text-anchor="middle">${mark}</text></svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

/**
 * Four deliberately awkward cases: the default indigo campus, a green campus
 * that has a logo, an orange campus, and a name long enough to break a
 * one-line header with no logo at all.
 */
export const UNIVERSITIES: DirectionUniversity[] = [
  {
    id: "nova",
    name: "Nova University",
    shortName: "Nova",
    slug: "nova",
    accentColor: "#4f46e5",
    logoUrl: null,
    studentEmailDomains: ["student.nova.edu.ng"],
    idCardEnabled: true,
    vouchingEnabled: true,
    matricPattern: "^[A-Z]{3}/\d{4}/\d{4}$",
    policyVersion: "2026-04",
    labels: { college: "College", faculty: "Faculty", department: "Department" },
  },
  {
    id: "riddy",
    name: "Riddy University of Technology",
    shortName: "Riddy",
    slug: "riddy",
    accentColor: "#1b7f5a",
    logoUrl: inlineLogo("RU", "#1b7f5a"),
    studentEmailDomains: ["riddy.edu.ng", "st.riddy.edu.ng"],
    idCardEnabled: true,
    vouchingEnabled: false,
    matricPattern: "^RID/\d{2}$",
    policyVersion: "2026-02",
    labels: { college: "School", faculty: "Division", department: "Course" },
  },
  {
    id: "katsina-arts",
    name: "University of Katsina Arts & Sciences",
    shortName: "UKAS",
    slug: "ukas",
    accentColor: "#c2410c",
    logoUrl: inlineLogo("UK", "#c2410c"),
    studentEmailDomains: ["ukas.edu.ng"],
    idCardEnabled: false,
    vouchingEnabled: true,
    matricPattern: "^\d{2}/\d{4}$",
    policyVersion: "2026-01",
    labels: { college: "College", faculty: "Faculty", department: "Department" },
  },
  {
    id: "long",
    name: "Federal University of Petroleum Resources and Maritime Technology, Warri",
    shortName: "FUPREMT Warri",
    slug: "fupremt",
    accentColor: "#4f46e5",
    logoUrl: null,
    studentEmailDomains: ["fupremt.edu.ng"],
    idCardEnabled: true,
    vouchingEnabled: false,
    matricPattern: "^[A-Z]{2}\d{6}$",
    policyVersion: "2025-11",
    labels: { college: "College", faculty: "Faculty", department: "Department" },
  },
];

export type DirectionVoucher = Voucher;

export const VOUCHERS: DirectionVoucher[] = [
  {
    id: "v-1",
    fullName: "Ngozi Eze",
    username: "ngozi_eze",
    photoUrl: null,
    roleLabel: "Course rep",
    departmentName: "Software Engineering",
    level: 300,
  },
  {
    id: "v-2",
    fullName: "Ibrahim Musa",
    username: "ibrahim_musa",
    photoUrl: null,
    roleLabel: "Reviewer",
    departmentName: "Mechatronics",
    level: 400,
  },
];

export const DEPARTMENT_CHOICES = [
  { id: "d-1", name: "Software Engineering", levelCount: 5 },
  { id: "d-2", name: "Mechatronics", levelCount: 5 },
  { id: "d-3", name: "Mass Communication", levelCount: 4 },
];

export const LEVELS = [100, 200, 300, 400, 500];

export const INTERESTS = [...INTEREST_CATALOG];

/** Mirrors matricExample() in src/app/(auth)/signup/[slug]/id/page.tsx. */
export function matricExample(pattern: string): string {
  if (pattern.includes("[A-Z]") && pattern.includes("\d{4}")) return "CSC/2022/1041";
  if (pattern.includes("\d{2}/\d{4}")) return "20/1234/001";
  if (pattern.includes("\d{6}")) return "FW240019";
  return "190404021";
}

/** The three benefit lines every direction must show, in the direction's tone. */
export const BENEFITS = {
  verified: "Only verified students from your university",
  together: "Your department, communities and events in one place",
  official: "Official notices that actually reach you",
} as const;

export const TIME_ESTIMATE = "Takes about two minutes";
