import { canSee, type AudiencePath, type StudentPath } from "./academic";
import type { AcademicLayer } from "./academic";

/**
 * Phase 1 audience rules, kept pure so the same decision is used by the feed
 * query, post detail, comments, reactions, bookmarks, hashtags and share links.
 *
 * PUBLIC posts always use the token path ["PUBLIC"]; every narrower audience is
 * a real prefix of the author's student path, and a viewer can see it only when
 * their own path starts with that prefix.
 */
export const PUBLIC_AUDIENCE: AudiencePath = ["PUBLIC"];
export const MAX_POST_LENGTH = 2000;
export const MAX_POLL_OPTIONS = 4;
export const MIN_POLL_OPTIONS = 2;
export const POLL_DURATIONS = [1, 3, 7] as const;
export const EDIT_LIMIT_MINUTES = 15;
/** Narrower audiences get a mild recency boost, never engagement ranking. */
export const AUDIENCE_BOOST_MINUTES = 10;

export type PostAudienceKind = "PUBLIC" | "COLLEGE" | "FACULTY" | "DEPARTMENT" | "LEVEL";

const RANK: Record<PostAudienceKind, number> = {
  PUBLIC: 0,
  COLLEGE: 1,
  FACULTY: 2,
  DEPARTMENT: 3,
  LEVEL: 4,
};

export function audienceRank(kind: PostAudienceKind): number {
  return RANK[kind] ?? 0;
}

/**
 * Feed ordering timestamp. Ten minutes per layer means a level post can sit
 * just above a slightly newer public post, but a day-old level post never
 * outranks fresh campus news.
 */
export function rankingTimestamp(createdAt: Date, kind: PostAudienceKind): Date {
  return new Date(createdAt.getTime() + audienceRank(kind) * AUDIENCE_BOOST_MINUTES * 60_000);
}

export function scopeForKind(kind: PostAudienceKind): "university" | AcademicLayer | "level" {
  if (kind === "PUBLIC") return "university";
  if (kind === "LEVEL") return "level";
  if (kind === "COLLEGE") return "college";
  if (kind === "FACULTY") return "faculty";
  return "department";
}

export function kindForScope(scope: "university" | AcademicLayer | "level"): PostAudienceKind {
  switch (scope) {
    case "university":
      return "PUBLIC";
    case "college":
      return "COLLEGE";
    case "faculty":
      return "FACULTY";
    case "department":
      return "DEPARTMENT";
    case "level":
      return "LEVEL";
  }
}

export interface AudiencePostShape {
  audiencePath: readonly (string | number)[];
  audienceKind: PostAudienceKind;
}

/**
 * The single visibility decision. The tenant client already guarantees the
 * post belongs to the viewer's university; the path check guarantees the
 * viewer sits inside the chosen audience.
 */
export function canSeePost(viewerPath: StudentPath, post: AudiencePostShape): boolean {
  if (post.audienceKind === "PUBLIC") {
    return post.audiencePath.length === 1 && post.audiencePath[0] === "PUBLIC";
  }
  const audience = post.audiencePath;
  if (audience.length === 0) return false;
  if (audience.length === 1 && audience[0] === "PUBLIC") return false;
  return canSee(viewerPath, audience);
}

/**
 * Prisma filter for "posts this viewer may see". It mirrors canSeePost exactly:
 * PUBLIC within the tenant, or an audience path that is a prefix of the viewer.
 */
export function visibleAudienceFilter(viewerPath: StudentPath): {
  OR: Array<{ audienceKind: "PUBLIC" } | { audiencePath: { equals: string[] } }>;
} {
  return {
    OR: visibleAudiencePaths(viewerPath).map((path) =>
      path.length === 1 && path[0] === "PUBLIC"
        ? { audienceKind: "PUBLIC" as const }
        : { audiencePath: { equals: path } },
    ),
  };
}

/** Audience paths the viewer can legitimately see, narrowest last. */
export function visibleAudiencePaths(viewerPath: StudentPath): string[][] {
  const paths: string[][] = [["PUBLIC"]];
  for (let length = 2; length <= viewerPath.length; length += 1) {
    paths.push(viewerPath.slice(0, length).map(String));
  }
  return paths;
}

/**
 * A repost inherits its original audience verbatim. This helper is the only
 * way a repost audience may be chosen, so it can never widen visibility.
 */
export function inheritedRepostAudience(original: AudiencePostShape): {
  audiencePath: string[];
  audienceKind: PostAudienceKind;
} {
  return {
    audiencePath: [...original.audiencePath].map(String),
    audienceKind: original.audienceKind,
  };
}

export function isMutuallyBlocked(viewerId: string, authorId: string, blocks: {
  blockedByViewer: ReadonlySet<string>;
  blockedViewer: ReadonlySet<string>;
}): boolean {
  return blocks.blockedByViewer.has(authorId) || blocks.blockedViewer.has(viewerId);
}

export function isMutedByViewer(viewerId: string, authorId: string, muted: ReadonlySet<string>): boolean {
  return viewerId !== authorId && muted.has(authorId);
}

/* ---------------------------- text parsing ---------------------------- */

// A hashtag may not be glued to a URL path or another word character, so
// "https://x.test/#frag" is not treated as a tag.
const HASHTAG_PATTERN = /(?<![/\p{L}\p{N}_])#([\p{L}\p{N}_]{1,50})/gu;
const MENTION_PATTERN = /(^|[^\p{L}\p{N}_@])@([a-zA-Z0-9_]{3,30})/gu;

export function parseHashtags(body: string): string[] {
  const tags = new Set<string>();
  for (const match of body.matchAll(HASHTAG_PATTERN)) {
    const tag = match[1]?.toLocaleLowerCase("en-NG");
    if (tag) tags.add(tag);
    if (tags.size >= 30) break;
  }
  return [...tags];
}

export function parseMentions(body: string): string[] {
  const handles = new Set<string>();
  for (const match of body.matchAll(MENTION_PATTERN)) {
    const handle = match[2]?.toLowerCase();
    if (handle) handles.add(handle);
    if (handles.size >= 20) break;
  }
  return [...handles];
}

export function normalizeTag(input: string): string | null {
  const tag = input.trim().replace(/^#/, "").toLocaleLowerCase("en-NG");
  return /^[\p{L}\p{N}_]{1,50}$/u.test(tag) ? tag : null;
}

export function normalizeBody(body: string): string {
  return body
    .normalize("NFKC")
    .toLocaleLowerCase("en-NG")
    .replace(/[\s\p{P}\p{S}]+/gu, " ")
    .trim();
}

/** Exact-duplicate spam within ten minutes; compare normalised bodies. */
export function isDuplicateBody(previous: string, next: string): boolean {
  return normalizeBody(previous) === normalizeBody(next);
}

const CONTACT_EMAIL = /[\p{L}\p{N}._%+-]+@[\p{L}\p{N}.-]+\.[\p{L}]{2,}/u;
const CONTACT_PHONE = /(?:\+?234|0)[\s-]?[789][01]\d(?:[\s-]?\d){7}/u;

/** Contact details are flagged for review, never silently blocked. */
export function findContactInfo(body: string): Array<"email" | "phone"> {
  const found: Array<"email" | "phone"> = [];
  if (CONTACT_EMAIL.test(body)) found.push("email");
  if (CONTACT_PHONE.test(body)) found.push("phone");
  return found;
}

/**
 * A deliberately small, explainable keyword list. Matches are flags for the
 * moderation queue; posts are still published and can be reviewed.
 */
const FLAGGED_TERMS = [
  "kill yourself",
  "kys",
  "i will kill you",
  "i'll kill you",
  "bomb the",
  "shoot you",
  "rape",
  "nude pics",
  "send nudes",
  "419",
  "yahoo yahoo",
  "cultist",
] as const;

export function findFlaggedTerms(body: string): string[] {
  const text = ` ${normalizeBody(body)} `;
  return FLAGGED_TERMS.filter((term) => text.includes(` ${normalizeBody(term)} `));
}

export function shouldFlagForReview(body: string): { flagged: boolean; reasons: string[] } {
  const reasons: string[] = [];
  for (const kind of findContactInfo(body)) {
    reasons.push(kind === "email" ? "contact_email" : "contact_phone");
  }
  for (const term of findFlaggedTerms(body)) reasons.push(`keyword:${term}`);
  return { flagged: reasons.length > 0, reasons };
}

export function excerpt(body: string, length = 140): string {
  const clean = body.replace(/\s+/g, " ").trim();
  return clean.length <= length ? clean : `${clean.slice(0, length - 1).trimEnd()}…`;
}

export function firstLine(body: string): string {
  return body.split("\n")[0]?.trim() ?? "";
}

/* ------------------------------ editing ------------------------------- */

export function isWithinEditWindow(createdAt: Date, now = new Date()): boolean {
  return now.getTime() - createdAt.getTime() <= EDIT_LIMIT_MINUTES * 60_000;
}

/** Everyone can edit their own text; the tag appears once the window closes. */
export function shouldShowEditedTag(editedAt: Date | null, createdAt: Date): boolean {
  if (!editedAt) return false;
  return editedAt.getTime() - createdAt.getTime() > EDIT_LIMIT_MINUTES * 60_000;
}

/* ------------------------------- polls -------------------------------- */

export function validatePollOptions(options: string[]): string | null {
  const cleaned = options.map((option) => option.trim()).filter(Boolean);
  if (cleaned.length < MIN_POLL_OPTIONS) return "Add at least two options.";
  if (cleaned.length > MAX_POLL_OPTIONS) return "A poll can have at most four options.";
  if (cleaned.some((option) => option.length > 80)) return "Keep each option under 80 characters.";
  const unique = new Set(cleaned.map((option) => option.toLowerCase()));
  if (unique.size !== cleaned.length) return "Each option needs to be different.";
  return null;
}

export function pollEndsAt(durationDays: number, now = new Date()): Date {
  const days = (POLL_DURATIONS as readonly number[]).includes(durationDays) ? durationDays : 1;
  return new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
}

export function pollIsOpen(endsAt: Date, now = new Date()): boolean {
  return endsAt.getTime() > now.getTime();
}

export function pollResultsVisible(input: {
  hasVoted: boolean;
  endsAt: Date;
  now?: Date;
}): boolean {
  return input.hasVoted || !pollIsOpen(input.endsAt, input.now ?? new Date());
}

export function pollPercentages(votes: number[]): number[] {
  const total = votes.reduce((sum, value) => sum + value, 0);
  if (total === 0) return votes.map(() => 0);
  const raw = votes.map((value) => (value / total) * 100);
  const floors = raw.map(Math.floor);
  let remainder = 100 - floors.reduce((sum, value) => sum + value, 0);
  const order = raw
    .map((value, index) => ({ index, fraction: value - Math.floor(value) }))
    .sort((a, b) => b.fraction - a.fraction);
  for (const entry of order) {
    if (remainder <= 0) break;
    floors[entry.index] = (floors[entry.index] ?? 0) + 1;
    remainder -= 1;
  }
  return floors;
}

/* ----------------------------- presentation ---------------------------- */

export function audienceLabel(
  kind: PostAudienceKind,
  labels: { college?: string; faculty?: string; department?: string } = {},
  names: { college?: string | null; faculty?: string | null; department?: string | null } = {},
): string {
  switch (kind) {
    case "PUBLIC":
      return "Public";
    case "COLLEGE":
      return names.college ? `${labels.college ?? "College"}: ${names.college}` : (labels.college ?? "My college");
    case "FACULTY":
      return names.faculty ? `${labels.faculty ?? "Faculty"}: ${names.faculty}` : (labels.faculty ?? "My faculty");
    case "DEPARTMENT":
      return names.department
        ? `${labels.department ?? "Department"}: ${names.department}`
        : (labels.department ?? "My department");
    case "LEVEL":
      return "My level";
  }
}

/** Filter chips, adapted to the layers this university actually has. */
export function feedFiltersFor(input: {
  labels: { college?: string; faculty?: string; department?: string };
  hasCollege: boolean;
  hasFaculty: boolean;
}): Array<{ value: "all" | "level" | "department" | "college" | "faculty" | "public"; label: string }> {
  const department = input.labels.department ?? "Department";
  const options: Array<{ value: "all" | "level" | "department" | "college" | "faculty" | "public"; label: string }> = [
    { value: "all", label: "All" },
    { value: "level", label: "My Level" },
    { value: "department", label: `My ${department}` },
  ];
  if (input.hasCollege) options.push({ value: "college", label: `My ${input.labels.college ?? "College"}` });
  else if (input.hasFaculty) options.push({ value: "faculty", label: `My ${input.labels.faculty ?? "Faculty"}` });
  options.push({ value: "public", label: "Public" });
  return options;
}

export function filterKindForLabel(filter: string): PostAudienceKind | "ALL" {
  switch (filter) {
    case "level":
      return "LEVEL";
    case "department":
      return "DEPARTMENT";
    case "college":
      return "COLLEGE";
    case "faculty":
      return "FACULTY";
    case "public":
      return "PUBLIC";
    default:
      return "ALL";
  }
}
