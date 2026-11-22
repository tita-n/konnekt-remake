import "server-only";
import { Prisma } from "@prisma/client";
import { platformDb } from "@/lib/db/platform";
import { tenantDb, type TenantClient } from "@/lib/db/tenant";
import {
  COMMUNITY_PAGE_SIZE,
  DEFAULT_INVITE_DAYS,
  MAX_COMMUNITY_RULES,
  MAX_PINS,
  canAccessCommunityAction,
  canTransferOwnership,
  canViewCommunity,
  canViewCommunityContent,
  communityJoinState,
  communityNameError,
  isBanned,
  isMuted,
  normalizeCommunityName,
  reservedCommunityName,
  slugifyCommunityName,
  type CommunityAccess,
  type CommunityCategory,
  type CommunityPrivacy,
  type CommunityRole,
} from "@/lib/domain/community";
import {
  generateInviteToken,
  hashInviteToken,
  inviteError,
  inviteExpiry,
  inviteIsUsable,
} from "@/lib/domain/community-invite";
import { isAllowedPostPublicId } from "@/lib/media/post-media";
import { rateLimit } from "@/lib/security/rate-limit";
import {
  accessFromRows,
  communityImageUrl,
  joinedActiveCommunityIds,
  loadCommunityAccessMap,
  type CommunityRefRow,
} from "./community-access";
import { SocialError } from "@/lib/posts/errors";
import type { SocialViewer } from "./social";
import type {
  CommunityAdminPayload,
  CommunityCardView,
  CommunityDiscoverPayload,
  CommunityInviteView,
  CommunityMemberView,
  CommunityMinePayload,
  CommunityOption,
  CommunityPageView,
  CommunityReportView,
  CommunityResourceView,
  CommunitySearchPayload,
  CommunityStaffView,
  CommunityViewerState,
  JoinRequestView,
  PendingInvitationView,
} from "@/lib/communities/types";

export const communityCardSelect = {
  id: true,
  name: true,
  slug: true,
  description: true,
  category: true,
  privacy: true,
  status: true,
  isOfficial: true,
  iconPublicId: true,
  bannerPublicId: true,
  allowMemberUploads: true,
  memberCount: true,
  postCount: true,
  lastActivityAt: true,
  createdAt: true,
  createdById: true,
} satisfies Prisma.CommunitySelect;

type CommunityCardRow = Prisma.CommunityGetPayload<{ select: typeof communityCardSelect }>;

interface ViewerLookup {
  access: CommunityAccess;
  pendingRequest: boolean;
  hasInvite: boolean;
  recentActivity: string | null;
}

const trendingCache = new Map<string, { expires: number; ids: string[] }>();

function encodeCursor(row: Pick<CommunityCardRow, "lastActivityAt" | "id">): string {
  return Buffer.from(JSON.stringify({ t: row.lastActivityAt.toISOString(), i: row.id }), "utf8").toString("base64url");
}

function decodeCursor(value?: string | null): { at: Date; id: string } | null {
  if (!value) return null;
  try {
    const raw = JSON.parse(Buffer.from(value, "base64url").toString("utf8")) as { t?: unknown; i?: unknown };
    if (typeof raw.t !== "string" || typeof raw.i !== "string") return null;
    const at = new Date(raw.t);
    return Number.isNaN(at.getTime()) ? null : { at, id: raw.i };
  } catch {
    return null;
  }
}

function viewerState(access: CommunityAccess, lookup: ViewerLookup): CommunityViewerState {
  const isMember = access.memberStatus === "ACTIVE";
  return {
    joinState: communityJoinState({ access, pendingRequest: lookup.pendingRequest, hasInvite: lookup.hasInvite }),
    isMember,
    role: access.role,
    pendingRequest: lookup.pendingRequest,
    hasInvite: lookup.hasInvite,
    muted: isMuted(access),
    canModerate: isMember && (access.role === "OWNER" || access.role === "MODERATOR"),
    canManage: isMember && access.role === "OWNER",
  };
}

function toCard(row: CommunityCardRow, lookup: ViewerLookup): CommunityCardView {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    description: row.description,
    category: row.category,
    privacy: row.privacy,
    status: row.status,
    isOfficial: row.isOfficial,
    iconUrl: communityImageUrl(row.iconPublicId),
    bannerUrl: communityImageUrl(row.bannerPublicId),
    memberCount: row.memberCount,
    postCount: row.postCount,
    recentActivity: lookup.recentActivity,
    viewer: viewerState(lookup.access, lookup),
  };
}

async function loadViewerLookups(
  db: TenantClient,
  viewerId: string,
  rows: CommunityCardRow[],
): Promise<Map<string, ViewerLookup>> {
  const ids = rows.map((row) => row.id);
  if (ids.length === 0) return new Map();
  const [access, requests, invites] = await Promise.all([
    loadCommunityAccessMap(db, viewerId, ids),
    db.joinRequest.findMany({
      where: { userId: viewerId, communityId: { in: ids }, status: "PENDING" },
      select: { communityId: true },
    }),
    db.communityInvite.findMany({
      where: {
        invitedUserId: viewerId,
        communityId: { in: ids },
        status: "ACTIVE",
        expiresAt: { gt: new Date() },
      },
      select: { communityId: true },
    }),
  ]);
  const requested = new Set(requests.map((row) => row.communityId));
  const invited = new Set(invites.map((row) => row.communityId));
  return new Map(
    rows.flatMap((row) => {
      const rowAccess = access.get(row.id);
      if (!rowAccess) return [];
      return [
        [
          row.id,
          {
            access: rowAccess,
            pendingRequest: requested.has(row.id),
            hasInvite: invited.has(row.id),
            recentActivity: null,
          } satisfies ViewerLookup,
        ] as const,
      ];
    }),
  );
}

function withRecentActivity(lookup: ViewerLookup, text: string | null): ViewerLookup {
  return { ...lookup, recentActivity: text };
}

/* ----------------------------- reading -------------------------------- */

export async function listMyCommunities(viewer: SocialViewer): Promise<CommunityMinePayload> {
  const db = tenantDb(viewer.universityId);
  const memberships = await db.communityMember.findMany({
    where: {
      userId: viewer.userId,
      status: "ACTIVE",
      community: { status: { in: ["ACTIVE", "ARCHIVED"] } },
    },
    select: { communityId: true, lastSeenAt: true },
  });
  const seenByCommunity = new Map(memberships.map((row) => [row.communityId, row.lastSeenAt]));
  const rows = memberships.length
    ? await db.community.findMany({
        where: { id: { in: memberships.map((row) => row.communityId) } },
        select: communityCardSelect,
      })
    : [];

  const newCounts = new Map<string, number>();
  if (rows.length > 0) {
    const conditions = rows.map((row) => ({
      communityId: row.id,
      createdAt: { gt: seenByCommunity.get(row.id) ?? new Date(0) },
    }));
    const grouped = await db.post.groupBy({
      by: ["communityId"],
      where: { status: "ACTIVE", OR: conditions },
      _count: { _all: true },
    });
    for (const row of grouped) {
      if (row.communityId) newCounts.set(row.communityId, row._count._all);
    }
  }

  const lookups = await loadViewerLookups(db, viewer.userId, rows);
  const cards = rows
    .map((row) => {
      const lookup = lookups.get(row.id);
      if (!lookup) return null;
      const count = newCounts.get(row.id) ?? 0;
      return toCard(
        row,
        withRecentActivity(
          lookup,
          row.status === "ARCHIVED"
            ? "Archived · read only"
            : count > 0
              ? `${count} new post${count === 1 ? "" : "s"}`
              : row.lastActivityAt.getTime() > Date.now() - 7 * 24 * 60 * 60 * 1000
                ? "Active this week"
                : "Quiet lately",
        ),
      );
    })
    .filter((row): row is CommunityCardView => Boolean(row))
    .sort((a, b) => {
      if (a.status !== b.status) return a.status === "ACTIVE" ? -1 : 1;
      return b.recentActivity?.includes("new post") === true
        ? 1
        : a.recentActivity?.includes("new post") === true
          ? -1
          : b.memberCount - a.memberCount;
    });

  const invitations = await listPendingInvitations(viewer);
  return {
    active: cards.filter((card) => card.status === "ACTIVE").slice(0, 6),
    rest: cards.filter((card) => card.status !== "ACTIVE" || cards.indexOf(card) >= 6),
    invitations,
  };
}

export async function listDiscoverCommunities(
  viewer: SocialViewer,
  options: { q?: string; category?: CommunityCategory | null; cursor?: string | null } = {},
): Promise<CommunityDiscoverPayload> {
  const db = tenantDb(viewer.universityId);
  const q = options.q?.trim() ?? "";
  const [relationships, banned] = await Promise.all([
    db.block.findMany({
      where: { OR: [{ userId: viewer.userId }, { blockedUserId: viewer.userId }] },
      select: { userId: true, blockedUserId: true },
    }),
    db.communityMember.findMany({
      where: { userId: viewer.userId, status: "BANNED" },
      select: { communityId: true },
    }),
  ]);
  const hiddenUserIds = [
    ...new Set(
      relationships.map((row) => (row.userId === viewer.userId ? row.blockedUserId : row.userId)),
    ),
  ];
  const bannedIds = banned.map((row) => row.communityId);
  const decoded = decodeCursor(options.cursor);
  const where: Prisma.CommunityWhereInput = {
    status: "ACTIVE",
    privacy: { in: ["PUBLIC", "REQUEST"] },
    ...(q ? { OR: [{ name: { contains: q, mode: "insensitive" } }, { description: { contains: q, mode: "insensitive" } }] } : {}),
    ...(options.category ? { category: options.category } : {}),
    ...(hiddenUserIds.length > 0 ? { createdById: { notIn: hiddenUserIds } } : {}),
    ...(bannedIds.length > 0 ? { id: { notIn: bannedIds } } : {}),
    ...(decoded
      ? {
          AND: [
            {
              OR: [
                { lastActivityAt: { lt: decoded.at } },
                { lastActivityAt: decoded.at, id: { lt: decoded.id } },
              ],
            },
          ],
        }
      : {}),
  };
  const rows = await db.community.findMany({
    where,
    orderBy: [{ lastActivityAt: "desc" }, { id: "desc" }],
    take: COMMUNITY_PAGE_SIZE + 1,
    select: communityCardSelect,
  });
  const hasMore = rows.length > COMMUNITY_PAGE_SIZE;
  const pageRows = rows.slice(0, COMMUNITY_PAGE_SIZE);
  const lookups = await loadViewerLookups(db, viewer.userId, pageRows);
  const communities = pageRows.flatMap((row) => {
    const lookup = lookups.get(row.id);
    return lookup ? [toCard(row, lookup)] : [];
  });

  const [trending, suggested] = q || options.category
    ? [[], []]
    : await Promise.all([listTrendingCommunities(viewer), listSuggestedCommunities(viewer)]);
  const lastPageRow = pageRows[pageRows.length - 1];

  return {
    communities,
    nextCursor: hasMore && lastPageRow ? encodeCursor(lastPageRow) : null,
    hasMore,
    trending,
    suggested,
  };
}

export async function searchCommunities(
  viewer: SocialViewer,
  query: string,
  cursor?: string | null,
): Promise<CommunitySearchPayload> {
  const q = query.trim();
  if (q.length < 1) return { communities: [], nextCursor: null, hasMore: false };
  const result = await listDiscoverCommunities(viewer, { q, cursor });
  return { communities: result.communities, nextCursor: result.nextCursor, hasMore: result.hasMore };
}

async function communityRowsByIds(
  viewer: SocialViewer,
  ids: string[],
  recentText: ((row: CommunityCardRow) => string | null) | null = null,
): Promise<CommunityCardView[]> {
  if (ids.length === 0) return [];
  const db = tenantDb(viewer.universityId);
  const rows = await db.community.findMany({
    where: { id: { in: ids }, status: "ACTIVE", privacy: { in: ["PUBLIC", "REQUEST"] } },
    select: communityCardSelect,
  });
  const byId = new Map(rows.map((row) => [row.id, row]));
  const lookups = await loadViewerLookups(db, viewer.userId, rows);
  return ids.flatMap((id) => {
    const row = byId.get(id);
    const lookup = lookups.get(id);
    if (!row || !lookup) return [];
    return [toCard(row, recentText ? withRecentActivity(lookup, recentText(row)) : lookup)];
  });
}

export async function listTrendingCommunities(viewer: SocialViewer): Promise<CommunityCardView[]> {
  const db = tenantDb(viewer.universityId);
  const key = viewer.universityId;
  const cached = trendingCache.get(key);
  if (cached && cached.expires > Date.now()) return communityRowsByIds(viewer, cached.ids);

  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const [members, posts, candidates] = await Promise.all([
    db.communityMember.groupBy({
      by: ["communityId"],
      where: { joinedAt: { gte: since }, status: "ACTIVE" },
      _count: { _all: true },
    }),
    db.post.groupBy({
      by: ["communityId"],
      where: { createdAt: { gte: since }, status: "ACTIVE", audienceKind: "COMMUNITY" },
      _count: { _all: true },
    }),
    db.community.findMany({
      where: { status: "ACTIVE", privacy: { in: ["PUBLIC", "REQUEST"] } },
      select: { id: true, memberCount: true, postCount: true },
      orderBy: { lastActivityAt: "desc" },
      take: 100,
    }),
  ]);
  const memberGrowth = new Map(members.flatMap((row) => (row.communityId ? [[row.communityId, row._count._all] as const] : [])));
  const postGrowth = new Map(posts.flatMap((row) => (row.communityId ? [[row.communityId, row._count._all] as const] : [])));
  const ids = candidates
    .map((row) => ({
      id: row.id,
      score:
        (memberGrowth.get(row.id) ?? 0) * 5 +
        (postGrowth.get(row.id) ?? 0) * 2 +
        Math.min(row.memberCount, 500) / 100 +
        Math.min(row.postCount, 500) / 200,
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 6)
    .map((row) => row.id);
  trendingCache.set(key, { expires: Date.now() + 60_000, ids });
  return communityRowsByIds(viewer, ids, (row) => {
    const growth = (memberGrowth.get(row.id) ?? 0) + (postGrowth.get(row.id) ?? 0);
    return growth > 0 ? `${growth} interactions this week` : "Active this week";
  });
}

const INTEREST_CATEGORIES: ReadonlyArray<{ match: RegExp; category: CommunityCategory }> = [
  { match: /tech|comput|coding|program|robot|ai|data/i, category: "TECH" },
  { match: /sport|football|basket|athlet|fitness/i, category: "SPORTS" },
  { match: /art|music|theatre|theater|film|design|photo/i, category: "ARTS" },
  { match: /faith|church|muslim|christian|relig|spirit/i, category: "FAITH" },
  { match: /business|entre|startup|finance|market/i, category: "BUSINESS" },
  { match: /hostel|accommodation|residence/i, category: "HOSTEL" },
  { match: /academic|study|research|science|engineer|law|medic/i, category: "ACADEMIC" },
  { match: /hobby|gaming|book|anime|chess|travel/i, category: "HOBBY" },
];

export async function listSuggestedCommunities(viewer: SocialViewer): Promise<CommunityCardView[]> {
  const db = tenantDb(viewer.universityId);
  const [joined, banned, blocks] = await Promise.all([
    joinedActiveCommunityIds(db, viewer.userId),
    db.communityMember.findMany({
      where: { userId: viewer.userId, status: "BANNED" },
      select: { communityId: true },
    }),
    db.block.findMany({
      where: { OR: [{ userId: viewer.userId }, { blockedUserId: viewer.userId }] },
      select: { userId: true, blockedUserId: true },
    }),
  ]);
  const hiddenUserIds = blocks.map((row) => (row.userId === viewer.userId ? row.blockedUserId : row.userId));
  const categories = new Set<CommunityCategory>();
  for (const interest of viewer.interests) {
    for (const entry of INTEREST_CATEGORIES) if (entry.match.test(interest)) categories.add(entry.category);
  }
  const excluded = [...new Set([...joined, ...banned.map((row) => row.communityId)])];
  const rows = await db.community.findMany({
    where: {
      status: "ACTIVE",
      privacy: { in: ["PUBLIC", "REQUEST"] },
      ...(excluded.length > 0 ? { id: { notIn: excluded } } : {}),
      ...(hiddenUserIds.length > 0 ? { createdById: { notIn: hiddenUserIds } } : {}),
    },
    orderBy: [{ lastActivityAt: "desc" }],
    take: 40,
    select: communityCardSelect,
  });
  const ranked = rows
    .map((row) => ({ row, score: (categories.has(row.category) ? 10 : 0) + Math.min(row.memberCount, 200) / 50 }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 6)
    .map((entry) => entry.row);
  const lookups = await loadViewerLookups(db, viewer.userId, ranked);
  return ranked.flatMap((row) => {
    const lookup = lookups.get(row.id);
    return lookup ? [toCard(row, lookup)] : [];
  });
}

export async function getCommunityPage(
  viewer: SocialViewer,
  slugOrId: string,
  inviteToken?: string | null,
): Promise<CommunityPageView | null> {
  const db = tenantDb(viewer.universityId);
  const row = await db.community.findFirst({
    where: { OR: [{ slug: slugOrId }, { id: slugOrId }], status: { not: "DELETED" } },
    select: communityCardSelect,
  });
  if (!row) return null;
  const access =
    (await loadCommunityAccessMap(db, viewer.userId, [row.id])).get(row.id) ??
    accessFromRows(row as unknown as CommunityRefRow, null);
  const isMember = access.memberStatus === "ACTIVE";
  let inviteUsable = false;
  if (!canViewCommunity(access) && access.privacy === "INVITE_ONLY" && inviteToken) {
    const invite = await db.communityInvite.findFirst({
      where: {
        tokenHash: hashInviteToken(inviteToken),
        communityId: row.id,
        status: "ACTIVE",
        expiresAt: { gt: new Date() },
      },
      select: { kind: true, invitedUserId: true, status: true, expiresAt: true, uses: true, maxUses: true },
    });
    inviteUsable = Boolean(
      invite &&
        inviteIsUsable(invite) &&
        (invite.kind === "LINK" || invite.invitedUserId === viewer.userId),
    );
  }
  if (!canViewCommunity(access) && !inviteUsable) return null;
  if (!isMember && access.status === "ARCHIVED") return null;

  const [pendingRequest, invite, rules, staff, pendingRequestCount, pendingInviteCount, reportedCount] = await Promise.all([
    db.joinRequest.findFirst({
      where: { communityId: row.id, userId: viewer.userId, status: "PENDING" },
      select: { id: true },
    }),
    db.communityInvite.findFirst({
      where: {
        communityId: row.id,
        invitedUserId: viewer.userId,
        status: "ACTIVE",
        expiresAt: { gt: new Date() },
      },
      select: { id: true },
    }),
    db.communityRule.findMany({
      where: { communityId: row.id },
      orderBy: { position: "asc" },
      select: { id: true, position: true, title: true, body: true },
    }),
    db.communityMember.findMany({
      where: { communityId: row.id, status: "ACTIVE", role: { in: ["OWNER", "MODERATOR"] } },
      orderBy: [{ role: "asc" }, { joinedAt: "asc" }],
      take: 12,
      select: {
        role: true,
        joinedAt: true,
        user: { select: { id: true, username: true, fullName: true, photoUrl: true } },
      },
    }),
    canAccessCommunityAction(access, "APPROVE_REQUEST")
      ? db.joinRequest.count({ where: { communityId: row.id, status: "PENDING" } })
      : Promise.resolve(0),
    canAccessCommunityAction(access, "INVITE")
      ? db.communityInvite.count({ where: { communityId: row.id, status: "ACTIVE", expiresAt: { gt: new Date() } } })
      : Promise.resolve(0),
    canAccessCommunityAction(access, "VIEW_REPORTS")
      ? db.report.count({ where: { communityId: row.id, status: "PENDING" } })
      : Promise.resolve(0),
  ]);

  if (isMember && access.status === "ACTIVE") {
    await db.communityMember.updateMany({
      where: { communityId: row.id, userId: viewer.userId },
      data: { lastSeenAt: new Date() },
    });
  }

  const lookup: ViewerLookup = {
    access,
    pendingRequest: Boolean(pendingRequest),
    hasInvite: inviteUsable || Boolean(invite),
    recentActivity: null,
  };
  return {
    ...toCard(row, lookup),
    allowMemberUploads: row.allowMemberUploads,
    createdAt: row.createdAt.toISOString(),
    rules,
    staff: staff.map((member) => ({
      userId: member.user.id,
      username: member.user.username,
      fullName: member.user.fullName,
      photoUrl: member.user.photoUrl,
      role: member.role,
      joinedAt: member.joinedAt.toISOString(),
    })),
    pendingRequestCount,
    pendingInviteCount,
    reportedCount,
  };
}

export async function listCommunityOptions(viewer: SocialViewer): Promise<CommunityOption[]> {
  const db = tenantDb(viewer.universityId);
  const memberships = await db.communityMember.findMany({
    where: { userId: viewer.userId, status: "ACTIVE", community: { status: "ACTIVE" } },
    orderBy: { joinedAt: "asc" },
    select: {
      role: true,
      community: {
        select: {
          id: true,
          name: true,
          slug: true,
          iconPublicId: true,
          isOfficial: true,
          rules: { orderBy: { position: "asc" }, select: { title: true, body: true } },
        },
      },
    },
  });
  return memberships.map((membership) => ({
    id: membership.community.id,
    name: membership.community.name,
    slug: membership.community.slug,
    iconUrl: communityImageUrl(membership.community.iconPublicId),
    isOfficial: membership.community.isOfficial,
    role: membership.role,
    rules: membership.community.rules,
  }));
}

/* ---------------------------- name + create ---------------------------- */

export async function checkCommunityName(
  viewer: SocialViewer,
  rawName: string,
): Promise<{ available: boolean; message: string | null; normalized: string }> {
  const limit = await rateLimit("communityNameCheck", viewer.userId);
  if (!limit.success) throw new SocialError("Too many name checks. Try again in a minute.", 429);
  const name = rawName.trim();
  const nameError = communityNameError(name);
  if (nameError) return { available: false, message: nameError, normalized: "" };
  const normalized = normalizeCommunityName(name);
  const db = tenantDb(viewer.universityId);
  const [university, academic, existing] = await Promise.all([
    platformDb.university.findUnique({ where: { id: viewer.universityId }, select: { name: true, shortName: true } }),
    db.academicNode.findMany({ where: { isActive: true }, select: { name: true } }),
    db.community.findFirst({ where: { nameNormalized: normalized, status: { not: "DELETED" } }, select: { id: true } }),
  ]);
  const reserved = reservedCommunityName(name, {
    universityName: university?.name ?? "",
    universityShortName: university?.shortName ?? "",
    academicNames: academic.map((node) => node.name),
  });
  if (reserved) return { available: false, message: reserved, normalized };
  if (existing) return { available: false, message: "That name is already taken at your university.", normalized };
  return { available: true, message: null, normalized };
}

export interface CreateCommunityInput {
  viewer: SocialViewer;
  name: string;
  description: string;
  category: CommunityCategory;
  privacy: CommunityPrivacy;
  iconPublicId?: string | null;
  bannerPublicId?: string | null;
  allowMemberUploads?: boolean;
  rules?: Array<{ title: string; body: string }>;
}

function validateRules(rules: Array<{ title: string; body: string }>): Array<{ title: string; body: string }> {
  if (rules.length > MAX_COMMUNITY_RULES) throw new SocialError(`Add up to ${MAX_COMMUNITY_RULES} rules.`);
  return rules
    .map((rule) => ({ title: rule.title.trim(), body: rule.body.trim() }))
    .filter((rule) => rule.title || rule.body)
    .map((rule) => {
      if (rule.title.length < 2 || rule.title.length > 60) throw new SocialError("Rule titles need 2–60 characters.");
      if (rule.body.length < 2 || rule.body.length > 300) throw new SocialError("Rules need 2–300 characters.");
      return rule;
    });
}

async function uniqueSlug(db: TenantClient, universityId: string, name: string): Promise<string> {
  const base = slugifyCommunityName(name);
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const slug = attempt === 0 ? base : `${base}-${Math.random().toString(36).slice(2, 6)}`;
    const taken = await db.community.findFirst({ where: { universityId, slug }, select: { id: true } });
    if (!taken) return slug;
  }
  return `${base}-${Date.now().toString(36)}`;
}

export async function createCommunity(input: CreateCommunityInput): Promise<{ id: string; slug: string }> {
  const { viewer } = input;
  if (viewer.accountAgeHours < 24) {
    throw new SocialError("You can create a community once your account is a day old.", 403);
  }
  const limit = await rateLimit("communityCreate", viewer.userId);
  if (!limit.success) throw new SocialError("You've created the maximum number of communities for today.", 429);
  const name = input.name.trim();
  const description = input.description.trim();
  if (description.length < 5) throw new SocialError("Add a short description so people know what this is for.");
  if (description.length > 500) throw new SocialError("Descriptions can be up to 500 characters.");
  if (!["PUBLIC", "REQUEST", "INVITE_ONLY"].includes(input.privacy)) throw new SocialError("Choose who can join.");

  const nameResult = await checkCommunityName(viewer, name);
  if (!nameResult.available) throw new SocialError(nameResult.message ?? "That name isn't available.");
  const rules = validateRules(input.rules ?? []);
  for (const id of [input.iconPublicId, input.bannerPublicId]) {
    if (id && !isAllowedPostPublicId(id)) throw new SocialError("That image upload isn't valid.");
  }

  const db = tenantDb(viewer.universityId);
  const [owned, createdToday] = await Promise.all([
    db.communityMember.count({
      where: { userId: viewer.userId, role: "OWNER", status: "ACTIVE", community: { status: { not: "DELETED" } } },
    }),
    db.community.count({
      where: { createdById: viewer.userId, createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } },
    }),
  ]);
  if (owned >= 5) throw new SocialError("You already own the maximum number of communities.", 403);
  if (createdToday >= 3) throw new SocialError("You've created the maximum number of communities today.", 429);

  const slug = await uniqueSlug(db, viewer.universityId, name);
  try {
    const created = await db.$transaction(async (tx) => {
      const community = await tx.community.create({
        data: {
          universityId: viewer.universityId,
          name,
          nameNormalized: nameResult.normalized,
          slug,
          description,
          category: input.category,
          privacy: input.privacy,
          allowMemberUploads: input.allowMemberUploads === true,
          createdById: viewer.userId,
          memberCount: 1,
          ...(input.iconPublicId ? { iconPublicId: input.iconPublicId } : {}),
          ...(input.bannerPublicId ? { bannerPublicId: input.bannerPublicId } : {}),
          rules: {
            create: rules.map((rule, position) => ({
              universityId: viewer.universityId,
              position,
              title: rule.title,
              body: rule.body,
            })),
          },
        },
        select: { id: true, slug: true },
      });
      await tx.communityMember.create({
        data: {
          universityId: viewer.universityId,
          communityId: community.id,
          userId: viewer.userId,
          role: "OWNER",
        },
      });
      await tx.auditLog.create({
        data: {
          actorId: viewer.userId,
          universityId: viewer.universityId,
          action: "community.create",
          targetType: "COMMUNITY",
          targetId: community.id,
          metadata: { privacy: input.privacy, category: input.category },
        },
      });
      return community;
    });
    return created;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      throw new SocialError("That community name was just taken. Try another.", 409);
    }
    throw error;
  }
}

export async function updateCommunity(
  viewer: SocialViewer,
  communityId: string,
  input: {
    name?: string;
    description?: string;
    category?: CommunityCategory;
    privacy?: CommunityPrivacy;
    allowMemberUploads?: boolean;
    iconPublicId?: string | null;
    bannerPublicId?: string | null;
    rules?: Array<{ title: string; body: string }>;
  },
): Promise<void> {
  const db = tenantDb(viewer.universityId);
  const access = (await loadCommunityAccessMap(db, viewer.userId, [communityId])).get(communityId);
  if (!access || !canAccessCommunityAction(access, "EDIT_COMMUNITY")) {
    throw new SocialError("Only the community owner can edit these settings.", 403);
  }
  if (input.privacy && !canAccessCommunityAction(access, "EDIT_PRIVACY")) {
    throw new SocialError("Only the community owner can change privacy.", 403);
  }
  const data: Prisma.CommunityUpdateInput = {};
  if (input.description !== undefined) {
    const description = input.description.trim();
    if (description.length < 5 || description.length > 500) throw new SocialError("Descriptions need 5–500 characters.");
    data.description = description;
  }
  if (input.category !== undefined) data.category = input.category;
  if (input.privacy !== undefined) data.privacy = input.privacy;
  if (input.allowMemberUploads !== undefined) data.allowMemberUploads = input.allowMemberUploads;
  if (input.iconPublicId !== undefined) {
    if (input.iconPublicId && !isAllowedPostPublicId(input.iconPublicId)) throw new SocialError("That image upload isn't valid.");
    data.iconPublicId = input.iconPublicId;
  }
  if (input.bannerPublicId !== undefined) {
    if (input.bannerPublicId && !isAllowedPostPublicId(input.bannerPublicId)) throw new SocialError("That image upload isn't valid.");
    data.bannerPublicId = input.bannerPublicId;
  }
  if (input.name !== undefined && input.name.trim()) {
    const name = input.name.trim();
    const nameResult = await checkCommunityName(viewer, name);
    if (!nameResult.available) {
      const unchanged = await db.community.findFirst({ where: { id: communityId }, select: { nameNormalized: true } });
      if (unchanged?.nameNormalized !== nameResult.normalized) {
        throw new SocialError(nameResult.message ?? "That name isn't available.");
      }
    }
    data.name = name;
    data.nameNormalized = nameResult.normalized;
    data.slug = await uniqueSlug(db, viewer.universityId, name);
  }
  const rules = input.rules ? validateRules(input.rules) : null;
  if (rules && !canAccessCommunityAction(access, "EDIT_RULES")) {
    throw new SocialError("Only the community owner can edit rules.", 403);
  }
  await db.$transaction(async (tx) => {
    if (Object.keys(data).length > 0) await tx.community.update({ where: { id: communityId }, data });
    if (rules) {
      await tx.communityRule.deleteMany({ where: { communityId } });
      if (rules.length > 0) {
        await tx.communityRule.createMany({
          data: rules.map((rule, position) => ({
            universityId: viewer.universityId,
            communityId,
            position,
            title: rule.title,
            body: rule.body,
          })),
        });
      }
    }
    await tx.auditLog.create({
      data: {
        actorId: viewer.userId,
        universityId: viewer.universityId,
        action: "community.update",
        targetType: "COMMUNITY",
        targetId: communityId,
        metadata: { fields: Object.keys(data) },
      },
    });
  });
}

export async function archiveCommunity(viewer: SocialViewer, communityId: string): Promise<void> {
  const db = tenantDb(viewer.universityId);
  const access = (await loadCommunityAccessMap(db, viewer.userId, [communityId])).get(communityId);
  if (!access || !canAccessCommunityAction(access, "DELETE_COMMUNITY")) throw new SocialError("Only the owner can archive this community.", 403);
  await db.$transaction(async (tx) => {
    await tx.community.update({
      where: { id: communityId },
      data: { status: "ARCHIVED", archivedAt: new Date() },
    });
    await tx.auditLog.create({
      data: {
        actorId: viewer.userId,
        universityId: viewer.universityId,
        action: "community.archive",
        targetType: "COMMUNITY",
        targetId: communityId,
        metadata: {},
      },
    });
  });
}

export async function deleteCommunity(viewer: SocialViewer, communityId: string): Promise<void> {
  const db = tenantDb(viewer.universityId);
  const access = (await loadCommunityAccessMap(db, viewer.userId, [communityId])).get(communityId);
  if (!access || !canAccessCommunityAction(access, "DELETE_COMMUNITY")) throw new SocialError("Only the owner can delete this community.", 403);
  await db.$transaction(async (tx) => {
    await tx.community.update({
      where: { id: communityId },
      data: { status: "DELETED", deletedAt: new Date(), purgeAfter: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) },
    });
    await tx.auditLog.create({
      data: {
        actorId: viewer.userId,
        universityId: viewer.universityId,
        action: "community.delete",
        targetType: "COMMUNITY",
        targetId: communityId,
        metadata: {},
      },
    });
  });
}

/* ----------------------------- membership ------------------------------ */

const MAX_ACTIVE_INVITES = 30;

async function requireAccess(
  db: TenantClient,
  viewer: SocialViewer,
  communityId: string,
): Promise<CommunityAccess> {
  const access = (await loadCommunityAccessMap(db, viewer.userId, [communityId])).get(communityId);
  if (!access) throw new SocialError("This community isn't available.", 404);
  return access;
}

async function assertAction(
  db: TenantClient,
  viewer: SocialViewer,
  communityId: string,
  action: Parameters<typeof canAccessCommunityAction>[1],
): Promise<CommunityAccess> {
  const access = await requireAccess(db, viewer, communityId);
  if (!canAccessCommunityAction(access, action)) {
    throw new SocialError("You don't have permission to do that in this community.", 403);
  }
  return access;
}

async function communityAudit(
  db: Pick<TenantClient, "auditLog">,
  viewer: SocialViewer,
  action: string,
  communityId: string,
  metadata: Prisma.InputJsonValue = {},
): Promise<void> {
  await db.auditLog.create({
    data: {
      actorId: viewer.userId,
      universityId: viewer.universityId,
      action,
      targetType: "COMMUNITY",
      targetId: communityId,
      metadata,
    },
  });
}

export async function joinCommunity(
  viewer: SocialViewer,
  communityId: string,
  message?: string,
): Promise<{ state: "JOINED" | "REQUESTED" }> {
  const limit = await rateLimit("communityJoin", viewer.userId);
  if (!limit.success) throw new SocialError("Too many join attempts today. Try again tomorrow.", 429);
  const db = tenantDb(viewer.universityId);
  const access = await requireAccess(db, viewer, communityId);
  if (!canViewCommunity(access)) throw new SocialError("This community isn't available.", 404);
  if (access.status !== "ACTIVE") throw new SocialError("This community is read-only right now.", 403);
  if (isBanned(access)) throw new SocialError("You can't join this community.", 403);
  if (access.memberStatus === "ACTIVE") return { state: "JOINED" };
  if (access.privacy === "INVITE_ONLY") {
    throw new SocialError("This community is invite only.", 403);
  }

  if (access.privacy === "REQUEST") {
    const note = message?.trim().slice(0, 300) || null;
    try {
      await db.$transaction(async (tx) => {
        await tx.joinRequest.create({
          data: {
            universityId: viewer.universityId,
            communityId,
            userId: viewer.userId,
            message: note,
          },
        });
        await communityAudit(tx, viewer, "community.join.request", communityId, note ? { hasMessage: true } : {});
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        return { state: "REQUESTED" };
      }
      throw error;
    }
    return { state: "REQUESTED" };
  }

  await db.$transaction(async (tx) => {
    const existing = await tx.communityMember.findFirst({
      where: { communityId, userId: viewer.userId },
      select: { id: true, status: true, role: true },
    });
    if (existing?.status === "BANNED") throw new SocialError("You can't join this community.", 403);
    if (existing?.status === "ACTIVE") return;
    if (existing) {
      await tx.communityMember.update({
        where: { id: existing.id },
        data: { status: "ACTIVE", role: "MEMBER", joinedAt: new Date(), lastSeenAt: new Date() },
      });
    } else {
      await tx.communityMember.create({
        data: {
          universityId: viewer.universityId,
          communityId,
          userId: viewer.userId,
          role: "MEMBER",
        },
      });
    }
    await tx.community.update({ where: { id: communityId }, data: { memberCount: { increment: 1 } } });
    await tx.joinRequest.updateMany({
      where: { communityId, userId: viewer.userId, status: "PENDING" },
      data: { status: "APPROVED", decidedById: viewer.userId, decidedAt: new Date() },
    });
    await communityAudit(tx, viewer, "community.join", communityId);
  });
  return { state: "JOINED" };
}

export async function leaveCommunity(viewer: SocialViewer, communityId: string): Promise<void> {
  const db = tenantDb(viewer.universityId);
  const access = await requireAccess(db, viewer, communityId);
  if (access.memberStatus !== "ACTIVE") throw new SocialError("You aren't a member of this community.", 409);
  if (access.role === "OWNER") {
    const owners = await db.communityMember.count({
      where: { communityId, status: "ACTIVE", role: "OWNER" },
    });
    if (owners <= 1) {
      throw new SocialError("Transfer ownership to another member before leaving.", 409);
    }
  }
  await db.$transaction(async (tx) => {
    await tx.communityMember.updateMany({
      where: { communityId, userId: viewer.userId },
      data: { status: "LEFT", role: "MEMBER", mutedUntil: null },
    });
    await tx.community.update({
      where: { id: communityId },
      data: { memberCount: { decrement: 1 } },
    });
    await tx.joinRequest.updateMany({
      where: { communityId, userId: viewer.userId, status: "PENDING" },
      data: { status: "CANCELLED" },
    });
    await communityAudit(tx, viewer, "community.leave", communityId);
  });
}

export async function cancelJoinRequest(viewer: SocialViewer, communityId: string): Promise<void> {
  const db = tenantDb(viewer.universityId);
  const result = await db.joinRequest.updateMany({
    where: { communityId, userId: viewer.userId, status: "PENDING" },
    data: { status: "CANCELLED" },
  });
  if (result.count === 0) throw new SocialError("There's no pending request to cancel.", 404);
}

export async function listJoinRequests(viewer: SocialViewer, communityId: string): Promise<JoinRequestView[]> {
  const db = tenantDb(viewer.universityId);
  await assertAction(db, viewer, communityId, "APPROVE_REQUEST");
  const rows = await db.joinRequest.findMany({
    where: { communityId, status: "PENDING" },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      message: true,
      createdAt: true,
      user: {
        select: {
          id: true,
          username: true,
          fullName: true,
          photoUrl: true,
          level: true,
          department: { select: { name: true } },
        },
      },
    },
  });
  return rows.map((row) => ({
    id: row.id,
    message: row.message,
    createdAt: row.createdAt.toISOString(),
    user: {
      id: row.user.id,
      username: row.user.username,
      fullName: row.user.fullName,
      photoUrl: row.user.photoUrl,
      departmentName: row.user.department?.name ?? null,
      level: row.user.level,
    },
  }));
}

export async function decideJoinRequest(
  viewer: SocialViewer,
  communityId: string,
  requestId: string,
  decision: "APPROVE" | "DECLINE",
): Promise<void> {
  const db = tenantDb(viewer.universityId);
  await assertAction(db, viewer, communityId, "APPROVE_REQUEST");
  const request = await db.joinRequest.findFirst({
    where: { id: requestId, communityId, status: "PENDING" },
    select: { id: true, userId: true },
  });
  if (!request) throw new SocialError("That request has already been handled.", 409);
  await db.$transaction(async (tx) => {
    if (decision === "APPROVE") {      const membership = await tx.communityMember.findFirst({
        where: { communityId, userId: request.userId },
        select: { id: true, status: true },
      });
      if (membership?.status === "BANNED") throw new SocialError("That student is banned from this community.", 409);
      if (membership?.status !== "ACTIVE") {
        if (membership) {
          await tx.communityMember.update({
            where: { id: membership.id },
            data: { status: "ACTIVE", role: "MEMBER", joinedAt: new Date(), lastSeenAt: new Date() },
          });
        } else {
          await tx.communityMember.create({
            data: {
              universityId: viewer.universityId,
              communityId,
              userId: request.userId,
              role: "MEMBER",
            },
          });
        }
        await tx.community.update({ where: { id: communityId }, data: { memberCount: { increment: 1 } } });
      }
    }
    await tx.joinRequest.update({
      where: { id: request.id },
      data: {
        status: decision === "APPROVE" ? "APPROVED" : "DECLINED",
        decidedById: viewer.userId,
        decidedAt: new Date(),
      },
    });
    await communityAudit(tx, viewer, decision === "APPROVE" ? "community.request.approve" : "community.request.decline", communityId, {
      requestId: request.id,
    });
  });
}

export async function listCommunityMembers(
  viewer: SocialViewer,
  communityId: string,
  options: { q?: string; status?: "ACTIVE" | "BANNED" } = {},
): Promise<CommunityMemberView[]> {
  const db = tenantDb(viewer.universityId);
  const access = await requireAccess(db, viewer, communityId);
  const status = options.status ?? "ACTIVE";
  if (status === "BANNED") {
    if (!canAccessCommunityAction(access, "BAN_MEMBER")) throw new SocialError("You don't have permission to view banned members.", 403);
  } else if (!canAccessCommunityAction(access, "VIEW_MEMBERS")) {
    throw new SocialError("Join this community to see its members.", 403);
  }
  const q = options.q?.trim();
  const rows = await db.communityMember.findMany({
    where: {
      communityId,
      status,
      ...(q
        ? {
            user: {
              OR: [
                { username: { contains: q, mode: "insensitive" } },
                { fullName: { contains: q, mode: "insensitive" } },
              ],
            },
          }
        : {}),
    },
    orderBy: [{ role: "asc" }, { joinedAt: "asc" }],
    take: 200,
    select: {
      role: true,
      status: true,
      joinedAt: true,
      mutedUntil: true,
      user: {
        select: {
          id: true,
          username: true,
          fullName: true,
          photoUrl: true,
          level: true,
          department: { select: { name: true } },
        },
      },
    },
  });
  return rows.map((row) => ({
    userId: row.user.id,
    username: row.user.username,
    fullName: row.user.fullName,
    photoUrl: row.user.photoUrl,
    role: row.role,
    status: row.status,
    departmentName: row.user.department?.name ?? null,
    level: row.user.level,
    joinedAt: row.joinedAt.toISOString(),
    mutedUntil: row.mutedUntil?.toISOString() ?? null,
    isOwner: row.role === "OWNER",
    isViewer: row.user.id === viewer.userId,
  }));
}

export async function updateMemberRole(
  viewer: SocialViewer,
  communityId: string,
  targetUserId: string,
  role: "MODERATOR" | "MEMBER",
): Promise<void> {
  const db = tenantDb(viewer.universityId);
  const access = await assertAction(db, viewer, communityId, "MANAGE_ROLES");
  if (access.role !== "OWNER") throw new SocialError("Only the owner can change roles.", 403);
  const target = await db.communityMember.findFirst({
      where: { communityId, userId: targetUserId },
    select: { role: true, status: true },
  });
  if (!target || target.status !== "ACTIVE") throw new SocialError("That member isn't active.", 404);
  if (target.role === "OWNER") throw new SocialError("Transfer ownership instead of changing the owner's role.", 409);
  if (target.role === role) return;
  await db.$transaction(async (tx) => {
    await tx.communityMember.updateMany({
      where: { communityId, userId: targetUserId },
      data: { role },
    });
    await communityAudit(tx, viewer, "community.member.role", communityId, { targetUserId, role });
  });
}

export async function transferCommunityOwnership(
  viewer: SocialViewer,
  communityId: string,
  targetUserId: string,
): Promise<void> {
  const db = tenantDb(viewer.universityId);
  const access = await assertAction(db, viewer, communityId, "TRANSFER_OWNERSHIP");
  const target = await db.communityMember.findFirst({
      where: { communityId, userId: targetUserId },
    select: { role: true, status: true },
  });
  if (
    !target ||
    !canTransferOwnership({
      actorId: viewer.userId,
      actorRole: access.role ?? "MEMBER",
      targetId: targetUserId,
      targetRole: target.role,
      targetStatus: target.status,
    })
  ) {
    throw new SocialError("Choose an active member or moderator to own this community.", 409);
  }
  await db.$transaction(async (tx) => {
    // Promote first: the database trigger refuses to remove the last owner.
    await tx.communityMember.updateMany({
      where: { communityId, userId: targetUserId },
      data: { role: "OWNER" },
    });
    await tx.communityMember.updateMany({
      where: { communityId, userId: viewer.userId },
      data: { role: "MODERATOR" },
    });
    await communityAudit(tx, viewer, "community.ownership.transfer", communityId, { targetUserId });
  });
}

export async function removeCommunityMember(
  viewer: SocialViewer,
  communityId: string,
  targetUserId: string,
): Promise<void> {
  const db = tenantDb(viewer.universityId);
  const access = await assertAction(db, viewer, communityId, "REMOVE_MEMBER");
  if (targetUserId === viewer.userId) throw new SocialError("Use leave instead of removing yourself.", 400);
  const target = await db.communityMember.findFirst({
      where: { communityId, userId: targetUserId },
    select: { role: true, status: true },
  });
  if (!target || target.status !== "ACTIVE") throw new SocialError("That member isn't active.", 404);
  if (target.role === "OWNER") throw new SocialError("The owner can't be removed.", 409);
  if (target.role === "MODERATOR" && access.role !== "OWNER") {
    throw new SocialError("Only the owner can remove a moderator.", 403);
  }
  await db.$transaction(async (tx) => {
    await tx.communityMember.updateMany({
      where: { communityId, userId: targetUserId },
      data: { status: "LEFT", role: "MEMBER", mutedUntil: null },
    });
    await tx.community.update({ where: { id: communityId }, data: { memberCount: { decrement: 1 } } });
    await communityAudit(tx, viewer, "community.member.remove", communityId, { targetUserId });
  });
}

export async function muteCommunityMember(
  viewer: SocialViewer,
  communityId: string,
  targetUserId: string,
  hours: number,
): Promise<void> {
  const db = tenantDb(viewer.universityId);
  const access = await assertAction(db, viewer, communityId, "MUTE_MEMBER");
  const safeHours = Math.min(Math.max(Math.floor(hours), 1), 24 * 30);
  const target = await db.communityMember.findFirst({
      where: { communityId, userId: targetUserId },
    select: { role: true, status: true },
  });
  if (!target || target.status !== "ACTIVE") throw new SocialError("That member isn't active.", 404);
  if (target.role === "OWNER") throw new SocialError("The owner can't be muted.", 409);
  if (target.role === "MODERATOR" && access.role !== "OWNER") {
    throw new SocialError("Only the owner can mute a moderator.", 403);
  }
  const mutedUntil = new Date(Date.now() + safeHours * 60 * 60 * 1000);
  await db.$transaction(async (tx) => {
    await tx.communityMember.updateMany({
      where: { communityId, userId: targetUserId },
      data: { mutedUntil },
    });
    await communityAudit(tx, viewer, "community.member.mute", communityId, { targetUserId, hours: safeHours });
  });
}

export async function unmuteCommunityMember(
  viewer: SocialViewer,
  communityId: string,
  targetUserId: string,
): Promise<void> {
  const db = tenantDb(viewer.universityId);
  await assertAction(db, viewer, communityId, "MUTE_MEMBER");
  await db.$transaction(async (tx) => {
    await tx.communityMember.updateMany({
      where: { communityId, userId: targetUserId, status: "ACTIVE" },
      data: { mutedUntil: null },
    });
    await communityAudit(tx, viewer, "community.member.unmute", communityId, { targetUserId });
  });
}

export async function banCommunityMember(
  viewer: SocialViewer,
  communityId: string,
  targetUserId: string,
  reason: string,
): Promise<void> {
  const db = tenantDb(viewer.universityId);
  const access = await assertAction(db, viewer, communityId, "BAN_MEMBER");
  const target = await db.communityMember.findFirst({
      where: { communityId, userId: targetUserId },
    select: { role: true, status: true },
  });
  if (!target) throw new SocialError("That student isn't a member.", 404);
  if (target.role === "OWNER") throw new SocialError("The owner can't be banned.", 409);
  if (target.role === "MODERATOR" && access.role !== "OWNER") {
    throw new SocialError("Only the owner can ban a moderator.", 403);
  }
  const note = reason.trim().slice(0, 300);
  if (note.length < 2) throw new SocialError("Add a short reason for the ban.");
  await db.$transaction(async (tx) => {
    const wasActive = target.status === "ACTIVE";
    await tx.communityMember.updateMany({
      where: { communityId, userId: targetUserId },
      data: {
        status: "BANNED",
        role: "MEMBER",
        mutedUntil: null,
        bannedById: viewer.userId,
        bannedReason: note,
      },
    });
    if (wasActive) {
      await tx.community.update({ where: { id: communityId }, data: { memberCount: { decrement: 1 } } });
    }
    await tx.joinRequest.updateMany({
      where: { communityId, userId: targetUserId, status: "PENDING" },
      data: { status: "DECLINED", decidedById: viewer.userId, decidedAt: new Date() },
    });
    await communityAudit(tx, viewer, "community.member.ban", communityId, { targetUserId, reason: note });
  });
}

export async function unbanCommunityMember(
  viewer: SocialViewer,
  communityId: string,
  targetUserId: string,
): Promise<void> {
  const db = tenantDb(viewer.universityId);
  await assertAction(db, viewer, communityId, "BAN_MEMBER");
  await db.$transaction(async (tx) => {
    await tx.communityMember.updateMany({
      where: { communityId, userId: targetUserId, status: "BANNED" },
      data: {
        status: "LEFT",
        role: "MEMBER",
        bannedById: null,
        bannedReason: null,
      },
    });
    await communityAudit(tx, viewer, "community.member.unban", communityId, { targetUserId });
  });
}

/* ------------------------------- invites -------------------------------- */

function inviteView(row: {
  id: string;
  kind: "USER" | "LINK";
  expiresAt: Date;
  maxUses: number | null;
  uses: number;
  status: "ACTIVE" | "REVOKED" | "EXPIRED" | "USED";
  createdAt: Date;
  invitedUser: { username: string; fullName: string; photoUrl: string | null } | null;
  createdBy: { username: string; fullName: string } | null;
}, token?: string, slug?: string): CommunityInviteView {
  return {
    id: row.id,
    kind: row.kind,
    ...(token ? { token } : {}),
    ...(token && slug ? { url: `/c/${slug}?invite=${token}` } : {}),
    expiresAt: row.expiresAt.toISOString(),
    maxUses: row.maxUses,
    uses: row.uses,
    status: row.status,
    invitedUser: row.invitedUser,
    createdBy: row.createdBy,
    createdAt: row.createdAt.toISOString(),
  };
}

export async function listCommunityInvites(viewer: SocialViewer, communityId: string): Promise<CommunityInviteView[]> {
  const db = tenantDb(viewer.universityId);
  await assertAction(db, viewer, communityId, "INVITE");
  const now = new Date();
  const rows = await db.communityInvite.findMany({
    where: { communityId },
    orderBy: { createdAt: "desc" },
    take: 60,
    select: {
      id: true,
      kind: true,
      expiresAt: true,
      maxUses: true,
      uses: true,
      status: true,
      createdAt: true,
      invitedUser: { select: { username: true, fullName: true, photoUrl: true } },
      createdBy: { select: { username: true, fullName: true } },
    },
  });
  return rows.map((row) => {
    const expired = row.status === "ACTIVE" && row.expiresAt <= now;
    return inviteView({ ...row, status: expired ? "EXPIRED" : row.status });
  });
}

export async function createCommunityInvite(
  viewer: SocialViewer,
  communityId: string,
  input: { kind: "USER" | "LINK"; username?: string; days?: number; maxUses?: number | null },
): Promise<CommunityInviteView> {
  const limit = await rateLimit("communityInvite", viewer.userId);
  if (!limit.success) throw new SocialError("Too many invites today. Try again tomorrow.", 429);
  const db = tenantDb(viewer.universityId);
  await assertAction(db, viewer, communityId, "INVITE");
  const active = await db.communityInvite.count({
    where: { communityId, status: "ACTIVE", expiresAt: { gt: new Date() } },
  });
  if (active >= MAX_ACTIVE_INVITES) throw new SocialError("This community has the maximum number of active invites.", 409);
  const days = input.days ?? DEFAULT_INVITE_DAYS;
  const expiresAt = inviteExpiry(days);
  const community = await db.community.findFirst({
    where: { id: communityId },
    select: { slug: true },
  });
  if (!community) throw new SocialError("This community isn't available.", 404);

  if (input.kind === "USER") {
    const username = (input.username ?? "").trim().replace(/^@/, "");
    if (!username) throw new SocialError("Enter a username to invite.");
    const invited = await db.user.findFirst({
      where: { username, status: { in: ["VERIFIED", "ALUMNI"] } },
      select: { id: true, username: true, fullName: true, photoUrl: true },
    });
    if (!invited || invited.id === viewer.userId) throw new SocialError("That student isn't available to invite.", 404);
    const [blocked, membership, existing] = await Promise.all([
      db.block.findFirst({
        where: {
          OR: [
            { userId: viewer.userId, blockedUserId: invited.id },
            { userId: invited.id, blockedUserId: viewer.userId },
          ],
        },
        select: { id: true },
      }),
      db.communityMember.findFirst({
      where: { communityId, userId: invited.id },
        select: { status: true },
      }),
      db.communityInvite.findFirst({
        where: { communityId, invitedUserId: invited.id, status: "ACTIVE", expiresAt: { gt: new Date() } },
        select: { id: true },
      }),
    ]);
    if (blocked) throw new SocialError("That student isn't available to invite.", 404);
    if (membership?.status === "ACTIVE") throw new SocialError("That student is already a member.", 409);
    if (membership?.status === "BANNED") throw new SocialError("That student can't be invited.", 409);
    if (existing) throw new SocialError("That student already has an active invite.", 409);
    const created = await db.$transaction(async (tx) => {
      const invite = await tx.communityInvite.create({
        data: {
          universityId: viewer.universityId,
          communityId,
          createdById: viewer.userId,
          kind: "USER",
          invitedUserId: invited.id,
          expiresAt,
        },
        select: {
          id: true,
          kind: true,
          expiresAt: true,
          maxUses: true,
          uses: true,
          status: true,
          createdAt: true,
        },
      });
      await communityAudit(tx, viewer, "community.invite.user", communityId, { invitedUserId: invited.id });
      return invite;
    });
    return inviteView({ ...created, invitedUser: invited, createdBy: { username: viewer.username, fullName: viewer.fullName } });
  }

  const requestedUses = input.maxUses ?? 10;
  const maxUses = Number.isFinite(requestedUses) ? Math.min(Math.max(Math.floor(requestedUses), 1), 100) : 10;
  const token = generateInviteToken();
  const created = await db.$transaction(async (tx) => {
    const invite = await tx.communityInvite.create({
      data: {
        universityId: viewer.universityId,
        communityId,
        createdById: viewer.userId,
        kind: "LINK",
        tokenHash: hashInviteToken(token),
        expiresAt,
        maxUses,
      },
      select: {
        id: true,
        kind: true,
        expiresAt: true,
        maxUses: true,
        uses: true,
        status: true,
        createdAt: true,
      },
    });
    await communityAudit(tx, viewer, "community.invite.link", communityId, { maxUses });
    return invite;
  });
  return inviteView(
    { ...created, invitedUser: null, createdBy: { username: viewer.username, fullName: viewer.fullName } },
    token,
    community.slug,
  );
}

export async function revokeCommunityInvite(
  viewer: SocialViewer,
  communityId: string,
  inviteId: string,
): Promise<void> {
  const db = tenantDb(viewer.universityId);
  await assertAction(db, viewer, communityId, "INVITE");
  const result = await db.communityInvite.updateMany({
    where: { id: inviteId, communityId, status: "ACTIVE" },
    data: { status: "REVOKED", revokedAt: new Date() },
  });
  if (result.count === 0) throw new SocialError("That invite is no longer active.", 409);
  await communityAudit(db, viewer, "community.invite.revoke", communityId, { inviteId });
}

export async function listPendingInvitations(viewer: SocialViewer): Promise<PendingInvitationView[]> {
  const db = tenantDb(viewer.universityId);
  const now = new Date();
  const rows = await db.communityInvite.findMany({
    where: {
      invitedUserId: viewer.userId,
      status: "ACTIVE",
      expiresAt: { gt: now },
      community: { status: "ACTIVE" },
    },
    orderBy: { createdAt: "desc" },
    take: 20,
    select: {
      id: true,
      createdAt: true,
      expiresAt: true,
      kind: true,
      uses: true,
      maxUses: true,
      status: true,
      invitedUserId: true,
      community: {
        select: {
          id: true,
          name: true,
          slug: true,
          iconPublicId: true,
          isOfficial: true,
          memberCount: true,
        },
      },
      createdBy: { select: { username: true, fullName: true } },
    },
  });
  const memberIds = await db.communityMember.findMany({
    where: { userId: viewer.userId, status: "ACTIVE", communityId: { in: rows.map((row) => row.community.id) } },
    select: { communityId: true },
  });
  const joined = new Set(memberIds.map((row) => row.communityId));
  return rows
    .filter((row) => !joined.has(row.community.id) && inviteIsUsable(row, now))
    .map((row) => ({
      id: row.id,
      community: {
        id: row.community.id,
        name: row.community.name,
        slug: row.community.slug,
        iconUrl: communityImageUrl(row.community.iconPublicId),
        isOfficial: row.community.isOfficial,
        memberCount: row.community.memberCount,
      },
      invitedBy: row.createdBy,
      createdAt: row.createdAt.toISOString(),
      expiresAt: row.expiresAt.toISOString(),
    }));
}

async function acceptInviteRecord(
  viewer: SocialViewer,
  invite: {
    id: string;
    kind: "USER" | "LINK";
    invitedUserId: string | null;
    status: "ACTIVE" | "REVOKED" | "EXPIRED" | "USED";
    expiresAt: Date;
    uses: number;
    maxUses: number | null;
    community: { id: string; slug: string; status: string };
  },
): Promise<{ communityId: string; slug: string }> {
  const db = tenantDb(viewer.universityId);
  if (invite.kind === "USER" && invite.invitedUserId !== viewer.userId) {
    throw new SocialError("This invite isn't available.", 404);
  }
  const error = inviteError(invite);
  if (error) throw new SocialError(error, 410);
  if (invite.community.status !== "ACTIVE") throw new SocialError("This community isn't available.", 404);
  await db.$transaction(async (tx) => {
    const membership = await tx.communityMember.findFirst({
      where: { communityId: invite.community.id, userId: viewer.userId },
      select: { id: true, status: true },
    });
    if (membership?.status === "BANNED") throw new SocialError("You can't join this community.", 403);
    if (membership?.status !== "ACTIVE") {
      if (membership) {
        await tx.communityMember.update({
          where: { id: membership.id },
          data: { status: "ACTIVE", role: "MEMBER", joinedAt: new Date(), lastSeenAt: new Date() },
        });
      } else {
        await tx.communityMember.create({
          data: {
            universityId: viewer.universityId,
            communityId: invite.community.id,
            userId: viewer.userId,
            role: "MEMBER",
          },
        });
      }
      await tx.community.update({ where: { id: invite.community.id }, data: { memberCount: { increment: 1 } } });
    }
    await tx.joinRequest.updateMany({
      where: { communityId: invite.community.id, userId: viewer.userId, status: "PENDING" },
      data: { status: "APPROVED", decidedById: viewer.userId, decidedAt: new Date() },
    });
    const nextUses = invite.uses + 1;
    const spent = invite.kind === "USER" || (invite.maxUses !== null && nextUses >= invite.maxUses);
    await tx.communityInvite.update({
      where: { id: invite.id },
      data: { uses: { increment: 1 }, ...(spent ? { status: "USED" } : {}) },
    });
    await communityAudit(tx, viewer, "community.invite.accept", invite.community.id, { inviteId: invite.id });
  });
  return { communityId: invite.community.id, slug: invite.community.slug };
}

export async function acceptInviteToken(viewer: SocialViewer, token: string): Promise<{ communityId: string; slug: string }> {
  const limit = await rateLimit("communityJoin", viewer.userId);
  if (!limit.success) throw new SocialError("Too many join attempts today. Try again tomorrow.", 429);
  const db = tenantDb(viewer.universityId);
  const invite = await db.communityInvite.findFirst({
    where: { tokenHash: hashInviteToken(token) },
    select: {
      id: true,
      kind: true,
      invitedUserId: true,
      status: true,
      expiresAt: true,
      uses: true,
      maxUses: true,
      community: { select: { id: true, slug: true, status: true } },
    },
  });
  if (!invite) throw new SocialError("This invite isn't available.", 404);
  return acceptInviteRecord(viewer, invite);
}

export async function acceptInvitation(viewer: SocialViewer, inviteId: string): Promise<{ communityId: string; slug: string }> {
  const limit = await rateLimit("communityJoin", viewer.userId);
  if (!limit.success) throw new SocialError("Too many join attempts today. Try again tomorrow.", 429);
  const db = tenantDb(viewer.universityId);
  const invite = await db.communityInvite.findFirst({
    where: { id: inviteId, invitedUserId: viewer.userId },
    select: {
      id: true,
      kind: true,
      invitedUserId: true,
      status: true,
      expiresAt: true,
      uses: true,
      maxUses: true,
      community: { select: { id: true, slug: true, status: true } },
    },
  });
  if (!invite) throw new SocialError("This invite isn't available.", 404);
  return acceptInviteRecord(viewer, invite);
}

export async function declineInvitation(viewer: SocialViewer, inviteId: string): Promise<void> {
  const db = tenantDb(viewer.universityId);
  const result = await db.communityInvite.updateMany({
    where: { id: inviteId, invitedUserId: viewer.userId, status: "ACTIVE" },
    data: { status: "REVOKED", revokedAt: new Date() },
  });
  if (result.count === 0) throw new SocialError("This invite isn't available.", 404);
}

/* ------------------------------ resources ------------------------------- */

const RESOURCE_TITLE_MAX = 120;
const RESOURCE_DESCRIPTION_MAX = 300;

function resourceView(
  row: {
    id: string;
    kind: "FILE" | "LINK";
    title: string;
    description: string | null;
    category: CommunityCategory;
    mimeType: string | null;
    sizeBytes: number | null;
    url: string | null;
    createdAt: Date;
    uploaderId: string;
    uploader: { username: string; fullName: string; photoUrl: string | null };
  },
  viewer: SocialViewer,
  access: CommunityAccess,
): CommunityResourceView {
  return {
    id: row.id,
    kind: row.kind,
    title: row.title,
    description: row.description,
    category: row.category,
    mimeType: row.mimeType,
    sizeBytes: row.sizeBytes,
    ...(row.kind === "LINK" ? { url: row.url } : {}),
    createdAt: row.createdAt.toISOString(),
    uploader: row.uploader,
    canRemove:
      row.uploaderId === viewer.userId ||
      canAccessCommunityAction(access, "MANAGE_RESOURCES"),
  };
}

export async function listCommunityResources(
  viewer: SocialViewer,
  communityId: string,
  options: { category?: CommunityCategory | null; kind?: "FILE" | "LINK" | null; q?: string } = {},
): Promise<CommunityResourceView[]> {
  const db = tenantDb(viewer.universityId);
  const access = await requireAccess(db, viewer, communityId);
  if (!canAccessCommunityAction(access, "VIEW_RESOURCES")) {
    throw new SocialError("Join this community to see its resources.", 403);
  }
  const rows = await db.communityResource.findMany({
    where: {
      communityId,
      status: "ACTIVE",
      ...(options.category ? { category: options.category } : {}),
      ...(options.kind ? { kind: options.kind } : {}),
      ...(options.q?.trim()
        ? {
            OR: [
              { title: { contains: options.q.trim(), mode: "insensitive" } },
              { description: { contains: options.q.trim(), mode: "insensitive" } },
            ],
          }
        : {}),
    },
    orderBy: [{ createdAt: "desc" }],
    take: 100,
    select: {
      id: true,
      kind: true,
      title: true,
      description: true,
      category: true,
      mimeType: true,
      sizeBytes: true,
      url: true,
      createdAt: true,
      uploaderId: true,
      uploader: { select: { username: true, fullName: true, photoUrl: true } },
    },
  });
  return rows.map((row) => resourceView(row, viewer, access));
}

async function assertResourceCapacity(db: TenantClient, communityId: string): Promise<void> {
  const count = await db.communityResource.count({ where: { communityId, status: "ACTIVE" } });
  if (count >= 200) throw new SocialError("This community has reached its resource limit.", 409);
}

export async function createLinkResource(
  viewer: SocialViewer,
  communityId: string,
  input: { title: string; description?: string; category: CommunityCategory; url: string },
): Promise<CommunityResourceView> {
  const db = tenantDb(viewer.universityId);
  const access = await requireAccess(db, viewer, communityId);
  if (!canAccessCommunityAction(access, "UPLOAD_RESOURCE")) {
    throw new SocialError("Members can't add resources in this community.", 403);
  }
  const title = input.title.trim();
  if (title.length < 2 || title.length > RESOURCE_TITLE_MAX) throw new SocialError("Resource titles need 2–120 characters.");
  const description = input.description?.trim().slice(0, RESOURCE_DESCRIPTION_MAX) || null;
  const urlError = (await import("@/lib/domain/community")).validateResourceLink(input.url.trim());
  if (urlError) throw new SocialError(urlError);
  await assertResourceCapacity(db, communityId);
  const created = await db.communityResource.create({
    data: {
      universityId: viewer.universityId,
      communityId,
      uploaderId: viewer.userId,
      kind: "LINK",
      title,
      description,
      category: input.category,
      url: input.url.trim(),
      mimeType: "text/uri-list",
    },
    select: {
      id: true,
      kind: true,
      title: true,
      description: true,
      category: true,
      mimeType: true,
      sizeBytes: true,
      url: true,
      createdAt: true,
      uploaderId: true,
      uploader: { select: { username: true, fullName: true, photoUrl: true } },
    },
  });
  await communityAudit(db, viewer, "community.resource.add", communityId, { resourceId: created.id, kind: "LINK" });
  return resourceView(created, viewer, access);
}

export async function createFileResource(
  viewer: SocialViewer,
  communityId: string,
  input: {
    title: string;
    description?: string;
    category: CommunityCategory;
    fileKey: string;
    mimeType: string;
    sizeBytes: number;
  },
): Promise<CommunityResourceView> {
  const db = tenantDb(viewer.universityId);
  const access = await requireAccess(db, viewer, communityId);
  if (!canAccessCommunityAction(access, "UPLOAD_RESOURCE")) {
    throw new SocialError("Members can't add resources in this community.", 403);
  }
  const title = input.title.trim();
  if (title.length < 2 || title.length > RESOURCE_TITLE_MAX) throw new SocialError("Resource titles need 2–120 characters.");
  const description = input.description?.trim().slice(0, RESOURCE_DESCRIPTION_MAX) || null;
  await assertResourceCapacity(db, communityId);
  const created = await db.communityResource.create({
    data: {
      universityId: viewer.universityId,
      communityId,
      uploaderId: viewer.userId,
      kind: "FILE",
      title,
      description,
      category: input.category,
      fileKey: input.fileKey,
      mimeType: input.mimeType,
      sizeBytes: input.sizeBytes,
    },
    select: {
      id: true,
      kind: true,
      title: true,
      description: true,
      category: true,
      mimeType: true,
      sizeBytes: true,
      url: true,
      createdAt: true,
      uploaderId: true,
      uploader: { select: { username: true, fullName: true, photoUrl: true } },
    },
  });
  await communityAudit(db, viewer, "community.resource.add", communityId, { resourceId: created.id, kind: "FILE" });
  return resourceView(created, viewer, access);
}

export async function removeCommunityResource(
  viewer: SocialViewer,
  communityId: string,
  resourceId: string,
): Promise<void> {
  const db = tenantDb(viewer.universityId);
  const access = await requireAccess(db, viewer, communityId);
  const resource = await db.communityResource.findFirst({
    where: { id: resourceId, communityId, status: "ACTIVE" },
    select: { id: true, uploaderId: true, fileKey: true },
  });
  if (!resource) throw new SocialError("That resource is no longer available.", 404);
  const allowed =
    resource.uploaderId === viewer.userId
      ? canAccessCommunityAction(access, "VIEW_RESOURCES")
      : canAccessCommunityAction(access, "MANAGE_RESOURCES");
  if (!allowed) throw new SocialError("You don't have permission to remove that resource.", 403);
  await db.$transaction(async (tx) => {
    await tx.communityResource.update({
      where: { id: resource.id },
      data: { status: "REMOVED", removedById: viewer.userId, removedAt: new Date() },
    });
    await tx.auditLog.create({
      data: {
        actorId: viewer.userId,
        universityId: viewer.universityId,
        action: "community.resource.remove",
        targetType: "COMMUNITY",
        targetId: communityId,
        metadata: { resourceId: resource.id },
      },
    });
  });
  if (resource.fileKey) {
    const { deleteResourceFile } = await import("@/lib/media/resource-store");
    await deleteResourceFile(resource.fileKey).catch(() => undefined);
  }
}

export async function getResourceDownload(
  viewer: SocialViewer,
  communityId: string,
  resourceId: string,
): Promise<{ kind: "FILE"; fileKey: string; title: string; mimeType: string } | { kind: "LINK"; url: string }> {
  const db = tenantDb(viewer.universityId);
  const access = await requireAccess(db, viewer, communityId);
  if (!canAccessCommunityAction(access, "DOWNLOAD_RESOURCE")) {
    throw new SocialError("Join this community to download its resources.", 403);
  }
  const resource = await db.communityResource.findFirst({
    where: { id: resourceId, communityId, status: "ACTIVE" },
    select: { kind: true, title: true, fileKey: true, mimeType: true, url: true },
  });
  if (!resource) throw new SocialError("That resource is no longer available.", 404);
  if (resource.kind === "LINK") {
    if (!resource.url) throw new SocialError("That link isn't available.", 404);
    return { kind: "LINK", url: resource.url };
  }
  if (!resource.fileKey) throw new SocialError("That file isn't available.", 404);
  return {
    kind: "FILE",
    fileKey: resource.fileKey,
    title: resource.title,
    mimeType: resource.mimeType ?? "application/octet-stream",
  };
}

/* -------------------------------- pins ---------------------------------- */

export async function pinCommunityPost(
  viewer: SocialViewer,
  communityId: string,
  postId: string,
): Promise<void> {
  const db = tenantDb(viewer.universityId);
  await assertAction(db, viewer, communityId, "PIN_POST");
  const [post, pins] = await Promise.all([
    db.post.findFirst({
      where: { id: postId, communityId, status: "ACTIVE" },
      select: { id: true },
    }),
    db.communityPin.findMany({ where: { communityId }, select: { position: true } }),
  ]);
  if (!post) throw new SocialError("That post isn't available.", 404);
  if (pins.length >= MAX_PINS) throw new SocialError(`You can pin up to ${MAX_PINS} posts.`, 409);
  const position = [0, 1, 2].find((value) => !pins.some((pin) => pin.position === value));
  if (position === undefined) throw new SocialError("All pin slots are taken.", 409);
  try {
    await db.$transaction(async (tx) => {
      await tx.communityPin.create({
        data: {
          universityId: viewer.universityId,
          communityId,
          postId,
          position,
          pinnedById: viewer.userId,
        },
      });
      await communityAudit(tx, viewer, "community.post.pin", communityId, { postId, position });
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      throw new SocialError("That post is already pinned.", 409);
    }
    throw error;
  }
}

export async function unpinCommunityPost(
  viewer: SocialViewer,
  communityId: string,
  postId: string,
): Promise<void> {
  const db = tenantDb(viewer.universityId);
  await assertAction(db, viewer, communityId, "PIN_POST");
  await db.$transaction(async (tx) => {
    await tx.communityPin.deleteMany({ where: { communityId, postId } });
    await communityAudit(tx, viewer, "community.post.unpin", communityId, { postId });
  });
}

/* ------------------------------- reports -------------------------------- */

export async function listCommunityReports(viewer: SocialViewer, communityId: string): Promise<CommunityReportView[]> {
  const db = tenantDb(viewer.universityId);
  await assertAction(db, viewer, communityId, "VIEW_REPORTS");
  const rows = await db.report.findMany({
    where: { communityId, status: "PENDING" },
    orderBy: { createdAt: "asc" },
    take: 100,
    select: {
      id: true,
      reason: true,
      details: true,
      status: true,
      createdAt: true,
      targetType: true,
      targetId: true,
      reporter: { select: { username: true, fullName: true } },
    },
  });
  const postIds = rows.filter((row) => row.targetType === "POST").map((row) => row.targetId);
  const commentIds = rows.filter((row) => row.targetType === "COMMENT").map((row) => row.targetId);
  const [posts, comments] = await Promise.all([
    postIds.length
      ? db.post.findMany({
          where: { id: { in: postIds } },
          select: {
            id: true,
            body: true,
            author: { select: { id: true, username: true, fullName: true } },
          },
        })
      : [],
    commentIds.length
      ? db.comment.findMany({
          where: { id: { in: commentIds } },
          select: {
            id: true,
            body: true,
            author: { select: { id: true, username: true, fullName: true } },
          },
        })
      : [],
  ]);
  const postMap = new Map(posts.map((post) => [post.id, post]));
  const commentMap = new Map(comments.map((comment) => [comment.id, comment]));
  return rows.flatMap((row) => {
    const target = row.targetType === "POST" ? postMap.get(row.targetId) : commentMap.get(row.targetId);
    if (!target) return [];
    return [
      {
        id: row.id,
        reason: row.reason,
        details: row.details,
        status: row.status,
        createdAt: row.createdAt.toISOString(),
        targetType: row.targetType,
        targetId: row.targetId,
        targetExcerpt: target.body.slice(0, 180) || "(media post)",
        reporter: row.reporter,
        author: target.author,
      },
    ];
  });
}

export async function resolveCommunityReport(
  viewer: SocialViewer,
  communityId: string,
  reportId: string,
  action: "DISMISS" | "REMOVE_CONTENT",
): Promise<void> {
  const db = tenantDb(viewer.universityId);
  await assertAction(db, viewer, communityId, "REMOVE_CONTENT");
  const report = await db.report.findFirst({
    where: { id: reportId, communityId, status: "PENDING" },
    select: { id: true, targetType: true, targetId: true },
  });
  if (!report) throw new SocialError("That report has already been handled.", 409);
  await db.$transaction(async (tx) => {
    if (action === "REMOVE_CONTENT") {
      if (report.targetType === "POST") {
        const post = await tx.post.findFirst({
          where: { id: report.targetId, communityId, status: "ACTIVE" },
          select: { id: true, authorId: true },
        });
        if (post) {
          await tx.post.update({
            where: { id: post.id },
            data: {
              status: "REMOVED",
              removedAt: new Date(),
              moderationReason: "Removed by community moderators",
            },
          });
          await tx.community.update({ where: { id: communityId }, data: { postCount: { decrement: 1 } } });
        }
      } else {
        await tx.comment.updateMany({
          where: { id: report.targetId, post: { communityId }, status: "ACTIVE" },
          data: { status: "REMOVED", moderationReason: "Removed by community moderators" },
        });
      }
    }
    await tx.report.update({
      where: { id: report.id },
      data: { status: "RESOLVED", resolvedAt: new Date(), resolvedById: viewer.userId },
    });
    await tx.moderationAction.create({
      data: {
        universityId: viewer.universityId,
        reportId: report.id,
        moderatorId: viewer.userId,
        targetType: report.targetType,
        targetId: report.targetId,
        action: action === "REMOVE_CONTENT" ? "REMOVE" : "KEEP",
        reason: action === "REMOVE_CONTENT" ? "Removed by community moderators" : "Community report dismissed",
      },
    });
    await communityAudit(tx, viewer, "community.report.resolve", communityId, { reportId, action });
  });
}

/* --------------------------- official + admin --------------------------- */

export async function requestOfficialCommunity(
  viewer: SocialViewer,
  communityId: string,
  noteInput: string,
): Promise<void> {
  const db = tenantDb(viewer.universityId);
  const access = await assertAction(db, viewer, communityId, "REQUEST_OFFICIAL");
  if (access.role !== "OWNER") throw new SocialError("Only the owner can request official status.", 403);
  const community = await db.community.findFirst({
    where: { id: communityId, status: "ACTIVE" },
    select: { isOfficial: true },
  });
  if (!community) throw new SocialError("This community isn't available.", 404);
  if (community.isOfficial) throw new SocialError("This community is already official.", 409);
  const note = noteInput.trim();
  if (note.length < 10 || note.length > 1000) throw new SocialError("Explain the request in 10–1,000 characters.");
  const existing = await db.communityOfficialRequest.findFirst({
    where: { communityId, status: "PENDING" },
    select: { id: true },
  });
  if (existing) throw new SocialError("There's already a pending official request.", 409);
  await db.$transaction(async (tx) => {
    await tx.communityOfficialRequest.create({
      data: {
        universityId: viewer.universityId,
        communityId,
        requestedById: viewer.userId,
        note,
      },
    });
    await communityAudit(tx, viewer, "community.official.request", communityId);
  });
}

export interface CommunityStaffViewer {
  userId: string;
  universityId: string;
  isUniversityStaff: boolean;
  isUniversityAdmin: boolean;
}

export async function listAdminCommunities(
  viewer: CommunityStaffViewer,
  options: { q?: string; status?: "ACTIVE" | "SUSPENDED" | "ARCHIVED" | "DELETED" } = {},
): Promise<CommunityAdminPayload> {
  if (!viewer.isUniversityStaff) throw new SocialError("University staff only.", 403);
  const db = tenantDb(viewer.universityId);
  const q = options.q?.trim();
  const where: Prisma.CommunityWhereInput = {
    ...(options.status ? { status: options.status } : {}),
    ...(q
      ? {
          OR: [
            { name: { contains: q, mode: "insensitive" } },
            { description: { contains: q, mode: "insensitive" } },
          ],
        }
      : {}),
  };
  const rows = await db.community.findMany({
    where,
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    take: 100,
    select: {
      id: true,
      name: true,
      slug: true,
      isOfficial: true,
      status: true,
      privacy: true,
      category: true,
      memberCount: true,
      postCount: true,
      createdAt: true,
      officialRequests: {
        where: { status: "PENDING" },
        select: { id: true },
        take: 1,
      },
    },
  });
  const [total, owners, reports, officialRequests] = await Promise.all([
    db.community.count({ where }),
    db.communityMember.findMany({
      where: { role: "OWNER", status: "ACTIVE", communityId: { in: rows.map((row) => row.id) } },
      select: {
        communityId: true,
        user: { select: { username: true, fullName: true } },
      },
    }),
    db.report.groupBy({
      by: ["communityId"],
      where: { communityId: { in: rows.map((row) => row.id) }, status: "PENDING" },
      _count: { _all: true },
    }),
    db.communityOfficialRequest.findMany({
      where: { status: "PENDING" },
      orderBy: { createdAt: "asc" },
      take: 50,
      select: {
        id: true,
        note: true,
        createdAt: true,
        community: { select: { id: true, name: true, slug: true } },
        requestedBy: { select: { username: true, fullName: true } },
      },
    }),
  ]);
  const ownerByCommunity = new Map(owners.map((row) => [row.communityId, row.user]));
  const reportByCommunity = new Map(reports.map((row) => [row.communityId, row._count._all]));
  return {
    rows: rows.map((row) => ({
      id: row.id,
      name: row.name,
      slug: row.slug,
      isOfficial: row.isOfficial,
      status: row.status,
      privacy: row.privacy,
      category: row.category,
      memberCount: row.memberCount,
      postCount: row.postCount,
      reportCount: reportByCommunity.get(row.id) ?? 0,
      owner: ownerByCommunity.get(row.id) ?? null,
      createdAt: row.createdAt.toISOString(),
      pendingOfficialRequest: row.officialRequests.length > 0,
    })),
    total,
    officialRequests: officialRequests.map((row) => ({
      id: row.id,
      community: row.community,
      requestedBy: row.requestedBy,
      note: row.note,
      createdAt: row.createdAt.toISOString(),
    })),
  };
}

export async function decideOfficialCommunity(
  viewer: CommunityStaffViewer,
  requestId: string,
  decision: "APPROVE" | "REJECT",
): Promise<void> {
  if (!viewer.isUniversityAdmin) throw new SocialError("University admins only.", 403);
  const db = tenantDb(viewer.universityId);
  const request = await db.communityOfficialRequest.findFirst({
    where: { id: requestId, status: "PENDING" },
    select: { id: true, communityId: true },
  });
  if (!request) throw new SocialError("That request has already been handled.", 409);
  await db.$transaction(async (tx) => {
    await tx.communityOfficialRequest.update({
      where: { id: request.id },
      data: {
        status: decision === "APPROVE" ? "APPROVED" : "REJECTED",
        decidedById: viewer.userId,
        decidedAt: new Date(),
      },
    });
    if (decision === "APPROVE") {
      await tx.community.update({ where: { id: request.communityId }, data: { isOfficial: true } });
    }
    await tx.auditLog.create({
      data: {
        actorId: viewer.userId,
        universityId: viewer.universityId,
        action: decision === "APPROVE" ? "community.official.approve" : "community.official.reject",
        targetType: "COMMUNITY",
        targetId: request.communityId,
        metadata: { requestId: request.id },
      },
    });
  });
}

export async function createOfficialCommunity(
  viewer: SocialViewer,
  input: CreateCommunityInput,
): Promise<{ id: string; slug: string }> {
  if (!viewer.isUniversityAdmin) throw new SocialError("University admins only.", 403);
  const created = await createCommunity({ ...input, viewer });
  const db = tenantDb(viewer.universityId);
  await db.community.update({ where: { id: created.id }, data: { isOfficial: true } });
  await db.auditLog.create({
    data: {
      actorId: viewer.userId,
      universityId: viewer.universityId,
      action: "community.official.create",
      targetType: "COMMUNITY",
      targetId: created.id,
      metadata: {},
    },
  });
  return created;
}

export async function adminModerateCommunity(
  viewer: CommunityStaffViewer,
  communityId: string,
  action: "SUSPEND" | "REINSTATE" | "ARCHIVE",
  reason: string,
): Promise<void> {
  if (!viewer.isUniversityStaff) throw new SocialError("University staff only.", 403);
  const db = tenantDb(viewer.universityId);
  const community = await db.community.findFirst({
    where: { id: communityId, status: { not: "DELETED" } },
    select: { id: true, status: true },
  });
  if (!community) throw new SocialError("This community isn't available.", 404);
  if (action === "REINSTATE" && community.status !== "SUSPENDED") {
    throw new SocialError("Only suspended communities can be reinstated.", 409);
  }
  const note = reason.trim().slice(0, 500);
  if (note.length < 3) throw new SocialError("Add a short reason.");
  const data =
    action === "SUSPEND"
      ? { status: "SUSPENDED" as const, suspendedAt: new Date() }
      : action === "ARCHIVE"
        ? { status: "ARCHIVED" as const, archivedAt: new Date() }
        : { status: "ACTIVE" as const, suspendedAt: null };
  await db.$transaction(async (tx) => {
    await tx.community.update({ where: { id: communityId }, data });
    await tx.auditLog.create({
      data: {
        actorId: viewer.userId,
        universityId: viewer.universityId,
        action: `community.admin.${action.toLowerCase()}`,
        targetType: "COMMUNITY",
        targetId: communityId,
        metadata: { reason: note },
      },
    });
  });
}
