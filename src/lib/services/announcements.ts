import "server-only";
import type { Prisma } from "@prisma/client";
import { writeAudit } from "@/lib/audit";
import { tenantDb, type TenantClient } from "@/lib/db/tenant";
import {
  announcementAttachmentError,
  announcementBodyError,
  announcementExcerpt,
  announcementTitleError,
  canSeeAnnouncement,
  DAILY_ANNOUNCEMENT_LIMIT,
  DAILY_CRITICAL_LIMIT,
  resolveAnnouncementStatus,
  scheduleError,
  visibleAnnouncementFilter,
  type AnnouncementCategory,
  type AnnouncementStatus,
} from "@/lib/domain/announcements";
import { announcementAudienceIsAllowed, type EventAudienceKind } from "@/lib/domain/events";
import { canPublishAsOfficial, canPublishCritical } from "@/lib/domain/official";
import { SocialError } from "@/lib/posts/errors";
import { rateLimit } from "@/lib/security/rate-limit";
import { readLocalResource, signedResourceUrl } from "@/lib/media/resource-store";
import type { SocialViewer } from "./social";

export const ANNOUNCEMENT_NOT_AVAILABLE = new SocialError("This announcement isn't available.", 404, "not_available");

export const announcementSelect = {
  id: true,
  title: true,
  body: true,
  category: true,
  critical: true,
  audienceKind: true,
  audiencePath: true,
  status: true,
  publishAt: true,
  publishedAt: true,
  editedAt: true,
  archivedAt: true,
  createdAt: true,
  officialAccount: {
    select: { id: true, name: true, slug: true, avatarPublicId: true, category: true, status: true },
  },
  attachments: {
    orderBy: { createdAt: "asc" },
    select: { id: true, name: true, mimeType: true, sizeBytes: true },
  },
} satisfies Prisma.AnnouncementSelect;

export type AnnouncementRow = Prisma.AnnouncementGetPayload<{ select: typeof announcementSelect }>;

export function serializeAnnouncement(row: AnnouncementRow) {
  return {
    id: row.id,
    title: row.title,
    body: row.body,
    excerpt: announcementExcerpt(row.body),
    category: row.category,
    critical: row.critical,
    audienceKind: row.audienceKind,
    audiencePath: row.audiencePath,
    status: row.status,
    publishAt: row.publishAt.toISOString(),
    publishedAt: row.publishedAt?.toISOString() ?? null,
    editedAt: row.editedAt?.toISOString() ?? null,
    archivedAt: row.archivedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    officialAccount: row.officialAccount,
    attachments: row.attachments,
  };
}

export type SerializedAnnouncement = ReturnType<typeof serializeAnnouncement>;

/** Publish every due scheduled announcement exactly once. */
export async function publishDueAnnouncements(
  db: TenantClient,
  now = new Date(),
): Promise<{ published: number }> {
  const due = await db.announcement.findMany({
    where: { status: "SCHEDULED", publishAt: { lte: now } },
    select: { id: true, universityId: true, officialAccountId: true },
    take: 100,
  });
  let published = 0;
  for (const row of due) {
    // The conditional update is the idempotency claim: concurrent cron and
    // read-time fallbacks can both run, but only one publishes each row.
    const claimed = await db.announcement.updateMany({
      where: { id: row.id, status: "SCHEDULED", publishAt: { lte: now } },
      data: { status: "PUBLISHED", publishedAt: now },
    });
    if (claimed.count !== 1) continue;
    published += 1;
    await writeAudit({
      actorId: null,
      universityId: row.universityId,
      action: "announcement.publish.scheduled",
      targetType: "Announcement",
      targetId: row.id,
      metadata: { accountId: row.officialAccountId, automatic: true },
    });
  }
  return { published };
}

export async function listOfficialFeed(
  viewer: SocialViewer,
  options: {
    category?: AnnouncementCategory | null;
    unreadOnly?: boolean;
    cursor?: string | null;
    limit?: number;
  } = {},
): Promise<{
  announcements: Array<SerializedAnnouncement & { acknowledged: boolean }>;
  nextCursor: string | null;
}> {
  const db = tenantDb(viewer.universityId);
  await publishDueAnnouncements(db);
  const limit = Math.min(Math.max(options.limit ?? 12, 1), 30);
  const cursorDate = options.cursor ? new Date(options.cursor) : null;
  const rows = await db.announcement.findMany({
    where: {
      ...visibleAnnouncementFilter(viewer.studentPath),
      officialAccount: { status: "ACTIVE" },
      ...(options.category ? { category: options.category } : {}),
      ...(cursorDate && !Number.isNaN(cursorDate.getTime())
        ? { publishedAt: { lt: cursorDate } }
        : {}),
    },
    orderBy: [{ publishedAt: "desc" }, { id: "desc" }],
    take: limit + 1,
    select: announcementSelect,
  });
  const page = rows.slice(0, limit);
  const visible = page.filter((row) => canSeeAnnouncement(viewer.studentPath, row));
  const acks = await db.announcementAck.findMany({
    where: { userId: viewer.userId, announcementId: { in: visible.map((row) => row.id) } },
    select: { announcementId: true },
  });
  const acked = new Set(acks.map((row) => row.announcementId));
  const filtered = options.unreadOnly ? visible.filter((row) => !acked.has(row.id)) : visible;
  return {
    announcements: filtered.map((row) => ({
      ...serializeAnnouncement(row),
      acknowledged: acked.has(row.id),
    })),
    nextCursor: rows.length > limit ? page[page.length - 1]?.publishedAt?.toISOString() ?? null : null,
  };
}

export async function getAnnouncementDetail(
  viewer: SocialViewer,
  announcementId: string,
): Promise<{ announcement: SerializedAnnouncement; acknowledged: boolean }> {
  const db = tenantDb(viewer.universityId);
  await publishDueAnnouncements(db);
  const row = await db.announcement.findFirst({
    where: { id: announcementId, officialAccount: { status: "ACTIVE" } },
    select: announcementSelect,
  });
  if (!row || !canSeeAnnouncement(viewer.studentPath, row)) throw ANNOUNCEMENT_NOT_AVAILABLE;
  const ack = await db.announcementAck.findUnique({
    where: { announcementId_userId: { announcementId: row.id, userId: viewer.userId } },
    select: { id: true },
  });
  return { announcement: serializeAnnouncement(row), acknowledged: Boolean(ack) };
}

export async function acknowledgeAnnouncement(
  viewer: SocialViewer,
  announcementId: string,
): Promise<{ acknowledged: true; ackedAt: string }> {
  const limit = await rateLimit("announcementAck", viewer.userId);
  if (!limit.success) throw new SocialError("Try again in a moment.", 429, "rate_limited");
  const db = tenantDb(viewer.universityId);
  const row = await db.announcement.findFirst({
    where: { id: announcementId },
    select: announcementSelect,
  });
  if (!row || !canSeeAnnouncement(viewer.studentPath, row)) throw ANNOUNCEMENT_NOT_AVAILABLE;
  const existing = await db.announcementAck.findUnique({
    where: { announcementId_userId: { announcementId, userId: viewer.userId } },
    select: { ackedAt: true },
  });
  if (existing) return { acknowledged: true, ackedAt: existing.ackedAt.toISOString() };
  try {
    const created = await db.announcementAck.create({
      data: { universityId: viewer.universityId, announcementId, userId: viewer.userId },
      select: { ackedAt: true },
    });
    return { acknowledged: true, ackedAt: created.ackedAt.toISOString() };
  } catch (error) {
    if ((error as { code?: string }).code !== "P2002") throw error;
    const replay = await db.announcementAck.findUnique({
      where: { announcementId_userId: { announcementId, userId: viewer.userId } },
      select: { ackedAt: true },
    });
    if (!replay) throw error;
    return { acknowledged: true, ackedAt: replay.ackedAt.toISOString() };
  }
}

export interface AnnouncementBanner {
  critical: SerializedAnnouncement | null;
  official: SerializedAnnouncement | null;
}

/** Critical banner first; otherwise the latest unacknowledged official post. */
export async function getAnnouncementBanners(viewer: SocialViewer): Promise<AnnouncementBanner> {
  const db = tenantDb(viewer.universityId);
  await publishDueAnnouncements(db);
  const rows = await db.announcement.findMany({
    where: {
      ...visibleAnnouncementFilter(viewer.studentPath),
      officialAccount: { status: "ACTIVE" },
      acks: { none: { userId: viewer.userId } },
    },
    orderBy: [{ publishedAt: "desc" }],
    take: 10,
    select: announcementSelect,
  });
  const visible = rows.filter((row) => canSeeAnnouncement(viewer.studentPath, row));
  return {
    critical: visible.find((row) => row.critical) ? serializeAnnouncement(visible.find((row) => row.critical)!) : null,
    official: visible.find((row) => !row.critical) ? serializeAnnouncement(visible.find((row) => !row.critical)!) : null,
  };
}

/* ------------------------------ staff writes ------------------------------ */

export interface AnnouncementAttachmentInput {
  fileKey: string;
  name: string;
  mimeType: string;
  sizeBytes: number;
}

export interface CreateAnnouncementInput {
  officialAccountId: string;
  category: AnnouncementCategory;
  title: string;
  body: string;
  critical: boolean;
  audienceKind: EventAudienceKind;
  audiencePath: string[];
  publishNow: boolean;
  publishAt: Date;
  attachments?: AnnouncementAttachmentInput[];
  saveDraft?: boolean;
}

async function loadOfficialActor(
  db: TenantClient,
  viewer: SocialViewer,
  officialAccountId: string,
): Promise<{
  account: { id: string; status: "ACTIVE" | "SUSPENDED"; name: string };
  staff: { canPublishCritical: boolean } | null;
  canPost: boolean;
  canCritical: boolean;
}> {
  const account = await db.officialAccount.findFirst({
    where: { id: officialAccountId },
    select: { id: true, status: true, name: true },
  });
  if (!account) throw new SocialError("That official account isn't available.", 404, "not_available");
  const staff = await db.officialAccountStaff.findUnique({
    where: { officialAccountId_userId: { officialAccountId, userId: viewer.userId } },
    select: { canPublishCritical: true },
  });
  const actor = {
    userId: viewer.userId,
    isUniversityAdmin: viewer.isUniversityAdmin,
    isUniversityModerator: viewer.isUniversityModerator,
    staff,
    isActiveStaff: Boolean(staff),
  };
  return {
    account,
    staff,
    canPost: canPublishAsOfficial(actor, account),
    canCritical: canPublishCritical(actor, account),
  };
}

function validateAttachment(input: AnnouncementAttachmentInput): void {
  const error = announcementAttachmentError({
    count: 1,
    mimeType: input.mimeType,
    sizeBytes: input.sizeBytes,
  });
  if (error) throw new SocialError(error);
  if (!input.fileKey.startsWith("local:") && !/^[a-zA-Z0-9_/-]{3,200}$/.test(input.fileKey)) {
    throw new SocialError("That attachment is not valid.");
  }
  if (input.name.trim().length === 0 || input.name.length > 160) {
    throw new SocialError("Give the attachment a shorter name.");
  }
}

export async function createAnnouncement(
  viewer: SocialViewer,
  input: CreateAnnouncementInput,
): Promise<{ id: string; status: AnnouncementStatus }> {
  const db = tenantDb(viewer.universityId);
  const official = await loadOfficialActor(db, viewer, input.officialAccountId);
  if (!official.canPost) throw new SocialError("You don't have posting rights for this official account.", 403, "forbidden");
  if (input.critical && !official.canCritical) {
    throw new SocialError("Only admins and designated staff can publish critical announcements.", 403, "forbidden");
  }
  const titleError = announcementTitleError(input.title);
  if (titleError) throw new SocialError(titleError);
  const bodyError = announcementBodyError(input.body);
  if (bodyError) throw new SocialError(bodyError);
  if (!input.audienceKind || input.audienceKind === "COMMUNITY") throw new SocialError("Choose an audience for the announcement.");
  if (
    !announcementAudienceIsAllowed({
      isUniversityAdmin: viewer.isUniversityAdmin,
      viewerPath: viewer.studentPath,
      audienceKind: input.audienceKind,
      audiencePath: input.audiencePath,
    })
  ) {
    throw new SocialError("You can only target an audience your account may reach.", 403, "forbidden");
  }
  const attachments = input.attachments ?? [];
  if (attachments.length > 3) throw new SocialError("Attach at most 3 PDFs.");
  for (const attachment of attachments) validateAttachment(attachment);

  const limit = await rateLimit("announcementCreate", `${official.account.id}:${viewer.userId}`);
  if (!limit.success) throw new SocialError("This account has reached its daily announcement limit.", 429, "rate_limited");
  if (input.critical) {
    const criticalLimit = await rateLimit("announcementCritical", `${official.account.id}:${viewer.userId}`);
    if (!criticalLimit.success) throw new SocialError("This account can publish 2 critical announcements per day.", 429, "rate_limited");
    const recentCritical = await db.announcement.count({
      where: {
        officialAccountId: official.account.id,
        critical: true,
        createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
      },
    });
    if (recentCritical >= DAILY_CRITICAL_LIMIT) {
      throw new SocialError("This account can publish 2 critical announcements per day.", 429, "rate_limited");
    }
  }
  const recent = await db.announcement.count({
    where: {
      officialAccountId: official.account.id,
      createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
    },
  });
  if (recent >= DAILY_ANNOUNCEMENT_LIMIT) {
    throw new SocialError("This account has reached its daily announcement limit.", 429, "rate_limited");
  }

  const status: AnnouncementStatus = input.saveDraft
    ? "DRAFT"
    : resolveAnnouncementStatus({ publishNow: input.publishNow, publishAt: input.publishAt }).status;
  if (!input.saveDraft) {
    const schedule = resolveAnnouncementStatus({ publishNow: input.publishNow, publishAt: input.publishAt });
    if (schedule.error) throw new SocialError(schedule.error);
  }

  const created = await db.announcement.create({
    data: {
      universityId: viewer.universityId,
      officialAccountId: official.account.id,
      authorId: viewer.userId,
      category: input.category,
      title: input.title.trim(),
      body: input.body.trim(),
      critical: input.critical,
      audienceKind: input.audienceKind,
      audiencePath: input.audiencePath,
      status,
      publishAt: input.publishNow ? new Date() : input.publishAt,
      publishedAt: status === "PUBLISHED" ? new Date() : null,
      attachments: attachments.length
        ? {
            create: attachments.map((attachment) => ({
              universityId: viewer.universityId,
              fileKey: attachment.fileKey,
              name: attachment.name.trim(),
              mimeType: attachment.mimeType,
              sizeBytes: attachment.sizeBytes,
            })),
          }
        : undefined,
    },
    select: { id: true, status: true },
  });
  await writeAudit({
    actorId: viewer.userId,
    universityId: viewer.universityId,
    action: status === "PUBLISHED" ? "announcement.publish" : "announcement.create",
    targetType: "Announcement",
    targetId: created.id,
    metadata: { accountId: official.account.id, critical: input.critical, status, audienceKind: input.audienceKind },
  });
  return { id: created.id, status: created.status };
}

export async function updateAnnouncement(
  viewer: SocialViewer,
  announcementId: string,
  input: {
    title?: string;
    body?: string;
    category?: AnnouncementCategory;
    critical?: boolean;
    audienceKind?: EventAudienceKind;
    audiencePath?: string[];
    publishNow?: boolean;
    publishAt?: Date;
    saveDraft?: boolean;
    archive?: boolean;
  },
): Promise<{ id: string; status: AnnouncementStatus }> {
  const db = tenantDb(viewer.universityId);
  const row = await db.announcement.findFirst({
    where: { id: announcementId },
    select: { ...announcementSelect, officialAccountId: true },
  });
  if (!row) throw ANNOUNCEMENT_NOT_AVAILABLE;
  const official = await loadOfficialActor(db, viewer, row.officialAccountId);
  if (!official.canPost) throw new SocialError("You don't have posting rights for this official account.", 403, "forbidden");
  if (input.critical && !row.critical && !official.canCritical) {
    throw new SocialError("Only admins and designated staff can publish critical announcements.", 403, "forbidden");
  }
  if (input.audienceKind) {
    if (
      !announcementAudienceIsAllowed({
        isUniversityAdmin: viewer.isUniversityAdmin,
        viewerPath: viewer.studentPath,
        audienceKind: input.audienceKind,
        audiencePath: input.audiencePath ?? row.audiencePath,
      })
    ) {
      throw new SocialError("You can only target an audience your account may reach.", 403, "forbidden");
    }
  }
  const title = input.title ?? row.title;
  const body = input.body ?? row.body;
  const titleError = announcementTitleError(title);
  if (titleError) throw new SocialError(titleError);
  const bodyError = announcementBodyError(body);
  if (bodyError) throw new SocialError(bodyError);

  let status: AnnouncementStatus = row.status;
  let publishedAt = row.publishedAt;
  let archivedAt = row.archivedAt;
  if (input.archive) {
    status = "ARCHIVED";
    archivedAt = new Date();
  } else if (row.status === "DRAFT" || row.status === "SCHEDULED") {
    if (input.saveDraft) {
      status = "DRAFT";
    } else {
      const publishAt = input.publishAt ?? row.publishAt;
      const resolved = resolveAnnouncementStatus({ publishNow: input.publishNow === true, publishAt });
      if (resolved.error) throw new SocialError(resolved.error);
      status = resolved.status;
      publishedAt = resolved.publishedAt;
    }
  }

  const changed = title !== row.title || body !== row.body;
  const updated = await db.announcement.update({
    where: { id: announcementId },
    data: {
      title: title.trim(),
      body: body.trim(),
      category: input.category ?? row.category,
      critical: input.critical ?? row.critical,
      audienceKind: input.audienceKind ?? row.audienceKind,
      audiencePath: input.audiencePath ?? row.audiencePath,
      status,
      publishAt: input.publishAt ?? row.publishAt,
      publishedAt,
      archivedAt,
      editedAt: changed ? new Date() : row.editedAt,
    },
    select: { id: true, status: true },
  });
  await writeAudit({
    actorId: viewer.userId,
    universityId: viewer.universityId,
    action: "announcement.edit",
    targetType: "Announcement",
    targetId: announcementId,
    metadata: { status, archived: Boolean(input.archive), edited: changed },
  });
  return { id: updated.id, status: updated.status };
}

export async function getAnnouncementAttachment(
  viewer: SocialViewer,
  announcementId: string,
  attachmentId: string,
): Promise<{ name: string; mimeType: string; localBytes: Buffer | null; signedUrl: string | null }> {
  const db = tenantDb(viewer.universityId);
  const row = await db.announcement.findFirst({
    where: { id: announcementId },
    select: announcementSelect,
  });
  if (!row || !canSeeAnnouncement(viewer.studentPath, row)) throw ANNOUNCEMENT_NOT_AVAILABLE;
  const attachment = await db.announcementAttachment.findFirst({
    where: { id: attachmentId, announcementId },
    select: { fileKey: true, name: true, mimeType: true },
  });
  if (!attachment) throw new SocialError("That file isn't available.", 404, "not_available");
  if (attachment.fileKey.startsWith("local:")) {
    const bytes = await readLocalResource(attachment.fileKey);
    if (!bytes) throw new SocialError("That file isn't available.", 404, "not_available");
    return { name: attachment.name, mimeType: attachment.mimeType, localBytes: bytes, signedUrl: null };
  }
  const signedUrl = signedResourceUrl(attachment.fileKey, "pdf", 120);
  if (!signedUrl) throw new SocialError("That file is temporarily unavailable.", 503, "storage_unavailable");
  return { name: attachment.name, mimeType: attachment.mimeType, localBytes: null, signedUrl };
}

export async function listAdminAnnouncements(viewer: SocialViewer): Promise<{
  announcements: Array<SerializedAnnouncement & { ackCount: number; goingCount: number }>;
  accounts: Array<{ id: string; name: string; slug: string; category: string; status: string }>;
}> {
  if (!viewer.isUniversityAdmin && !viewer.isUniversityModerator) {
    throw new SocialError("You don't have access to the announcement console.", 403, "forbidden");
  }
  const db = tenantDb(viewer.universityId);
  await publishDueAnnouncements(db);
  const [rows, accounts] = await Promise.all([
    db.announcement.findMany({
      orderBy: [{ createdAt: "desc" }],
      take: 100,
      select: { ...announcementSelect, _count: { select: { acks: true } } },
    }),
    db.officialAccount.findMany({
      orderBy: [{ name: "asc" }],
      select: { id: true, name: true, slug: true, category: true, status: true },
    }),
  ]);
  return {
    announcements: rows.map((row) => ({
      ...serializeAnnouncement(row),
      ackCount: row._count.acks,
      goingCount: 0,
    })),
    accounts,
  };
}

export function scheduleValidation(publishAt: Date, now = new Date()): string | null {
  return scheduleError(publishAt, now);
}
