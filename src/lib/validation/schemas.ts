import { z } from "zod";
import { hexColourSchema } from "@/lib/domain/color";

/**
 * Shared validation. The same schemas run in the browser (instant feedback)
 * and on the server (authority). Never trust the client copy.
 */

export const emailSchema = z
  .string()
  .trim()
  .min(3, "Enter your email address.")
  .max(254, "That email address is too long.")
  .email("Enter a valid email address.")
  .transform((v) => v.toLowerCase());

export const usernameSchema = z
  .string()
  .trim()
  .min(3, "At least 3 characters.")
  .max(20, "At most 20 characters.")
  .regex(/^[a-z0-9_]+$/i, "Letters, numbers and underscores only.")
  .transform((v) => v.toLowerCase())
  .refine((v) => !/^[0-9]+$/.test(v), "Include at least one letter.")
  .refine(
    (v) => !["admin", "konnekt", "support", "official", "root", "moderator"].includes(v),
    "That username is reserved.",
  );

export const fullNameSchema = z
  .string()
  .trim()
  .min(2, "Enter your full name.")
  .max(80, "That name is too long.")
  .regex(/^[\p{L}\p{M}][\p{L}\p{M}'’.\- ]*$/u, "Use letters, spaces, apostrophes and hyphens.")
  .refine((v) => v.split(/\s+/).filter(Boolean).length >= 2, "Enter your first and last name.");

export const passwordSchema = z
  .string()
  .min(10, "Use at least 10 characters.")
  .max(128, "Use at most 128 characters.")
  .refine((v) => /[a-z]/.test(v) && /[A-Z]/.test(v), "Include upper and lower case letters.")
  .refine((v) => /\d/.test(v), "Include at least one number.");

export const codeSchema = z
  .string()
  .trim()
  .regex(/^\d{6}$/, "Enter the 6-digit code.");

export const bioSchema = z.string().trim().max(280, "Keep your bio under 280 characters.");

export const slugSchema = z
  .string()
  .trim()
  .min(2)
  .max(64)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Lowercase letters, numbers and hyphens only.");

export const universityNameSchema = z.string().trim().min(3, "Enter the university name.").max(120);

export const consentSchema = z.literal(true, { message: "You must accept the Terms and Privacy Policy." });

export const levelSchema = z.coerce
  .number()
  .int("Pick a level.")
  .min(100, "Pick a valid level.")
  .max(900, "Pick a valid level.");

export const interestsSchema = z
  .array(z.string().trim().min(2).max(32))
  .min(3, "Pick at least 3 interests.")
  .max(12, "Pick up to 12 interests.");

export const academicNodeTypeSchema = z.enum(["COLLEGE", "FACULTY", "DEPARTMENT"]);

export const visibilitySchema = z.enum(["EVERYONE", "UNIVERSITY", "NOBODY"]);

export const universitySettingsSchema = z.object({
  name: universityNameSchema,
  shortName: z.string().trim().min(2, "Short name is required.").max(24),
  accentColor: hexColourSchema,
  logoUrl: z.string().url().max(500).nullish(),
  studentEmailDomains: z.array(z.string().trim().min(3).max(120)).max(10).default([]),
  idCardEnabled: z.boolean().default(true),
  vouchingEnabled: z.boolean().default(false),
  matricPattern: z.string().trim().min(1).max(200),
});

export const decisionReasonSchema = z.enum([
  "MATRIC_MISMATCH",
  "ID_UNREADABLE",
  "DUPLICATE_ACCOUNT",
  "NOT_A_STUDENT",
  "EXPIRED_DOCUMENT",
  "FAKE_DOCUMENT",
  "OTHER",
]);

export const DECISION_REASON_LABELS: Record<z.infer<typeof decisionReasonSchema>, string> = {
  MATRIC_MISMATCH: "Matric number does not match the document",
  ID_UNREADABLE: "ID card or document is unreadable",
  DUPLICATE_ACCOUNT: "Another verified account already uses this matric number",
  NOT_A_STUDENT: "Document does not prove current studentship",
  EXPIRED_DOCUMENT: "Document is expired",
  FAKE_DOCUMENT: "Document appears altered or fake",
  OTHER: "Other (explain below)",
};

export type SignupInput = {
  universityId: string;
  fullName: string;
  username: string;
  email: string;
  password: string;
  consentPolicyVersion: string;
};
