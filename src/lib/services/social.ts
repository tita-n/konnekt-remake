import "server-only";
import type { Prisma } from "@prisma/client";
import type { SessionUser } from "@/lib/auth/guards";
import { tenantDb, type TenantClient } from "@/lib/db/tenant";
import { buildStudentPathFromNode } from "@/lib/domain/academic";
import type { StudentPath } from "@/lib/domain/academic";
import { parseLabels, type LayerLabels } from "@/lib/services/universities";
import { lineageFor } from "@/lib/services/student-path";

/**
 * Everything the social layer needs to make a visibility decision, resolved
 * once per request. studentPath is computed server-side from the stored
 * department node, never accepted from the client.
 */
export interface SocialViewer {
  userId: string;
  universityId: string;
  studentPath: StudentPath;
  departmentId: string;
  level: number;
  username: string;
  fullName: string;
  photoUrl: string | null;
  labels: LayerLabels;
  lineage: { college: string | null; faculty: string | null; department: string | null };
  accountAgeHours: number;
  interests: string[];
  isUniversityStaff: boolean;
  isUniversityAdmin: boolean;
  isUniversityModerator: boolean;
  timezone: string;
  showEventAttendance: boolean;
}

/**
 * The academic tree changes rarely and is identical for every viewer in a
 * university. Cache it per instance for a minute instead of loading every node
 * on every request. Admin mutations call `invalidateAcademicTree`.
 */
const academicTreeCache = new Map<string, { nodes: Array<{ id: string; name: string; type: "COLLEGE" | "FACULTY" | "DEPARTMENT"; parentId: string | null }>; at: number }>();
const ACADEMIC_TREE_TTL_MS = 60_000;

export function invalidateAcademicTree(universityId?: string): void {
  if (universityId) academicTreeCache.delete(universityId);
  else academicTreeCache.clear();
}

export async function loadSocialViewer(user: SessionUser): Promise<SocialViewer | null> {
  if (!user.departmentNodeId || !user.level) return null;
  const db = tenantDb(user.universityId);
  const cached = academicTreeCache.get(user.universityId);
  const fresh = cached && Date.now() - cached.at < ACADEMIC_TREE_TTL_MS;
  const [department, nodes] = await Promise.all([
    db.academicNode.findFirst({
      where: { id: user.departmentNodeId },
      select: { id: true, path: true, type: true },
    }),
    fresh
      ? Promise.resolve(cached.nodes)
      : db.academicNode.findMany({
          select: { id: true, name: true, type: true, parentId: true },
        }),
  ]);
  if (!fresh && nodes.length > 0) {
    academicTreeCache.set(user.universityId, { nodes, at: Date.now() });
  }
  if (!department) return null;
  const lineage = lineageFor(nodes, department.id);
  return {
    userId: user.id,
    universityId: user.universityId,
    studentPath: buildStudentPathFromNode(user.universityId, department, user.level),
    departmentId: department.id,
    level: user.level,
    username: user.username,
    fullName: user.fullName,
    photoUrl: user.photoUrl,
    labels: parseLabels(user.university.labels),
    lineage: {
      college: lineage.college?.name ?? null,
      faculty: lineage.faculty?.name ?? null,
      department: lineage.department?.name ?? null,
    },
    accountAgeHours: Math.max(0, (Date.now() - user.createdAt.getTime()) / 3_600_000),
    interests: user.interests,
    isUniversityStaff: user.roles.some(
      (role) =>
        role.universityId === user.universityId &&
        (role.role === "UNIVERSITY_ADMIN" || role.role === "MODERATOR"),
    ),
    isUniversityAdmin: user.roles.some(
      (role) => role.universityId === user.universityId && role.role === "UNIVERSITY_ADMIN",
    ),
    isUniversityModerator: user.roles.some(
      (role) => role.universityId === user.universityId && role.role === "MODERATOR",
    ),
    timezone: user.university.timezone ?? "Africa/Lagos",
    showEventAttendance: user.showEventAttendance,
  };
}

export interface RelationshipSets {
  /** Accounts this viewer blocked. Invisible both ways. */
  blocked: Set<string>;
  /** Accounts that blocked this viewer. Invisible both ways. */
  blockedBy: Set<string>;
  /** Accounts this viewer muted. Hidden only from this viewer. */
  muted: Set<string>;
}

export async function loadRelationships(db: TenantClient, viewerId: string): Promise<RelationshipSets> {
  const [blocks, blockedBy, mutes] = await Promise.all([
    db.block.findMany({ where: { userId: viewerId }, select: { blockedUserId: true } }),
    db.block.findMany({ where: { blockedUserId: viewerId }, select: { userId: true } }),
    db.mute.findMany({ where: { userId: viewerId }, select: { mutedUserId: true } }),
  ]);
  return {
    blocked: new Set(blocks.map((row) => row.blockedUserId)),
    blockedBy: new Set(blockedBy.map((row) => row.userId)),
    muted: new Set(mutes.map((row) => row.mutedUserId)),
  };
}

/** Author ids hidden from this viewer's feeds and hashtag results. */
export function hiddenAuthorIds(relationships: RelationshipSets): string[] {
  return [...new Set([...relationships.blocked, ...relationships.blockedBy, ...relationships.muted])];
}

export function isHiddenAuthor(relationships: RelationshipSets, authorId: string, viewerId: string): boolean {
  if (authorId === viewerId) return false;
  return (
    relationships.blocked.has(authorId) ||
    relationships.blockedBy.has(authorId) ||
    relationships.muted.has(authorId)
  );
}

export const postSelect = {
  id: true,
  type: true,
  body: true,
  audiencePath: true,
  audienceKind: true,
  status: true,
  communityId: true,
  community: {
    select: {
      id: true,
      name: true,
      slug: true,
      iconPublicId: true,
      privacy: true,
      status: true,
      isOfficial: true,
      memberCount: true,
    },
  },
  communityPin: { select: { position: true } },
  createdAt: true,
  rankAt: true,
  editedAt: true,
  questionTitle: true,
  topicTag: true,
  acceptedCommentId: true,
  moderationReason: true,
  authorId: true,
  commentCount: true,
  reactionCount: true,
  repostCount: true,
  bookmarkCount: true,
  author: {
    select: {
      id: true,
      username: true,
      fullName: true,
      photoUrl: true,
      level: true,
      department: { select: { name: true } },
      roles: { select: { role: true } },
    },
  },
  media: {
    orderBy: { order: "asc" },
    select: { id: true, url: true, publicId: true, width: true, height: true, alt: true, order: true },
  },
  poll: {
    select: {
      id: true,
      endsAt: true,
      options: { orderBy: { order: "asc" }, select: { id: true, text: true, order: true, voteCount: true } },
    },
  },
  repostOf: {
    select: {
      id: true,
      body: true,
      status: true,
      createdAt: true,
      author: {
        select: {
          id: true,
          username: true,
          fullName: true,
          photoUrl: true,
          level: true,
          department: { select: { name: true } },
          roles: { select: { role: true } },
        },
      },
    },
  },
} satisfies Prisma.PostSelect;

export type PostRow = Prisma.PostGetPayload<{ select: typeof postSelect }>;

/** URL used by the UI. Cloudinary public ids are transformed; local ones are served directly. */
export function mediaUrl(media: { url: string | null; publicId: string; width: number }): string | null {
  if (media.url) return media.url;
  return null;
}

export async function viewerPostState(
  db: TenantClient,
  viewerId: string,
  postIds: string[],
): Promise<{ reacted: Set<string>; bookmarked: Set<string> }> {
  if (postIds.length === 0) return { reacted: new Set(), bookmarked: new Set() };
  const [reactions, bookmarks] = await Promise.all([
    db.reaction.findMany({
      where: { userId: viewerId, targetType: "POST", targetId: { in: postIds } },
      select: { targetId: true },
    }),
    db.bookmark.findMany({ where: { userId: viewerId, postId: { in: postIds } }, select: { postId: true } }),
  ]);
  return {
    reacted: new Set(reactions.map((row) => row.targetId)),
    bookmarked: new Set(bookmarks.map((row) => row.postId)),
  };
}
