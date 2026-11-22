import "server-only";
import type { Prisma } from "@prisma/client";
import { tenantDb, type TenantClient } from "@/lib/db/tenant";
import {
  canAccessCommunityAction,
  isMuted,
  type CommunityAccess,
  type CommunityAction,
  type CommunityMemberStatus,
  type CommunityPrivacy,
  type CommunityRole,
  type CommunityStatus,
} from "@/lib/domain/community";
import { postMediaUrl } from "@/lib/media/post-media";
import type { SocialViewer } from "./social";

/** Resolve a stored public id from either the Cloudinary or local adapter. */
export function communityImageUrl(publicId: string | null | undefined): string | null {
  if (!publicId) return null;
  if (publicId.startsWith("local:posts/")) {
    return `/uploads/posts/${publicId.slice("local:posts/".length)}.webp`;
  }
  return postMediaUrl(publicId);
}

export const communityAccessSelect = {
  id: true,
  privacy: true,
  status: true,
  allowMemberUploads: true,
} satisfies Prisma.CommunitySelect;

export type CommunityAccessRow = Prisma.CommunityGetPayload<{ select: typeof communityAccessSelect }>;

export const communityRefSelect = {
  id: true,
  name: true,
  slug: true,
  iconPublicId: true,
  privacy: true,
  status: true,
  isOfficial: true,
  memberCount: true,
} satisfies Prisma.CommunitySelect;

export type CommunityRefRow = Prisma.CommunityGetPayload<{ select: typeof communityRefSelect }>;

export function accessFromRows(
  community: CommunityAccessRow | CommunityRefRow,
  membership:
    | {
        status: string;
        role: string;
        mutedUntil: Date | null;
      }
    | null
    | undefined,
): CommunityAccess {
  return {
    communityId: community.id,
    privacy: community.privacy as CommunityPrivacy,
    status: community.status as CommunityStatus,
    memberStatus: (membership?.status as CommunityMemberStatus | undefined) ?? null,
    role: (membership?.role as CommunityRole | undefined) ?? null,
    mutedUntil: membership?.mutedUntil ?? null,
    allowMemberUploads: "allowMemberUploads" in community ? community.allowMemberUploads : false,
  };
}

/**
 * Load access for a batch of communities in two queries, never one per
 * community. This is the building block used by feeds, hashtag pages, search,
 * bookmarks and resource listings.
 */
export async function loadCommunityAccessMap(
  db: TenantClient,
  viewerId: string,
  communityIds: readonly string[],
): Promise<Map<string, CommunityAccess>> {
  const ids = [...new Set(communityIds.filter(Boolean))];
  if (ids.length === 0) return new Map();
  const [communities, memberships] = await Promise.all([
    db.community.findMany({
      where: { id: { in: ids }, status: { not: "DELETED" } },
      select: communityAccessSelect,
    }),
    db.communityMember.findMany({
      where: { userId: viewerId, communityId: { in: ids } },
      select: { communityId: true, status: true, role: true, mutedUntil: true },
    }),
  ]);
  const memberByCommunity = new Map(memberships.map((member) => [member.communityId, member]));
  return new Map(
    communities.map((community) => [
      community.id,
      accessFromRows(community, memberByCommunity.get(community.id)),
    ]),
  );
}

export async function loadCommunityAccess(
  viewer: SocialViewer,
  communityId: string,
): Promise<CommunityAccess | null> {
  const db = tenantDb(viewer.universityId);
  const map = await loadCommunityAccessMap(db, viewer.userId, [communityId]);
  return map.get(communityId) ?? null;
}

/** Communities whose posts may appear in Pulse "All" or the Communities chip. */
export async function joinedActiveCommunityIds(db: TenantClient, viewerId: string): Promise<string[]> {
  const rows = await db.communityMember.findMany({
    where: {
      userId: viewerId,
      status: "ACTIVE",
      community: { status: "ACTIVE" },
    },
    select: { communityId: true },
  });
  return rows.map((row) => row.communityId);
}

/**
 * Communities with readable content for non-feed surfaces. PUBLIC communities
 * are readable read-only; REQUEST and INVITE_ONLY only when the viewer is an
 * active member.
 */
export async function readableCommunityIds(db: TenantClient, viewerId: string): Promise<string[]> {
  const [joined, publicCommunities] = await Promise.all([
    db.communityMember.findMany({
      where: { userId: viewerId, status: "ACTIVE", community: { status: "ACTIVE" } },
      select: { communityId: true },
    }),
    db.community.findMany({
      where: { status: "ACTIVE", privacy: "PUBLIC" },
      select: { id: true },
    }),
  ]);
  return [...new Set([...joined.map((row) => row.communityId), ...publicCommunities.map((row) => row.id)])];
}

export function assertCommunityAction(
  access: CommunityAccess | null | undefined,
  action: CommunityAction,
  now = new Date(),
): boolean {
  return Boolean(access && canAccessCommunityAction(access, action, now));
}

export function postViewerCommunityState(access: CommunityAccess | null | undefined): {
  canInteract: boolean;
  isMember: boolean;
  role: CommunityRole | null;
  muted: boolean;
} {
  if (!access) return { canInteract: false, isMember: false, role: null, muted: false };
  const isMember = access.memberStatus === "ACTIVE";
  const muted = isMuted(access);
  return {
    canInteract:
      isMember &&
      access.status === "ACTIVE" &&
      !muted,
    isMember,
    role: access.role,
    muted,
  };
}
