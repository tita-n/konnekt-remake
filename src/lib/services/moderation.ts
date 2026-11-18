import "server-only";
import type { ReportReason, ReportTargetType } from "@prisma/client";
import type { SessionUser } from "@/lib/auth/guards";
import { writeAudit } from "@/lib/audit";
import { tenantDb, withTenantTransaction } from "@/lib/db/tenant";
import { canSeePost } from "@/lib/domain/posts";
import { SocialError } from "@/lib/posts/errors";
import { rateLimit } from "@/lib/security/rate-limit";
import { isHiddenAuthor, loadRelationships, type SocialViewer } from "./social";

export const REPORT_REASON_LABELS: Record<ReportReason, string> = {
  SPAM: "Spam",
  HARASSMENT: "Harassment or bullying",
  HATE_OR_ABUSE: "Hate or abuse",
  NUDITY_OR_SEXUAL_CONTENT: "Nudity or sexual content",
  VIOLENCE_OR_THREATS: "Violence or threats",
  IMPERSONATION: "Impersonation",
  FALSE_INFORMATION: "False information",
  SOMETHING_ELSE: "Something else",
};

export const REPORT_REASONS = Object.keys(REPORT_REASON_LABELS) as ReportReason[];

const REASON_WEIGHT: Record<ReportReason, number> = {
  SPAM: 1,
  HARASSMENT: 3,
  HATE_OR_ABUSE: 3,
  NUDITY_OR_SEXUAL_CONTENT: 2,
  VIOLENCE_OR_THREATS: 3,
  IMPERSONATION: 2,
  FALSE_INFORMATION: 1,
  SOMETHING_ELSE: 1,
};

export function reportSeverity(reporterCount: number, reasons: ReportReason[]): "high" | "medium" | "low" {
  const weighted = reasons.reduce((max, reason) => Math.max(max, REASON_WEIGHT[reason] ?? 1), 1);
  if (weighted >= 3 || reporterCount >= 3) return "high";
  if (weighted === 2 || reporterCount === 2) return "medium";
  return "low";
}

/**
 * Report a post or comment. Authors cannot report their own content, one
 * student can report a target once, and reporter identity is never exposed by
 * any read path outside the moderation console (which only shows counts).
 */
export async function reportContent(
  viewer: SocialViewer,
  input: { targetType: ReportTargetType; targetId: string; reason: ReportReason; details?: string },
): Promise<{ id: string }> {
  const limit = await rateLimit(viewer.accountAgeHours < 24 ? "reportYoung" : "report", viewer.userId);
  if (!limit.success) throw new SocialError("You've sent a lot of reports today. Our team will catch up first.", 429);
  if (!REPORT_REASONS.includes(input.reason)) throw new SocialError("Choose a reason for the report.");
  const details = typeof input.details === "string" ? input.details.trim().slice(0, 500) : "";
  const db = tenantDb(viewer.universityId);

  let authorId: string;
  if (input.targetType === "POST") {
    const post = await db.post.findFirst({
      where: { id: input.targetId },
      select: { id: true, status: true, authorId: true, audiencePath: true, audienceKind: true },
    });
    if (!post || post.status !== "ACTIVE" || !canSeePost(viewer.studentPath, post)) {
      throw new SocialError("This post isn't available.", 404);
    }
    const relationships = await loadRelationships(db, viewer.userId);
    if (isHiddenAuthor(relationships, post.authorId, viewer.userId)) throw new SocialError("This post isn't available.", 404);
    authorId = post.authorId;
  } else {
    const comment = await db.comment.findFirst({
      where: { id: input.targetId },
      select: {
        id: true,
        status: true,
        authorId: true,
        post: { select: { status: true, audiencePath: true, audienceKind: true, authorId: true } },
      },
    });
    if (!comment || comment.status !== "ACTIVE" || comment.post.status !== "ACTIVE" || !canSeePost(viewer.studentPath, comment.post)) {
      throw new SocialError("This comment isn't available.", 404);
    }
    const relationships = await loadRelationships(db, viewer.userId);
    if (isHiddenAuthor(relationships, comment.authorId, viewer.userId)) {
      throw new SocialError("This comment isn't available.", 404);
    }
    authorId = comment.authorId;
  }
  if (authorId === viewer.userId) throw new SocialError("You can't report your own content.");

  const existing = await db.report.findFirst({
    where: { reporterId: viewer.userId, targetType: input.targetType, targetId: input.targetId },
    select: { id: true },
  });
  if (existing) throw new SocialError("You've already reported this. Our moderators are on it.");

  const created = await db.report.create({
    data: {
      universityId: viewer.universityId,
      reporterId: viewer.userId,
      targetType: input.targetType,
      targetId: input.targetId,
      reason: input.reason,
      details: details || null,
    },
    select: { id: true },
  });
  return created;
}

/* --------------------------- mute and block --------------------------- */

export async function toggleMute(viewer: SocialViewer, username: string): Promise<{ muted: boolean }> {
  const db = tenantDb(viewer.universityId);
  const target = await db.user.findFirst({
    where: { username: username.toLowerCase(), status: { in: ["VERIFIED", "ALUMNI"] } },
    select: { id: true },
  });
  if (!target || target.id === viewer.userId) throw new SocialError("That student isn't available.");
  const existing = await db.mute.findFirst({ where: { userId: viewer.userId, mutedUserId: target.id } });
  if (existing) {
    await db.mute.delete({ where: { id: existing.id } });
    return { muted: false };
  }
  await db.mute.create({ data: { universityId: viewer.universityId, userId: viewer.userId, mutedUserId: target.id } });
  return { muted: true };
}

export async function toggleBlock(viewer: SocialViewer, username: string): Promise<{ blocked: boolean }> {
  const db = tenantDb(viewer.universityId);
  const target = await db.user.findFirst({
    where: { username: username.toLowerCase(), status: { in: ["VERIFIED", "ALUMNI"] } },
    select: { id: true },
  });
  if (!target || target.id === viewer.userId) throw new SocialError("That student isn't available.");
  const existing = await db.block.findFirst({ where: { userId: viewer.userId, blockedUserId: target.id } });
  if (existing) {
    await db.block.delete({ where: { id: existing.id } });
    return { blocked: false };
  }
  await db.block.create({
    data: { universityId: viewer.universityId, userId: viewer.userId, blockedUserId: target.id },
  });
  return { blocked: true };
}

export interface RestrictedStudentView {
  id: string;
  username: string;
  fullName: string;
  photoUrl: string | null;
  departmentName: string | null;
  level: number | null;
}

export async function listRestrictedStudents(viewer: SocialViewer): Promise<{
  blocked: RestrictedStudentView[];
  muted: RestrictedStudentView[];
}> {
  const db = tenantDb(viewer.universityId);
  const [blocks, mutes] = await Promise.all([
    db.block.findMany({ where: { userId: viewer.userId }, orderBy: { createdAt: "desc" }, select: { blockedUserId: true } }),
    db.mute.findMany({ where: { userId: viewer.userId }, orderBy: { createdAt: "desc" }, select: { mutedUserId: true } }),
  ]);
  const ids = [...new Set([...blocks.map((row) => row.blockedUserId), ...mutes.map((row) => row.mutedUserId)])];
  const users = ids.length
    ? await db.user.findMany({
        where: { id: { in: ids } },
        select: {
          id: true,
          username: true,
          fullName: true,
          photoUrl: true,
          level: true,
          department: { select: { name: true } },
        },
      })
    : [];
  const byId = new Map(
    users.map((user) => [
      user.id,
      {
        id: user.id,
        username: user.username,
        fullName: user.fullName,
        photoUrl: user.photoUrl,
        departmentName: user.department?.name ?? null,
        level: user.level,
      },
    ]),
  );
  return {
    blocked: blocks.flatMap((row) => { const user = byId.get(row.blockedUserId); return user ? [user] : []; }),
    muted: mutes.flatMap((row) => { const user = byId.get(row.mutedUserId); return user ? [user] : []; }),
  };
}

/* ------------------------- moderation console ------------------------- */

export function isModerator(user: SessionUser): boolean {
  return user.roles.some(
    (role) => role.universityId === user.universityId && (role.role === "UNIVERSITY_ADMIN" || role.role === "MODERATOR"),
  );
}

export function assertModerator(user: SessionUser): void {
  if (!isModerator(user)) throw new SocialError("You don't have access to moderation.", 403);
}

export interface ReportQueueItem {
  id: string;
  reason: ReportReason;
  reasonLabel: string;
  severity: "high" | "medium" | "low";
  reporterCount: number;
  status: "PENDING" | "RESOLVED";
  createdAt: string;
  targetType: ReportTargetType;
  targetId: string;
  excerpt: string;
  authorName: string;
  authorUsername: string;
}

export async function listReports(
  user: SessionUser,
  filter: { status?: "PENDING" | "RESOLVED"; type?: "ALL" | "POST" | "COMMENT" } = {},
): Promise<ReportQueueItem[]> {
  assertModerator(user);
  const db = tenantDb(user.universityId);
  const rows = await db.report.findMany({
    where: {
      status: filter.status ?? "PENDING",
      ...(filter.type && filter.type !== "ALL" ? { targetType: filter.type } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: 100,
    select: {
      id: true,
      reason: true,
      status: true,
      createdAt: true,
      targetType: true,
      targetId: true,
      reporterId: true,
    },
  });
  if (rows.length === 0) return [];

  const postIds = rows.filter((row) => row.targetType === "POST").map((row) => row.targetId);
  const commentIds = rows.filter((row) => row.targetType === "COMMENT").map((row) => row.targetId);
  const [posts, comments, grouped] = await Promise.all([
    postIds.length
      ? db.post.findMany({
          where: { id: { in: postIds } },
          select: { id: true, body: true, author: { select: { fullName: true, username: true } } },
        })
      : Promise.resolve([]),
    commentIds.length
      ? db.comment.findMany({
          where: { id: { in: commentIds } },
          select: { id: true, body: true, author: { select: { fullName: true, username: true } } },
        })
      : Promise.resolve([]),
    db.report.groupBy({
      by: ["targetType", "targetId"],
      where: { status: "PENDING" },
      _count: { reporterId: true },
    }),
  ]);
  const postsById = new Map(posts.map((post) => [post.id, post]));
  const commentsById = new Map(comments.map((comment) => [comment.id, comment]));
  const counts = new Map(grouped.map((row) => [`${row.targetType}:${row.targetId}`, row._count.reporterId]));
  const reasonsByTarget = new Map<string, ReportReason[]>();
  for (const row of rows) {
    const key = `${row.targetType}:${row.targetId}`;
    const list = reasonsByTarget.get(key) ?? [];
    list.push(row.reason);
    reasonsByTarget.set(key, list);
  }

  return rows.map((row) => {
    const post = postsById.get(row.targetId);
    const comment = commentsById.get(row.targetId);
    const target = post ?? comment;
    const key = `${row.targetType}:${row.targetId}`;
    const reporterCount = counts.get(key) ?? 1;
    const excerptSource = target?.body ?? "Content unavailable";
    return {
      id: row.id,
      reason: row.reason,
      reasonLabel: REPORT_REASON_LABELS[row.reason],
      severity: reportSeverity(reporterCount, reasonsByTarget.get(key) ?? [row.reason]),
      reporterCount,
      status: row.status,
      createdAt: row.createdAt.toISOString(),
      targetType: row.targetType,
      targetId: row.targetId,
      excerpt: excerptSource.replace(/\s+/g, " ").slice(0, 150),
      authorName: target?.author.fullName ?? "Unknown",
      authorUsername: target?.author.username ?? "unknown",
    };
  });
}

export interface ReportDetail {
  id: string;
  status: "PENDING" | "RESOLVED";
  createdAt: string;
  reason: ReportReason;
  reasonLabel: string;
  details: string | null;
  severity: "high" | "medium" | "low";
  reporterCount: number;
  targetType: ReportTargetType;
  targetId: string;
  target: {
    body: string;
    status: "ACTIVE" | "REMOVED";
    createdAt: string;
    authorId: string;
    authorName: string;
    authorUsername: string;
    authorStatus: string;
    previousReports: number;
    activeStrikes: number;
    media: Array<{ url: string; width: number; height: number }>;
  } | null;
  activity: Array<{ id: string; action: string; reason: string; createdAt: string; moderatorName: string }>;
}

export async function getReportDetail(user: SessionUser, reportId: string): Promise<ReportDetail | null> {
  assertModerator(user);
  const db = tenantDb(user.universityId);
  const report = await db.report.findFirst({
    where: { id: reportId },
    select: {
      id: true,
      status: true,
      createdAt: true,
      reason: true,
      details: true,
      targetType: true,
      targetId: true,
    },
  });
  if (!report) return null;

  const target =
    report.targetType === "POST"
      ? await db.post.findFirst({
          where: { id: report.targetId },
          select: {
            body: true,
            status: true,
            createdAt: true,
            authorId: true,
            author: { select: { fullName: true, username: true, status: true } },
            media: { orderBy: { order: "asc" }, select: { publicId: true, url: true, width: true, height: true } },
          },
        })
      : await db.comment.findFirst({
          where: { id: report.targetId },
          select: {
            body: true,
            status: true,
            createdAt: true,
            authorId: true,
            author: { select: { fullName: true, username: true, status: true } },
          },
        });
  const authorId = target?.authorId ?? null;
  const [reportCount, strikes, actions, allReasons] = await Promise.all([
    authorId ? db.report.count({ where: { targetType: report.targetType, targetId: report.targetId } }) : Promise.resolve(1),
    authorId ? activeStrikes(db, authorId) : Promise.resolve(0),
    db.moderationAction.findMany({
      where: { targetType: report.targetType, targetId: report.targetId },
      orderBy: { createdAt: "desc" },
      take: 20,
      select: { id: true, action: true, reason: true, createdAt: true, moderator: { select: { fullName: true } } },
    }),
    db.report.findMany({
      where: { targetType: report.targetType, targetId: report.targetId },
      select: { reason: true },
    }),
  ]);
  const authorPostIds = authorId
    ? (await db.post.findMany({ where: { authorId }, select: { id: true } })).map((row) => row.id)
    : [];
  const authorCommentIds = authorId
    ? (await db.comment.findMany({ where: { authorId }, select: { id: true } })).map((row) => row.id)
    : [];
  const previousReports = authorId
    ? await db.report.count({
        where: {
          id: { not: report.id },
          ...(report.targetType === "POST"
            ? { targetType: "POST" as const, targetId: { in: authorPostIds, not: report.targetId } }
            : { targetType: "COMMENT" as const, targetId: { in: authorCommentIds, not: report.targetId } }),
        },
      })
    : 0;

  return {
    id: report.id,
    status: report.status,
    createdAt: report.createdAt.toISOString(),
    reason: report.reason,
    reasonLabel: REPORT_REASON_LABELS[report.reason],
    details: report.details,
    severity: reportSeverity(reportCount, allReasons.map((row) => row.reason)),
    reporterCount: reportCount,
    targetType: report.targetType,
    targetId: report.targetId,
    target: target
      ? {
          body: target.body,
          status: target.status === "ACTIVE" ? "ACTIVE" : "REMOVED",
          createdAt: target.createdAt.toISOString(),
          authorId: target.authorId,
          authorName: target.author.fullName,
          authorUsername: target.author.username,
          authorStatus: target.author.status,
          previousReports,
          activeStrikes: strikes,
          media:
            report.targetType === "POST"
              ? ((target as { media?: Array<{ url: string | null; width: number; height: number }> }).media ?? []).flatMap(
                  (media) => (media.url ? [{ url: media.url, width: media.width, height: media.height }] : []),
                )
              : [],
        }
      : null,
    activity: actions.map((action) => ({
      id: action.id,
      action: action.action,
      reason: action.reason,
      createdAt: action.createdAt.toISOString(),
      moderatorName: action.moderator.fullName,
    })),
  };
}

async function activeStrikes(db: ReturnType<typeof tenantDb>, userId: string): Promise<number> {
  return db.strike.count({
    where: {
      userId,
      expiresAt: { gt: new Date() },
      createdAt: { gte: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000) },
    },
  });
}

export type ModerationDecision = "REMOVE" | "KEEP" | "WARN" | "SUSPEND";

/**
 * Apply a moderation decision. Every branch is tenant-scoped, role-checked on
 * the server, resolves the report, and appends to the audit log. Three active
 * strikes in 90 days flags the account for admin review; it never auto-bans.
 */
export async function moderateReport(
  user: SessionUser,
  input: {
    reportId: string;
    decision: ModerationDecision;
    reason: string;
    durationDays?: 1 | 7 | 30 | null;
    ip?: string | null;
  },
): Promise<{ strikes: number; flagged: boolean }> {
  assertModerator(user);
  const reason = input.reason.trim();
  if (reason.length < 8) throw new SocialError("Give a clear reason (at least 8 characters).");
  if (reason.length > 500) throw new SocialError("Keep the reason under 500 characters.");
  const db = tenantDb(user.universityId);
  const report = await db.report.findFirst({
    where: { id: input.reportId },
    select: { id: true, targetType: true, targetId: true, status: true, reason: true },
  });
  if (!report) throw new SocialError("That report isn't available.");

  const target =
    report.targetType === "POST"
      ? await db.post.findFirst({
          where: { id: report.targetId },
          select: { id: true, authorId: true, status: true },
        })
      : await db.comment.findFirst({
          where: { id: report.targetId },
          select: { id: true, authorId: true, status: true, postId: true },
        });
  if (!target) throw new SocialError("The reported content no longer exists.");
  const authorId = target.authorId;

  const flags = shouldFlagStrikeCount(input.decision);
  const expiresAt = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000);

  const result = await withTenantTransaction(user.universityId, async (tx) => {
    if (input.decision === "REMOVE") {
      if (report.targetType === "POST") {
        await tx.post.update({
          where: { id: target.id },
          data: {
            status: "REMOVED",
            moderationReason: reason,
            removedAt: new Date(),
          },
        });
        if (authorId) {
          await tx.comment.updateMany({ where: { postId: target.id }, data: { status: "REMOVED", moderationReason: reason } });
        }
      } else {
        await tx.comment.update({
          where: { id: target.id },
          data: { status: "REMOVED", moderationReason: reason, removedAt: new Date() },
        });
        if (authorId) {
          await tx.post.updateMany({
            where: { acceptedCommentId: target.id },
            data: { acceptedCommentId: null },
          });
        }
      }
    }

    if (input.decision === "SUSPEND" && authorId) {
      const duration = input.durationDays ?? null;
      await tx.user.update({
        where: { id: authorId },
        data: {
          status: "SUSPENDED",
          suspendedUntil: duration ? new Date(Date.now() + duration * 24 * 60 * 60 * 1000) : null,
        },
      });
      await tx.session.updateMany({ where: { userId: authorId, revokedAt: null }, data: { revokedAt: new Date() } });
    }

    const action = await tx.moderationAction.create({
      data: {
        universityId: user.universityId,
        reportId: report.id,
        moderatorId: user.id,
        targetType: report.targetType,
        targetId: report.targetId,
        action: input.decision,
        reason,
        durationDays: input.decision === "SUSPEND" ? (input.durationDays ?? null) : null,
      },
      select: { id: true },
    });

    if (flags && authorId) {
      await tx.strike.create({
        data: {
          universityId: user.universityId,
          userId: authorId,
          moderationActionId: action.id,
          expiresAt,
        },
      });
    }

    await tx.report.update({ where: { id: report.id }, data: { status: "RESOLVED", resolvedAt: new Date(), resolvedById: user.id } });
    if (input.decision !== "KEEP") {
      await tx.report.updateMany({
        where: { targetType: report.targetType, targetId: report.targetId, status: "PENDING" },
        data: { status: "RESOLVED", resolvedAt: new Date(), resolvedById: user.id },
      });
    }

    const strikes = authorId ? await activeStrikes(tx, authorId) : 0;
    let flagged = false;
    if (authorId && strikes >= 3) {
      await tx.user.update({ where: { id: authorId }, data: { flaggedForReviewAt: new Date() } });
      flagged = true;
    }
    return { strikes, flagged, actionId: action.id, authorId };
  });

  await writeAudit({
    actorId: user.id,
    universityId: user.universityId,
    action: `moderation.${input.decision.toLowerCase()}`,
    targetType: report.targetType,
    targetId: report.targetId,
    metadata: {
      reportId: report.id,
      reason,
      durationDays: input.durationDays ?? null,
      strikes: result.strikes,
      flagged: result.flagged,
      actionId: result.actionId,
    },
    ip: input.ip,
  });
  if (result.flagged) {
    await writeAudit({
      actorId: user.id,
      universityId: user.universityId,
      action: "moderation.strike_threshold",
      targetType: "User",
      targetId: result.authorId,
      metadata: { strikes: result.strikes },
      ip: input.ip,
    });
  }
  return { strikes: result.strikes, flagged: result.flagged };
}

function shouldFlagStrikeCount(decision: ModerationDecision): boolean {
  return decision === "REMOVE" || decision === "WARN" || decision === "SUSPEND";
}

export interface StudentModerationHistory {
  user: {
    id: string;
    username: string;
    fullName: string;
    photoUrl: string | null;
    status: string;
    level: number | null;
    departmentName: string | null;
  };
  activeStrikes: number;
  reportsAgainst: number;
  history: Array<{
    id: string;
    action: string;
    reason: string;
    label: string;
    reasonLabel: string;
    createdAt: string;
    moderatorName: string;
    durationDays: number | null;
  }>;
}

export async function getStudentModerationHistory(
  user: SessionUser,
  studentId: string,
): Promise<StudentModerationHistory | null> {
  assertModerator(user);
  const db = tenantDb(user.universityId);
  const student = await db.user.findFirst({
    where: { id: studentId },
    select: {
      id: true,
      username: true,
      fullName: true,
      photoUrl: true,
      status: true,
      level: true,
      department: { select: { name: true } },
    },
  });
  if (!student) return null;
  const [strikes, reports, actions] = await Promise.all([
    activeStrikes(db, studentId),
    db.report.count({
      where: {
        OR: [
          { targetType: "POST", targetId: { in: (await db.post.findMany({ where: { authorId: studentId }, select: { id: true } })).map((row) => row.id) } },
          { targetType: "COMMENT", targetId: { in: (await db.comment.findMany({ where: { authorId: studentId }, select: { id: true } })).map((row) => row.id) } },
        ],
      },
    }),
    db.moderationAction.findMany({
      where: {
        OR: [
          { targetType: "POST", targetId: { in: (await db.post.findMany({ where: { authorId: studentId }, select: { id: true } })).map((row) => row.id) } },
          { targetType: "COMMENT", targetId: { in: (await db.comment.findMany({ where: { authorId: studentId }, select: { id: true } })).map((row) => row.id) } },
        ],
      },
      orderBy: { createdAt: "desc" },
      take: 50,
      select: {
        id: true,
        action: true,
        reason: true,
        createdAt: true,
        durationDays: true,
        moderator: { select: { fullName: true } },
        report: { select: { reason: true } },
      },
    }),
  ]);
  return {
    user: {
      id: student.id,
      username: student.username,
      fullName: student.fullName,
      photoUrl: student.photoUrl,
      status: student.status,
      level: student.level,
      departmentName: student.department?.name ?? null,
    },
    activeStrikes: strikes,
    reportsAgainst: reports,
    history: actions.map((action) => ({
      id: action.id,
      action: action.action,
      reason: action.reason,
      label: action.action === "KEEP" ? "Content kept" : action.action === "REMOVE" ? "Content removed" : action.action === "WARN" ? "Author warned" : "Account suspended",
      reasonLabel: action.report ? REPORT_REASON_LABELS[action.report.reason] : "Manual review",
      createdAt: action.createdAt.toISOString(),
      moderatorName: action.moderator.fullName,
      durationDays: action.durationDays,
    })),
  };
}

export async function reinstateStudent(user: SessionUser, studentId: string, ip?: string | null): Promise<void> {
  assertModerator(user);
  if (!user.roles.some((role) => role.universityId === user.universityId && role.role === "UNIVERSITY_ADMIN")) {
    throw new SocialError("Only a university admin can reinstate an account.", 403);
  }
  const db = tenantDb(user.universityId);
  const student = await db.user.findFirst({ where: { id: studentId }, select: { id: true, status: true } });
  if (!student) throw new SocialError("That student isn't available.");
  await db.user.update({
    where: { id: studentId },
    data: { status: "VERIFIED", suspendedUntil: null, flaggedForReviewAt: null },
  });
  await writeAudit({
    actorId: user.id,
    universityId: user.universityId,
    action: "moderation.reinstate",
    targetType: "User",
    targetId: studentId,
    metadata: { previousStatus: student.status },
    ip,
  });
}
