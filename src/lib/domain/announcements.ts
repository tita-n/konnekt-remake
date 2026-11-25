import { canSee, type StudentPath } from "./academic";
import type { EventAudienceKind } from "./events";

/**
 * Announcement targeting, scheduling and privacy. An announcement is visible
 * only once PUBLISHED to the viewer's academic path; drafts, scheduled items,
 * archived items, other tenants and narrower audiences are indistinguishable
 * from a missing announcement.
 */

export type AnnouncementCategory = "ACADEMIC" | "ICT" | "EVENTS" | "STUDENT_AFFAIRS" | "GENERAL";
export type AnnouncementStatus = "DRAFT" | "SCHEDULED" | "PUBLISHED" | "ARCHIVED";

export const ANNOUNCEMENT_CATEGORIES: ReadonlyArray<{ value: AnnouncementCategory; label: string }> = [
  { value: "ACADEMIC", label: "Academic" },
  { value: "ICT", label: "ICT" },
  { value: "EVENTS", label: "Events" },
  { value: "STUDENT_AFFAIRS", label: "Student affairs" },
  { value: "GENERAL", label: "General" },
];

export const ANNOUNCEMENT_CATEGORY_LABELS: Record<AnnouncementCategory, string> = Object.fromEntries(
  ANNOUNCEMENT_CATEGORIES.map((entry) => [entry.value, entry.label]),
) as Record<AnnouncementCategory, string>;

export const ANNOUNCEMENT_STATUS_LABELS: Record<AnnouncementStatus, string> = {
  DRAFT: "Draft",
  SCHEDULED: "Scheduled",
  PUBLISHED: "Published",
  ARCHIVED: "Archived",
};

export const MAX_ANNOUNCEMENT_TITLE = 140;
export const MIN_ANNOUNCEMENT_TITLE = 3;
export const MAX_ANNOUNCEMENT_BODY = 5000;
export const MAX_ANNOUNCEMENT_ATTACHMENTS = 3;
export const MAX_ANNOUNCEMENT_ATTACHMENT_BYTES = 10 * 1024 * 1024;
export const MAX_SCHEDULE_DAYS = 30;
export const DAILY_ANNOUNCEMENT_LIMIT = 10;
export const DAILY_CRITICAL_LIMIT = 2;
export const ANNOUNCEMENT_PAGE_SIZE = 12;

export function isAnnouncementCategory(value: unknown): value is AnnouncementCategory {
  return typeof value === "string" && ANNOUNCEMENT_CATEGORIES.some((entry) => entry.value === value);
}

export function announcementCategoryLabel(value: AnnouncementCategory | string): string {
  return ANNOUNCEMENT_CATEGORY_LABELS[value as AnnouncementCategory] ?? "General";
}

export function announcementStatusLabel(value: AnnouncementStatus | string): string {
  return ANNOUNCEMENT_STATUS_LABELS[value as AnnouncementStatus] ?? String(value);
}

export interface AnnouncementVisibilityShape {
  status: AnnouncementStatus;
  audienceKind: EventAudienceKind;
  audiencePath: readonly (string | number)[];
  publishedAt?: Date | string | null;
  publishAt?: Date | string | null;
}

export function canSeeAnnouncement(
  viewerPath: StudentPath,
  announcement: AnnouncementVisibilityShape,
  now = new Date(),
): boolean {
  if (announcement.status !== "PUBLISHED") return false;
  if (announcement.audienceKind === "COMMUNITY") return false;
  const published = announcement.publishedAt ?? announcement.publishAt;
  if (!published || new Date(published).getTime() > now.getTime()) return false;
  if (announcement.audienceKind === "PUBLIC") {
    return announcement.audiencePath.length === 1 && announcement.audiencePath[0] === "PUBLIC";
  }
  if (announcement.audiencePath.length === 0) return false;
  return canSee(viewerPath, announcement.audiencePath);
}

/** Prisma filter for the announcements a viewer may see. */
export function visibleAnnouncementFilter(viewerPath: StudentPath, now = new Date()): {
  status: "PUBLISHED";
  publishedAt: { lte: Date };
  OR: Array<{ audienceKind: "PUBLIC" } | { audiencePath: { equals: string[] } }>;
} {
  const paths: string[][] = [["PUBLIC"]];
  for (let length = 2; length <= viewerPath.length; length += 1) {
    paths.push(viewerPath.slice(0, length).map(String));
  }
  return {
    status: "PUBLISHED",
    publishedAt: { lte: now },
    OR: paths.map((path) =>
      path.length === 1 && path[0] === "PUBLIC"
        ? { audienceKind: "PUBLIC" as const }
        : { audiencePath: { equals: path } },
    ),
  };
}

export function announcementTitleError(title: string): string | null {
  const trimmed = title.trim();
  if (trimmed.length < MIN_ANNOUNCEMENT_TITLE) return "Give the announcement a title.";
  if (trimmed.length > MAX_ANNOUNCEMENT_TITLE) return "Keep the title under 140 characters.";
  return null;
}

export function announcementBodyError(body: string): string | null {
  const trimmed = body.trim();
  if (!trimmed) return "Write the announcement body.";
  if (trimmed.length > MAX_ANNOUNCEMENT_BODY) return "Keep the body under 5,000 characters.";
  return null;
}

export function announcementAttachmentError(input: {
  count: number;
  mimeType: string;
  sizeBytes: number;
}): string | null {
  if (input.count > MAX_ANNOUNCEMENT_ATTACHMENTS) return "Attach at most 3 PDFs.";
  if (input.mimeType !== "application/pdf") return "Attachments must be PDF files.";
  if (input.sizeBytes > MAX_ANNOUNCEMENT_ATTACHMENT_BYTES) return "Each attachment can be at most 10 MB.";
  return null;
}

export function scheduleError(publishAt: Date, now = new Date()): string | null {
  const time = publishAt.getTime();
  if (Number.isNaN(time)) return "Choose a publish time.";
  if (time < now.getTime() - 60_000) return "Choose a publish time in the future.";
  if (time > now.getTime() + MAX_SCHEDULE_DAYS * 24 * 60 * 60 * 1000) {
    return "You can schedule up to 30 days ahead.";
  }
  return null;
}

export function resolveAnnouncementStatus(input: {
  publishNow: boolean;
  publishAt: Date;
  now?: Date;
}): { status: "PUBLISHED" | "SCHEDULED"; publishedAt: Date | null; error: string | null } {
  const now = input.now ?? new Date();
  if (input.publishNow) return { status: "PUBLISHED", publishedAt: now, error: null };
  const error = scheduleError(input.publishAt, now);
  if (error) return { status: "SCHEDULED", publishedAt: null, error };
  if (input.publishAt.getTime() <= now.getTime() + 60_000) {
    return { status: "PUBLISHED", publishedAt: now, error: null };
  }
  return { status: "SCHEDULED", publishedAt: null, error: null };
}

export function dayWindowStart(now = new Date()): Date {
  return new Date(now.getTime() - 24 * 60 * 60 * 1000);
}

/** Simple plain-text excerpt; never returns raw markdown markers. */
export function announcementExcerpt(body: string, length = 160): string {
  const clean = body
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/[*_`>#-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return clean.length <= length ? clean : `${clean.slice(0, length - 1).trimEnd()}…`;
}
