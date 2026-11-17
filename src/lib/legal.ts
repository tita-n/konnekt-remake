import "server-only";
import { readFile } from "node:fs/promises";
import path from "node:path";

export const LEGAL_DOCS = {
  terms: "Terms of Service",
  privacy: "Privacy Policy",
  "community-rules": "Community Rules",
} as const;

export type LegalDoc = keyof typeof LEGAL_DOCS;

export function isLegalDoc(value: string): value is LegalDoc {
  return value in LEGAL_DOCS;
}

export interface LegalDocument {
  title: string;
  version: string;
  updated: string;
  body: string;
}

/**
 * Legal copy is versioned markdown committed with the code, so the policy a
 * user accepted is always recoverable from the repository history.
 */
export async function readLegalDoc(doc: LegalDoc): Promise<LegalDocument | null> {
  try {
    const file = await readFile(path.join(process.cwd(), "content", "legal", `${doc}.md`), "utf8");
    const match = file.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
    if (!match) return { title: LEGAL_DOCS[doc], version: "unknown", updated: "", body: file };
    const meta = Object.fromEntries(
      (match[1] ?? "")
        .split("\n")
        .map((line) => line.split(/:\s*/, 2))
        .filter((entry) => entry.length === 2),
    ) as Record<string, string>;
    return {
      title: meta.title ?? LEGAL_DOCS[doc],
      version: meta.version ?? "unknown",
      updated: meta.updated ?? "",
      body: match[2] ?? "",
    };
  } catch {
    return null;
  }
}
