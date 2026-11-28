import "server-only";
import { Prisma, type CommentStatus } from "@prisma/client";
import { tenantDb, type TenantClient } from "@/lib/db/tenant";
import { platformDb } from "@/lib/db/platform";
import {
  audienceOptionsFor,
  type Audience,
} from "@/lib/domain/academic";
import {
  canSeePostInCommunity,
  filterIncludesCommunityPosts,
  filterKindForLabel,
  firstLine,
  inheritedRepostAudience,
  isDuplicateBody,
  kindForScope,
  normalizeTag,
  parseHashtags,
  parseMentions,
  pollEndsAt,
  pollPercentages,
  pollResultsVisible,
  pollIsOpen,
  shouldFlagForReview,
  validatePollOptions,
  visibleAudienceFilter,
  MAX_POST_LENGTH,
  MAX_COMMENT_DEPTH,
  type PostAudienceKind,
} from "@/lib/domain/posts";
import { canAccessCommunityAction, type CommunityAccess } from "@/lib/domain/community";
import {
  assertCommunityAction,
  joinedActiveCommunityIds,
  loadCommunityAccessMap,
  postViewerCommunityState,
  readableCommunityIds,
  communityImageUrl,
} from "./community-access";
import { isAllowedPostPublicId, postMediaUrl } from "@/lib/media/post-media";
import {
  decodeTimeCursor,
  decodeScoreCursor,
  encodeTimeCursor,
  encodeScoreCursor,
} from "@/lib/posts/cursor";
import { DraftConflict, SocialError } from "@/lib/posts/errors";
import { isStaleDraftWrite, nextDraftVersion } from "@/lib/posts/draft-version";
import type {
  BookmarkPage,
  CommentView,
  DraftView,
  FeedFilter,
  FeedPage,
  HashtagPage,
  PostDetailPayload,
  PostMediaView,
  PostView,
  TrendingTag,
} from "@/lib/posts/types";
import { rateLimit } from "@/lib/security/rate-limit";
import {
  hiddenAuthorIds,
  isHiddenAuthor,
  loadRelationships,
  postSelect,
  viewerPostState,
  type PostRow,
  type RelationshipSets,
  type SocialViewer,
} from "./social";

const FEED_PAGE_SIZE = 10;
const COMMENT_PAGE_SIZE = 50;
const DRAFT_TYPES = new Set(["POST", "QUESTION", "POLL"]);

function authorView(row: PostRow["author"]) {
  return {
    id: row.id,
    username: row.username,
    fullName: row.fullName,
    photoUrl: row.photoUrl,
    isOfficial: row.roles.some((role) => role.role === "OFFICIAL"),
    level: row.level,
    departmentName: row.department?.name ?? null,
  };
}

function pollViewRow(row: NonNullable<PostRow["poll"]>, votes: Map<string, string>, now = new Date()) {
  const votedOptionId = votes.get(row.id) ?? null;
  const hasVoted = Boolean(votedOptionId);
  const resultsVisible = pollResultsVisible({ hasVoted, endsAt: row.endsAt, now });
  const counts = row.options.map((option) => option.voteCount);
  const percents = pollPercentages(counts);
  return {
    id: row.id,
    endsAt: row.endsAt.toISOString(),
    totalVotes: counts.reduce((sum, count) => sum + count, 0),
    options: row.options.map((option, index) => ({
      id: option.id,
      text: option.text,
      count: resultsVisible ? option.voteCount : 0,
      percent: resultsVisible ? (percents[index] ?? 0) : 0,
    })),
    hasVoted,
    votedOptionId,
    resultsVisible,
    isOpen: pollIsOpen(row.endsAt, now),
  };
}

function serializePost(
  row: PostRow,
  input: {
    viewerId: string;
    reacted: Set<string>;
    bookmarked: Set<string>;
    reposted: Set<string>;
    votes: Map<string, string>;
    labels: SocialViewer["labels"];
    lineage: SocialViewer["lineage"];
    level: number;
    viewerPath: SocialViewer["studentPath"];
    relationships: RelationshipSets;
    access: CommunityAccess | null;
    accessMap: Map<string, CommunityAccess>;
  },
): PostView {
  const isOwner = row.authorId === input.viewerId;
  const removed = row.status !== "ACTIVE";
  const repostOf = row.repostOf;
  // A quote inherits the original audience, but blocks, mutes and removals can
  // still make the embedded original unreadable. Never leak its body or author.
  const repostUnavailable = repostOf
    ? repostOf.status === "DELETED" ||
      !canSeePostInCommunity(
        input.viewerPath,
        repostOf,
        repostOf.communityId ? (input.accessMap.get(repostOf.communityId) ?? null) : null,
      ) ||
      isHiddenAuthor(input.relationships, repostOf.authorId, input.viewerId)
    : false;
  const hiddenRepostAuthor = {
    id: "",
    username: "",
    fullName: "Unavailable post",
    photoUrl: null,
    isOfficial: false,
    level: null,
    departmentName: null,
  };
  const community = row.community;
  const audience =
    row.audienceKind === "COMMUNITY"
      ? (community?.name ?? "Community")
      : row.audienceKind === "PUBLIC"
        ? "Public"
        : row.audienceKind === "LEVEL"
          ? `My level${input.lineage.department ? ` · ${input.lineage.department} ${input.level}L` : ""}`
          : row.audienceKind === "DEPARTMENT"
            ? `My ${input.labels.department}${input.lineage.department ? ` · ${input.lineage.department}` : ""}`
            : row.audienceKind === "FACULTY"
              ? `My ${input.labels.faculty}${input.lineage.faculty ? ` · ${input.lineage.faculty}` : ""}`
              : `My ${input.labels.college}${input.lineage.college ? ` · ${input.lineage.college}` : ""}`;
  const communityViewer = row.communityId
    ? postViewerCommunityState(input.access)
    : { canInteract: true, isMember: false, role: null, muted: false };

  return {
    id: row.id,
    type: row.type,
    body: removed ? "" : row.body,
    audienceKind: row.audienceKind,
    audienceLabel: audience,
    community: community
      ? {
          id: community.id,
          name: community.name,
          slug: community.slug,
          iconUrl: communityImageUrl(community.iconPublicId),
          isOfficial: community.isOfficial,
          privacy: community.privacy,
        }
      : null,
    pinned: Boolean(row.communityPin),
    status: row.status,
    createdAt: row.createdAt.toISOString(),
    editedAt: row.editedAt?.toISOString() ?? null,
    questionTitle: removed ? null : row.questionTitle,
    topicTag: removed ? null : row.topicTag,
    acceptedCommentId: removed ? null : row.acceptedCommentId,
    moderationReason: isOwner && removed ? row.moderationReason : removed ? "This post was removed by a moderator." : null,
    author: authorView(row.author),
    media: removed
      ? []
      : row.media.flatMap<PostMediaView>((media) => {
          const url = postMediaUrl(media.publicId, media.url);
          return url ? [{ id: media.id, url, width: media.width, height: media.height, alt: media.alt }] : [];
        }),
    poll: removed || !row.poll ? null : pollViewRow(row.poll, input.votes),
    repostOf: removed || !repostOf
      ? null
      : {
          id: repostOf.id,
          body: !repostUnavailable && repostOf.status === "ACTIVE" ? repostOf.body : "",
          status: repostUnavailable ? "REMOVED" : repostOf.status,
          unavailable: repostUnavailable,
          createdAt: repostOf.createdAt.toISOString(),
          author: repostUnavailable ? hiddenRepostAuthor : authorView(repostOf.author),
        },
    commentCount: row.commentCount,
    reactionCount: row.reactionCount,
    repostCount: row.repostCount,
    bookmarkCount: row.bookmarkCount,
    viewer: {
      reacted: input.reacted.has(row.id),
      bookmarked: input.bookmarked.has(row.id),
      reposted: input.reposted.has(row.id) || Boolean(row.repostOfId && input.reposted.has(row.repostOfId)),
      ...communityViewer,
    },
    isOwner,
  };
}

async function serializeRows(
  db: TenantClient,
  viewer: SocialViewer,
  rows: PostRow[],
  relationshipsInput?: RelationshipSets,
): Promise<PostView[]> {
  const communityIds = rows.flatMap((row) => [
    ...(row.communityId ? [row.communityId] : []),
    ...(row.repostOf?.communityId ? [row.repostOf.communityId] : []),
  ]);
  const [state, pollVotes, access, relationships] = await Promise.all([
    viewerPostState(
      db,
      viewer.userId,
      rows.map((row) => row.id),
    ),
    rows.some((row) => row.poll)
      ? db.pollVote.findMany({
          where: { userId: viewer.userId, pollId: { in: rows.flatMap((row) => (row.poll ? [row.poll.id] : [])) } },
          select: { pollId: true, optionId: true },
        })
      : Promise.resolve([]),
    loadCommunityAccessMap(db, viewer.userId, communityIds),
    relationshipsInput ? Promise.resolve(relationshipsInput) : loadRelationships(db, viewer.userId),
  ]);
  const votes = new Map(pollVotes.map((vote) => [vote.pollId, vote.optionId]));
  return rows.map((row) =>
    serializePost(row, {
      viewerId: viewer.userId,
      reacted: state.reacted,
      bookmarked: state.bookmarked,
      reposted: state.reposted,
      votes,
      labels: viewer.labels,
      lineage: viewer.lineage,
      level: viewer.level,
      viewerPath: viewer.studentPath,
      relationships,
      access: row.communityId ? (access.get(row.communityId) ?? null) : null,
      accessMap: access,
    }),
  );
}

export function canSeePostRow(
  viewerPath: SocialViewer["studentPath"],
  row: Pick<PostRow, "audiencePath" | "audienceKind" | "communityId">,
  access: CommunityAccess | null | undefined,
): boolean {
  return canSeePostInCommunity(viewerPath, row, access);
}

/**
 * Visibility prefilter for non-feed read paths. It includes readable PUBLIC
 * communities and joined communities; every returned row is still rechecked
 * with canSeePostInCommunity. Feed "All" deliberately uses a narrower set
 * (joined communities only).
 */
const notPlainRepost: Prisma.PostWhereInput = {
  OR: [{ repostKind: null }, { repostKind: { not: "PLAIN" } }],
};

function visiblePostsWhere(
  viewer: SocialViewer,
  readableIds: readonly string[],
): Prisma.PostWhereInput {
  const academic = { ...visibleAudienceFilter(viewer.studentPath) };
  if (readableIds.length === 0) return { AND: [academic, notPlainRepost] };
  return {
    AND: [
      notPlainRepost,
      {
        OR: [
          academic,
          { audienceKind: "COMMUNITY", communityId: { in: [...readableIds] } },
        ],
      },
    ],
  };
}

function feedWhere(
  viewer: SocialViewer,
  filter: FeedFilter,
  relationships: RelationshipSets,
  joinedCommunityIds: readonly string[],
  extra: Prisma.PostWhereInput = {},
  options: { includePlainReposts?: boolean } = {},
): Prisma.PostWhereInput {
  const kind = filterKindForLabel(filter);
  const hidden = hiddenAuthorIds(relationships);
  const communityBranch =
    joinedCommunityIds.length > 0
      ? { audienceKind: "COMMUNITY" as const, communityId: { in: [...joinedCommunityIds] } }
      : null;
  const academicBranch = {
    ...visibleAudienceFilter(viewer.studentPath),
    ...(kind === "ALL" ? {} : { audienceKind: kind }),
  };
  return {
    ...extra,
    status: "ACTIVE",
    ...(options.includePlainReposts ? {} : notPlainRepost),
    AND: [
      filter === "communities"
        ? (communityBranch ?? { audienceKind: "COMMUNITY" as const, communityId: { in: [] } })
        : filterIncludesCommunityPosts(filter)
          ? { OR: communityBranch ? [academicBranch, communityBranch] : [academicBranch] }
          : academicBranch,
      ...(extra.AND ? (Array.isArray(extra.AND) ? extra.AND : [extra.AND]) : []),
    ],
    ...(hidden.length > 0 ? { authorId: { notIn: hidden } } : {}),
  };
}

export interface CommunityFeedPage {
  posts: PostView[];
  pinned: PostView[];
  nextCursor: string | null;
  hasMore: boolean;
}

/** Posts inside one community. Community page only; access is rechecked here. */
export async function getCommunityFeed(
  viewer: SocialViewer,
  communityId: string,
  sort: "latest" | "top",
  cursor?: string | null,
): Promise<CommunityFeedPage | null> {
  const db = tenantDb(viewer.universityId);
  const access = (await loadCommunityAccessMap(db, viewer.userId, [communityId])).get(communityId);
  if (!access || !canAccessCommunityAction(access, "VIEW_CONTENT")) return null;
  const relationships = await loadRelationships(db, viewer.userId);
  const hidden = hiddenAuthorIds(relationships);
  const baseWhere: Prisma.PostWhereInput = {
    communityId,
    status: "ACTIVE",
    ...notPlainRepost,
    ...(hidden.length > 0 ? { authorId: { notIn: hidden } } : {}),
  };
  const pins = await db.communityPin.findMany({
    where: { communityId },
    orderBy: { position: "asc" },
    take: 3,
    select: { postId: true },
  });
  const pinIds = pins.map((pin) => pin.postId);
  const pinnedRows = pinIds.length
    ? await db.post.findMany({ where: { id: { in: pinIds }, status: "ACTIVE" }, select: postSelect })
    : [];
  const pinOrder = new Map(pinIds.map((id, index) => [id, index]));
  const pinned = (await serializeRows(db, viewer, pinnedRows)).sort(
    (a, b) => (pinOrder.get(a.id) ?? 0) - (pinOrder.get(b.id) ?? 0),
  );
  const exclude = pinIds.length > 0 ? { id: { notIn: pinIds } } : {};
  if (sort === "latest") {
    const decoded = decodeTimeCursor(cursor);
    const rows = await db.post.findMany({
      where: {
        ...baseWhere,
        ...exclude,
        ...(decoded
          ? {
              AND: [
                {
                  OR: [
                    { createdAt: { lt: new Date(decoded.createdAt) } },
                    { createdAt: new Date(decoded.createdAt), id: { lt: decoded.id } },
                  ],
                },
              ],
            }
          : {}),
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: 11,
      select: postSelect,
    });
    const page = rows.filter((row) => canSeePostInCommunity(viewer.studentPath, row, access)).slice(0, 10);
    const last = page[page.length - 1];
    return {
      posts: await serializeRows(db, viewer, page),
      pinned,
      nextCursor: rows.length > 10 && last ? encodeTimeCursor(last.createdAt, last.id) : null,
      hasMore: rows.length > 10,
    };
  }
  const decoded = decodeScoreCursor(cursor);
  const rows = await db.post.findMany({
    where: {
      ...baseWhere,
      ...exclude,
      ...(decoded
        ? {
            AND: [
              {
                OR: [
                  { reactionCount: { lt: decoded.score } },
                  { reactionCount: decoded.score, id: { lt: decoded.id } },
                ],
              },
            ],
          }
        : {}),
    },
    orderBy: [{ reactionCount: "desc" }, { createdAt: "desc" }, { id: "desc" }],
    take: 11,
    select: postSelect,
  });
  const page = rows.filter((row) => canSeePostInCommunity(viewer.studentPath, row, access)).slice(0, 10);
  const last = page[page.length - 1];
  return {
    posts: await serializeRows(db, viewer, page),
    pinned,
    nextCursor: rows.length > 10 && last ? encodeScoreCursor(last.reactionCount, last.id) : null,
    hasMore: rows.length > 10,
  };
}

export async function getFeed(
  viewer: SocialViewer,
  filter: FeedFilter,
  cursor?: string | null,
  limit = FEED_PAGE_SIZE,
): Promise<FeedPage> {
  const db = tenantDb(viewer.universityId);
  const [relationships, joinedCommunityIds] = await Promise.all([
    loadRelationships(db, viewer.userId),
    joinedActiveCommunityIds(db, viewer.userId),
  ]);
  const decoded = decodeTimeCursor(cursor);
  const pageSize = Math.min(Math.max(limit, 1), 20);

  const where = feedWhere(viewer, filter, relationships, joinedCommunityIds, {
    ...(decoded
      ? {
          AND: [
            {
              OR: [
                { createdAt: { lt: new Date(decoded.createdAt) } },
                { createdAt: new Date(decoded.createdAt), id: { lt: decoded.id } },
              ],
            },
          ],
        }
      : {}),
  });

  const rows = await db.post.findMany({
    where,
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: pageSize + 1,
    select: postSelect,
  });

  const access = await loadCommunityAccessMap(db, viewer.userId, rows.flatMap((row) => (row.communityId ? [row.communityId] : [])));
  const visibleRows = rows
    .filter((row) => canSeePostInCommunity(viewer.studentPath, row, row.communityId ? access.get(row.communityId) : null))
    .slice(0, pageSize);
  const hasMore = rows.length > pageSize;
  const last = visibleRows[visibleRows.length - 1];
  return {
    posts: await serializeRows(db, viewer, visibleRows),
    nextCursor: hasMore && last ? encodeTimeCursor(last.createdAt, last.id) : null,
    hasMore,
  };
}

export async function countNewPosts(
  viewer: SocialViewer,
  filter: FeedFilter,
  since: Date,
): Promise<number> {
  const db = tenantDb(viewer.universityId);
  const [relationships, joinedCommunityIds] = await Promise.all([
    loadRelationships(db, viewer.userId),
    joinedActiveCommunityIds(db, viewer.userId),
  ]);
  return db.post.count({
    where: feedWhere(viewer, filter, relationships, joinedCommunityIds, { createdAt: { gt: since } }),
  });
}

export async function getPostDetail(
  viewer: SocialViewer,
  postId: string,
  sort: "top" | "newest" = "top",
): Promise<PostDetailPayload | null> {
  const db = tenantDb(viewer.universityId);
  const relationships = await loadRelationships(db, viewer.userId);
  const row = await db.post.findFirst({ where: { id: postId }, select: postSelect });
  if (!row) return null;
  if (row.status === "DELETED") return null;
  const access = row.communityId
    ? (await loadCommunityAccessMap(db, viewer.userId, [row.communityId])).get(row.communityId) ?? null
    : null;
  if (!canSeePostInCommunity(viewer.studentPath, row, access)) return null;
  if (isHiddenAuthor(relationships, row.authorId, viewer.userId)) return null;

  const [post] = await serializeRows(db, viewer, [row]);
  if (!post) return null;
  return {
    post,
    comments: await getComments(db, viewer, row.id, relationships, sort),
    commentSort: sort,
  };
}

/* ------------------------------ comments ------------------------------ */

const commentSelect = {
  id: true,
  postId: true,
  parentId: true,
  depth: true,
  body: true,
  status: true,
  helpfulCount: true,
  createdAt: true,
  editedAt: true,
  moderationReason: true,
  authorId: true,
  author: {
    select: {
      id: true,
      username: true,
      fullName: true,
      photoUrl: true,
      roles: { select: { role: true } },
    },
  },
} satisfies Prisma.CommentSelect;

type CommentRow = Prisma.CommentGetPayload<{ select: typeof commentSelect }>;

async function serializeComments(
  db: TenantClient,
  viewer: SocialViewer,
  rows: CommentRow[],
): Promise<CommentView[]> {
  const ids = rows.map((row) => row.id);
  if (ids.length === 0) return [];
  const [reactions, helpful] = await Promise.all([
    db.reaction.findMany({
      where: { userId: viewer.userId, targetType: "COMMENT", targetId: { in: ids } },
      select: { targetId: true },
    }),
    db.helpfulMark.findMany({ where: { userId: viewer.userId, commentId: { in: ids } }, select: { commentId: true } }),
  ]);
  const reacted = new Set(reactions.map((row) => row.targetId));
  const marked = new Set(helpful.map((row) => row.commentId));
  return rows.map((row) => {
    const removed = row.status !== "ACTIVE";
    return {
      id: row.id,
      postId: row.postId,
      parentId: row.parentId,
      depth: row.depth,
      body: removed ? "" : row.body,
      status: removed ? ("REMOVED" as const) : ("ACTIVE" as const),
      helpfulCount: row.helpfulCount,
      createdAt: row.createdAt.toISOString(),
      editedAt: row.editedAt?.toISOString() ?? null,
      moderationReason: row.authorId === viewer.userId && removed ? row.moderationReason : null,
      author: removed
        ? null
        : {
            id: row.author.id,
            username: row.author.username,
            fullName: row.author.fullName,
            photoUrl: row.author.photoUrl,
            isOfficial: row.author.roles.some((role) => role.role === "OFFICIAL"),
          },
      viewer: { reacted: reacted.has(row.id), helpful: marked.has(row.id) },
      isOwner: row.authorId === viewer.userId,
    };
  });
}

async function getComments(
  db: TenantClient,
  viewer: SocialViewer,
  postId: string,
  relationships: RelationshipSets,
  sort: "top" | "newest",
): Promise<CommentView[]> {
  const statusFilter: CommentStatus[] = ["ACTIVE", "REMOVED"];
  // One query returns the whole thread (bounded) so arbitrary nesting does not
  // turn into a query per level. The client reveals deeper replies on demand.
  const rows = await db.comment.findMany({
    where: { postId, status: { in: statusFilter } },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    take: 1000,
    select: commentSelect,
  });
  const visible = rows.filter((row) => !isHiddenAuthor(relationships, row.authorId, viewer.userId));
  const all = await serializeComments(db, viewer, visible);
  const byId = new Map(all.map((comment) => [comment.id, comment]));
  for (const comment of all) {
    if (!comment.parentId) {
      comment.replyTo = null;
      continue;
    }
    const parent = byId.get(comment.parentId);
    comment.replyTo = parent?.author ? { id: parent.author.id, username: parent.author.username } : null;
    comment.depth = parent ? parent.depth + 1 : comment.depth;
  }

  const grouped = new Map<string, CommentView[]>();
  const tops: CommentView[] = [];
  for (const comment of all) {
    if (!comment.parentId || !byId.has(comment.parentId)) {
      tops.push(comment);
      continue;
    }
    const list = grouped.get(comment.parentId) ?? [];
    list.push(comment);
    grouped.set(comment.parentId, list);
  }
  const attach = (comment: CommentView): CommentView => {
    const children = (grouped.get(comment.id) ?? []).map(attach);
    return {
      ...comment,
      replies: children,
      replyCount: children.reduce((sum, child) => sum + 1 + (child.replyCount ?? 0), 0),
    };
  };
  const sortedTops = tops.sort((a, b) => {
    if (sort === "top" && b.helpfulCount !== a.helpfulCount) return b.helpfulCount - a.helpfulCount;
    return a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : b.id.localeCompare(a.id);
  });
  return sortedTops.slice(0, COMMENT_PAGE_SIZE).map(attach);
}

export async function createComment(input: {
  viewer: SocialViewer;
  postId: string;
  body: string;
  parentId?: string | null;
}): Promise<{ id: string; flagged: boolean }> {
  const viewer = input.viewer;
  const young = viewer.accountAgeHours < 24;
  const minute = await rateLimit(young ? "commentCreateYoung" : "commentCreate", viewer.userId);
  if (!minute.success) throw new SocialError("You're commenting quickly. Take a breath and try again in a minute.", 429);
  const hourly = await rateLimit(young ? "commentCreateHourlyYoung" : "commentCreateHourly", viewer.userId);
  if (!hourly.success) throw new SocialError("You've reached the comment limit for this hour. Try again later.", 429);

  const body = input.body.trim();
  if (!body) throw new SocialError("Write a comment first.");
  if (body.length > 1000) throw new SocialError("Comments can be up to 1,000 characters.");

  const db = tenantDb(viewer.universityId);
  const relationships = await loadRelationships(db, viewer.userId);
  const post = await db.post.findFirst({
    where: { id: input.postId },
    select: { id: true, status: true, audiencePath: true, audienceKind: true, authorId: true, communityId: true },
  });
  const access = post?.communityId
    ? (await loadCommunityAccessMap(db, viewer.userId, [post.communityId])).get(post.communityId) ?? null
    : null;
  if (
    !post ||
    post.status !== "ACTIVE" ||
    !canSeePostInCommunity(viewer.studentPath, post, access) ||
    (post.communityId && !assertCommunityAction(access, "COMMENT"))
  ) {
    throw new SocialError("This post isn't available.", 404);
  }
  if (isHiddenAuthor(relationships, post.authorId, viewer.userId)) throw new SocialError("This post isn't available.", 404);

  let parentId: string | null = null;
  let depth = 0;
  if (input.parentId) {
    const parent = await db.comment.findFirst({
      where: { id: input.parentId, postId: post.id },
      select: { id: true, parentId: true, depth: true, status: true, authorId: true },
    });
    if (!parent || parent.status !== "ACTIVE") {
      throw new SocialError("That comment is no longer available.", 404);
    }
    if (parent.depth >= MAX_COMMENT_DEPTH) {
      throw new SocialError("This thread has reached its reply limit.", 400);
    }
    if (isHiddenAuthor(relationships, parent.authorId, viewer.userId)) throw new SocialError("This post isn't available.", 404);
    parentId = parent.id;
    depth = parent.depth + 1;
  }

  const flag = shouldFlagForReview(body);
  const created = await db.comment.create({
    data: {
      universityId: viewer.universityId,
      postId: post.id,
      authorId: viewer.userId,
      parentId,
      depth,
      body,
      status: "ACTIVE",
    },
    select: { id: true },
  });
  await db.post.update({ where: { id: post.id }, data: { commentCount: { increment: 1 } } });
  await syncMentions(db, viewer.universityId, "COMMENT", created.id, parseMentions(body), post.communityId);
  if (flag.flagged) {
    await db.report
      .create({
        data: {
          universityId: viewer.universityId,
          reporterId: viewer.userId,
          targetType: "COMMENT",
          targetId: created.id,
          ...(post.communityId ? { communityId: post.communityId } : {}),
          reason: flag.reasons.some((reason) => reason.startsWith("keyword:")) ? "HARASSMENT" : "SPAM",
          details: `[automated] ${flag.reasons.join(", ")}`,
        },
      })
      .catch(() => undefined);
  }
  return { id: created.id, flagged: flag.flagged };
}

export async function updateComment(viewer: SocialViewer, commentId: string, bodyInput: string): Promise<void> {
  const body = bodyInput.trim();
  if (!body) throw new SocialError("Write a comment first.");
  if (body.length > 1000) throw new SocialError("Comments can be up to 1,000 characters.");
  const db = tenantDb(viewer.universityId);
  const comment = await db.comment.findFirst({
    where: { id: commentId },
    select: { id: true, authorId: true, status: true, postId: true, post: { select: { communityId: true } } },
  });
  if (!comment || comment.authorId !== viewer.userId || comment.status !== "ACTIVE") {
    throw new SocialError("You can only edit your own comment.");
  }
  await db.comment.update({ where: { id: comment.id }, data: { body, editedAt: new Date() } });
  await syncMentions(db, viewer.universityId, "COMMENT", comment.id, parseMentions(body), comment.post.communityId);
}

export async function deleteComment(viewer: SocialViewer, commentId: string): Promise<void> {
  const db = tenantDb(viewer.universityId);
  const comment = await db.comment.findFirst({
    where: { id: commentId },
    select: { id: true, authorId: true, status: true, postId: true, parentId: true },
  });
  if (!comment || comment.authorId !== viewer.userId || comment.status === "DELETED") {
    throw new SocialError("You can only delete your own comment.");
  }
  await db.$transaction(async (tx) => {
    await tx.comment.update({
      where: { id: comment.id },
      data: { status: "DELETED", body: "" },
    });
    if (!comment.parentId) {
      await tx.comment.updateMany({
        where: { parentId: comment.id, status: { not: "DELETED" } },
        data: { status: "DELETED", body: "" },
      });
    }
    await tx.post.updateMany({ where: { id: comment.postId }, data: { commentCount: { decrement: 1 } } });
    await tx.post.updateMany({
      where: { id: comment.postId, acceptedCommentId: comment.id },
      data: { acceptedCommentId: null },
    });
  });
}

export async function acceptAnswer(viewer: SocialViewer, postId: string, commentId: string): Promise<void> {
  const db = tenantDb(viewer.universityId);
  const post = await db.post.findFirst({
    where: { id: postId },
    select: { id: true, authorId: true, type: true, status: true, audiencePath: true, audienceKind: true },
  });
  if (!post || post.authorId !== viewer.userId || post.type !== "QUESTION" || post.status !== "ACTIVE") {
    throw new SocialError("Only the person who asked can accept an answer.");
  }
  const comment = await db.comment.findFirst({
    where: { id: commentId, postId },
    select: { id: true, status: true, parentId: true },
  });
  if (!comment || comment.status !== "ACTIVE" || comment.parentId) {
    throw new SocialError("That answer isn't available.");
  }
  await db.post.update({ where: { id: postId }, data: { acceptedCommentId: commentId } });
}

export async function toggleHelpful(viewer: SocialViewer, commentId: string): Promise<{ helpful: boolean; count: number }> {
  const db = tenantDb(viewer.universityId);
  const comment = await db.comment.findFirst({
    where: { id: commentId },
    select: {
      id: true,
      status: true,
      helpfulCount: true,
      post: { select: { id: true, status: true, audiencePath: true, audienceKind: true, authorId: true, communityId: true } },
    },
  });
  if (!comment || comment.status !== "ACTIVE" || comment.post.status !== "ACTIVE") {
    throw new SocialError("This answer isn't available.", 404);
  }
  const helpfulAccess = comment.post.communityId
    ? (await loadCommunityAccessMap(db, viewer.userId, [comment.post.communityId])).get(comment.post.communityId) ?? null
    : null;
  if (
    !canSeePostInCommunity(viewer.studentPath, comment.post, helpfulAccess) ||
    (comment.post.communityId && !assertCommunityAction(helpfulAccess, "REACT"))
  ) {
    throw new SocialError("This answer isn't available.", 404);
  }
  const existing = await db.helpfulMark.findFirst({ where: { commentId, userId: viewer.userId } });
  return db.$transaction(async (tx) => {
    if (existing) {
      await tx.helpfulMark.delete({ where: { id: existing.id } });
      const updated = await tx.comment.update({
        where: { id: commentId },
        data: { helpfulCount: { decrement: 1 } },
        select: { helpfulCount: true },
      });
      return { helpful: false, count: Math.max(0, updated.helpfulCount) };
    }
    await tx.helpfulMark.create({ data: { universityId: viewer.universityId, commentId, userId: viewer.userId } });
    const updated = await tx.comment.update({
      where: { id: commentId },
      data: { helpfulCount: { increment: 1 } },
      select: { helpfulCount: true },
    });
    return { helpful: true, count: updated.helpfulCount };
  });
}

/* ---------------------------- interactions ---------------------------- */

export async function toggleReaction(
  viewer: SocialViewer,
  targetType: "POST" | "COMMENT",
  targetId: string,
): Promise<{ reacted: boolean; count: number }> {
  const limit = await rateLimit(viewer.accountAgeHours < 24 ? "reactionYoung" : "reaction", viewer.userId);
  if (!limit.success) throw new SocialError("You're reacting very quickly. Try again in a moment.", 429);
  const db = tenantDb(viewer.universityId);

  if (targetType === "POST") {
    const post = await db.post.findFirst({
      where: { id: targetId },
      select: { id: true, status: true, audiencePath: true, audienceKind: true, authorId: true, reactionCount: true, communityId: true },
    });
    const access = post?.communityId
      ? (await loadCommunityAccessMap(db, viewer.userId, [post.communityId])).get(post.communityId) ?? null
      : null;
    if (
      !post ||
      post.status !== "ACTIVE" ||
      !canSeePostInCommunity(viewer.studentPath, post, access) ||
      (post.communityId && !assertCommunityAction(access, "REACT"))
    ) {
      throw new SocialError("This post isn't available.", 404);
    }
    const relationships = await loadRelationships(db, viewer.userId);
    if (isHiddenAuthor(relationships, post.authorId, viewer.userId)) throw new SocialError("This post isn't available.", 404);
    const existing = await db.reaction.findFirst({ where: { userId: viewer.userId, targetType, targetId } });
    return db.$transaction(async (tx) => {
      if (existing) {
        await tx.reaction.delete({ where: { id: existing.id } });
        const updated = await tx.post.update({
          where: { id: post.id },
          data: { reactionCount: { decrement: 1 } },
          select: { reactionCount: true },
        });
        return { reacted: false, count: Math.max(0, updated.reactionCount) };
      }
      await tx.reaction.create({ data: { universityId: viewer.universityId, userId: viewer.userId, targetType, targetId } });
      const updated = await tx.post.update({
        where: { id: post.id },
        data: { reactionCount: { increment: 1 } },
        select: { reactionCount: true },
      });
      return { reacted: true, count: updated.reactionCount };
    });
  }

  const comment = await db.comment.findFirst({
    where: { id: targetId },
    select: {
      id: true,
      status: true,
      post: { select: { id: true, status: true, audiencePath: true, audienceKind: true, communityId: true } },
    },
  });
  const commentAccess = comment?.post.communityId
    ? (await loadCommunityAccessMap(db, viewer.userId, [comment.post.communityId])).get(comment.post.communityId) ?? null
    : null;
  if (
    !comment ||
    comment.status !== "ACTIVE" ||
    comment.post.status !== "ACTIVE" ||
    !canSeePostInCommunity(viewer.studentPath, comment.post, commentAccess) ||
    (comment.post.communityId && !assertCommunityAction(commentAccess, "REACT"))
  ) {
    throw new SocialError("This comment isn't available.", 404);
  }
  const existing = await db.reaction.findFirst({ where: { userId: viewer.userId, targetType, targetId } });
  await (existing
    ? db.reaction.delete({ where: { id: existing.id } })
    : db.reaction.create({ data: { universityId: viewer.universityId, userId: viewer.userId, targetType, targetId } }));
  const count = await db.reaction.count({ where: { targetType, targetId } });
  return { reacted: !existing, count };
}

export async function toggleBookmark(viewer: SocialViewer, postId: string): Promise<{ bookmarked: boolean; count: number }> {
  const db = tenantDb(viewer.universityId);
  const post = await db.post.findFirst({
    where: { id: postId },
    select: { id: true, status: true, audiencePath: true, audienceKind: true, authorId: true, communityId: true },
  });
  const access = post?.communityId
    ? (await loadCommunityAccessMap(db, viewer.userId, [post.communityId])).get(post.communityId) ?? null
    : null;
  if (!post || post.status !== "ACTIVE" || !canSeePostInCommunity(viewer.studentPath, post, access)) {
    throw new SocialError("This post isn't available.", 404);
  }
  const relationships = await loadRelationships(db, viewer.userId);
  if (isHiddenAuthor(relationships, post.authorId, viewer.userId)) throw new SocialError("This post isn't available.", 404);
  const existing = await db.bookmark.findFirst({ where: { userId: viewer.userId, postId } });
  return db.$transaction(async (tx) => {
    if (existing) {
      await tx.bookmark.delete({ where: { id: existing.id } });
      const updated = await tx.post.update({
        where: { id: postId },
        data: { bookmarkCount: { decrement: 1 } },
        select: { bookmarkCount: true },
      });
      return { bookmarked: false, count: Math.max(0, updated.bookmarkCount) };
    }
    await tx.bookmark.create({ data: { universityId: viewer.universityId, userId: viewer.userId, postId } });
    const updated = await tx.post.update({
      where: { id: postId },
      data: { bookmarkCount: { increment: 1 } },
      select: { bookmarkCount: true },
    });
    return { bookmarked: true, count: updated.bookmarkCount };
  });
}

export async function votePoll(viewer: SocialViewer, pollId: string, optionId: string): Promise<void> {
  const limit = await rateLimit(viewer.accountAgeHours < 24 ? "pollVoteYoung" : "pollVote", viewer.userId);
  if (!limit.success) throw new SocialError("You've voted a lot in the last hour. Try again later.", 429);
  const db = tenantDb(viewer.universityId);
  const poll = await db.poll.findFirst({
    where: { id: pollId },
    select: {
      id: true,
      endsAt: true,
      options: { select: { id: true } },
      post: { select: { id: true, status: true, audiencePath: true, audienceKind: true, authorId: true, communityId: true } },
    },
  });
  const pollAccess = poll?.post.communityId
    ? (await loadCommunityAccessMap(db, viewer.userId, [poll.post.communityId])).get(poll.post.communityId) ?? null
    : null;
  if (
    !poll ||
    poll.post.status !== "ACTIVE" ||
    !canSeePostInCommunity(viewer.studentPath, poll.post, pollAccess) ||
    (poll.post.communityId && !assertCommunityAction(pollAccess, "REACT"))
  ) {
    throw new SocialError("This poll isn't available.", 404);
  }
  if (!pollIsOpen(poll.endsAt)) throw new SocialError("This poll has ended.");
  if (!poll.options.some((option) => option.id === optionId)) throw new SocialError("Pick one of the poll options.");
  const existing = await db.pollVote.findFirst({ where: { pollId, userId: viewer.userId }, select: { id: true } });
  if (existing) throw new SocialError("You've already voted in this poll.");
  try {
    await db.$transaction(async (tx) => {
      await tx.pollVote.create({ data: { universityId: viewer.universityId, pollId, optionId, userId: viewer.userId } });
      await tx.pollOption.update({ where: { id: optionId }, data: { voteCount: { increment: 1 } } });
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      throw new SocialError("You've already voted in this poll.");
    }
    throw error;
  }
}

/* ------------------------------- create ------------------------------- */

export interface CreatePostInput {
  viewer: SocialViewer;
  type: "POST" | "QUESTION" | "POLL" | "REPOST";
  body: string;
  audienceId: string;
  questionTitle?: string;
  topicTag?: string;
  pollOptions?: string[];
  pollDurationDays?: number;
  repostOfId?: string;
  communityId?: string;
  media?: Array<{ publicId: string; url?: string; width: number; height: number; alt?: string }>;
  idempotencyKey?: string;
  /** Deleted with the post so a successful publish cleans up its draft once. */
  draftClientDraftId?: string;
}

async function resolveCommunityPost(
  viewer: SocialViewer,
  communityId: string,
  action: "CREATE_POST" | "REPOST",
): Promise<CommunityAccess> {
  const db = tenantDb(viewer.universityId);
  const access = (await loadCommunityAccessMap(db, viewer.userId, [communityId])).get(communityId);
  if (!access || !canAccessCommunityAction(access, action)) {
    throw new SocialError("This community isn't available to post in.", 404);
  }
  return access;
}

function audienceChoices(viewer: SocialViewer): Audience[] {
  // Path layout: [university, ...ancestors, department, level]. Ancestor ids are
  // read from the same canonical path used for visibility, never reconstructed
  // from a client-supplied label.
  const ancestors = viewer.studentPath.slice(1, -2).map(String);
  const collegeId = viewer.lineage.college ? ancestors[0] ?? null : null;
  const facultyId = viewer.lineage.faculty ? ancestors[viewer.lineage.college ? 1 : 0] ?? null : null;
  return audienceOptionsFor(
    {
      universityId: viewer.universityId,
      college: collegeId ? { id: collegeId, name: viewer.lineage.college! } : null,
      faculty: facultyId ? { id: facultyId, name: viewer.lineage.faculty! } : null,
      department: { id: viewer.departmentId, name: viewer.lineage.department ?? "Department" },
      level: viewer.level,
    },
    viewer.labels,
  );
}

export interface ComposerAudience {
  id: string;
  label: string;
  description: string;
  scope: Audience["scope"] | "community";
  communityId?: string;
  iconUrl?: string | null;
  rules?: Array<{ title: string; body: string }>;
}

export function composerAudiences(
  viewer: SocialViewer,
  communities: Array<{
    id: string;
    name: string;
    iconUrl: string | null;
    rules: Array<{ title: string; body: string }>;
  }> = [],
): ComposerAudience[] {
  const academic: ComposerAudience[] = audienceChoices(viewer).map((option) => ({
    id: option.id,
    label: option.label,
    scope: option.scope,
    description:
      option.scope === "university"
        ? "Whole university"
        : option.scope === "level"
          ? `${viewer.level} level · ${viewer.lineage.department ?? viewer.labels.department}`
          : option.scope === "department"
            ? (viewer.lineage.department ?? viewer.labels.department)
            : option.scope === "faculty"
              ? (viewer.lineage.faculty ?? viewer.labels.faculty)
              : (viewer.lineage.college ?? viewer.labels.college),
  }));
  return [
    ...academic,
    ...communities.map((community) => ({
      id: `community:${community.id}`,
      label: community.name,
      description: "Community",
      scope: "community" as const,
      communityId: community.id,
      iconUrl: community.iconUrl,
      rules: community.rules,
    })),
  ];
}

function resolveAudience(viewer: SocialViewer, audienceId: string): {
  audiencePath: string[];
  audienceKind: PostAudienceKind;
} {
  const option = audienceChoices(viewer).find((candidate) => candidate.id === audienceId);
  if (!option) throw new SocialError("Pick an audience you belong to.");
  if (option.scope === "university") return { audiencePath: ["PUBLIC"], audienceKind: "PUBLIC" };
  return {
    audiencePath: option.path.map(String),
    audienceKind: kindForScope(option.scope),
  };
}

function normalizeMedia(input: CreatePostInput["media"]): Array<{
  publicId: string;
  url: string | null;
  width: number;
  height: number;
  alt: string | null;
  order: number;
}> {
  if (!input?.length) return [];
  if (input.length > 4) throw new SocialError("You can attach up to four images.");
  return input.map((media, index) => {
    if (!isAllowedPostPublicId(media.publicId)) throw new SocialError("That image upload isn't valid.");
    if (!Number.isInteger(media.width) || !Number.isInteger(media.height) || media.width < 1 || media.height < 1) {
      throw new SocialError("That image is missing its dimensions.");
    }
    const local = media.publicId.startsWith("local:posts/") && media.url?.startsWith("/uploads/posts/");
    return {
      publicId: media.publicId,
      url: local ? media.url! : null,
      width: Math.min(media.width, 10_000),
      height: Math.min(media.height, 10_000),
      alt: typeof media.alt === "string" ? media.alt.trim().slice(0, 240) || null : null,
      order: index,
    };
  });
}

async function syncHashtags(
  db: TenantClient,
  universityId: string,
  postId: string,
  tags: string[],
): Promise<void> {
  await db.postHashtag.deleteMany({ where: { postId } });
  if (tags.length === 0) return;
  const hashtagIds: string[] = [];
  for (const tag of tags) {
    const hashtag = await db.hashtag.upsert({
      where: { universityId_tag: { universityId, tag } },
      create: { universityId, tag },
      update: {},
      select: { id: true },
    });
    hashtagIds.push(hashtag.id);
  }
  await db.postHashtag.createMany({
    data: hashtagIds.map((hashtagId) => ({ universityId, postId, hashtagId })),
    skipDuplicates: true,
  });
}

async function syncMentions(
  db: TenantClient,
  universityId: string,
  sourceType: "POST" | "COMMENT",
  sourceId: string,
  handles: string[],
  communityId?: string | null,
): Promise<void> {
  await db.mention.deleteMany({ where: { sourceType, sourceId } });
  if (handles.length === 0) return;
  let eligibleIds: string[] | null = null;
  if (communityId) {
    const community = await db.community.findFirst({
      where: { id: communityId },
      select: { privacy: true, status: true },
    });
    if (!community || community.status !== "ACTIVE") return;
    if (community.privacy !== "PUBLIC") {
      const members = await db.communityMember.findMany({
        where: { communityId, status: "ACTIVE" },
        select: { userId: true },
      });
      eligibleIds = members.map((member) => member.userId);
    }
  }
  const users = await db.user.findMany({
    where: {
      username: { in: handles },
      status: { in: ["VERIFIED", "ALUMNI"] },
      ...(eligibleIds ? { id: { in: eligibleIds } } : {}),
    },
    select: { id: true },
    take: 20,
  });
  if (users.length === 0) return;
  await db.mention.createMany({
    data: users.map((user) => ({ universityId, sourceType, sourceId, mentionedUserId: user.id })),
    skipDuplicates: true,
  });
}

export async function createPost(input: CreatePostInput): Promise<{ id: string; flagged: boolean }> {
  const viewer = input.viewer;
  if (input.type === "REPOST") {
    return repostPost(viewer, input.repostOfId ?? "", input.body, input.idempotencyKey);
  }
  const limit = await rateLimit(viewer.accountAgeHours < 24 ? "postCreateYoung" : "postCreate", viewer.userId);
  if (!limit.success) {
    throw new SocialError("You've reached the posting limit for now. Your next post can go out soon.", 429);
  }
  if (input.idempotencyKey) {
    const existing = await tenantDb(viewer.universityId).post.findFirst({
      where: { idempotencyKey: input.idempotencyKey, authorId: viewer.userId },
      select: { id: true },
    });
    if (existing) return { id: existing.id, flagged: false };
  }

  const db = tenantDb(viewer.universityId);
  const body = input.body.replace(/\r\n/g, "\n").trim();
  if (body.length > MAX_POST_LENGTH) throw new SocialError("Posts can be up to 2,000 characters.");

  let audience: { audiencePath: string[]; audienceKind: PostAudienceKind };
  let communityId: string | null = null;
  let questionTitle: string | null = null;
  let topicTag: string | null = null;
  let poll:
    | { endsAt: Date; options: string[] }
    | null = null;
  let media = normalizeMedia(input.media);

  if (input.communityId) {
    await resolveCommunityPost(viewer, input.communityId, "CREATE_POST");
    audience = { audiencePath: [], audienceKind: "COMMUNITY" };
    communityId = input.communityId;
  } else {
    audience = resolveAudience(viewer, input.audienceId);
  }
  if (input.type === "QUESTION") {
    questionTitle = (input.questionTitle ?? "").trim();
    if (questionTitle.length < 8) throw new SocialError("Give your question a clear title (at least 8 characters).");
    if (questionTitle.length > 140) throw new SocialError("Question titles can be up to 140 characters.");
    topicTag = input.topicTag ? normalizeTag(input.topicTag) : null;
    if (input.topicTag && !topicTag) throw new SocialError("That topic tag isn't valid.");
  }
  if (input.type === "POLL") {
    if (!body) throw new SocialError("Ask a poll question first.");
    const optionError = validatePollOptions(input.pollOptions ?? []);
    if (optionError) throw new SocialError(optionError);
    const options = (input.pollOptions ?? []).map((option) => option.trim()).filter(Boolean);
    poll = { endsAt: pollEndsAt(input.pollDurationDays ?? 1), options };
    media = [];
  }
  if (input.type === "POST" && !body && media.length === 0) {
    throw new SocialError("Write something or attach an image.");
  }
  if (input.type === "QUESTION" && !body) {
    throw new SocialError("Add a little detail so people can help.");
  }

  if (!poll && body.length === 0 && media.length === 0) {
    throw new SocialError("Write something first.");
  }

  const now = new Date();
  const recent = await db.post.findMany({
    where: { authorId: viewer.userId, createdAt: { gte: new Date(now.getTime() - 10 * 60_000) }, status: "ACTIVE" },
    orderBy: { createdAt: "desc" },
    take: 5,
    select: { body: true, type: true },
  });
  if (body && recent.some((row) => row.type === input.type && isDuplicateBody(row.body, body))) {
    throw new SocialError("You just posted that. Give it a few minutes before repeating it.");
  }

  const flag = shouldFlagForReview(`${questionTitle ?? ""}\n${body}`);

  try {
    const created = await db.post.create({
      data: {
        universityId: viewer.universityId,
        authorId: viewer.userId,
        type: input.type,
        body,
        audiencePath: audience.audiencePath,
        audienceKind: audience.audienceKind,
        ...(communityId ? { communityId } : {}),
        rankAt: now,
        ...(input.idempotencyKey ? { idempotencyKey: input.idempotencyKey } : {}),
        ...(questionTitle ? { questionTitle } : {}),
        ...(topicTag ? { topicTag } : {}),
        ...(media.length > 0
          ? {
              media: {
                create: media.map((item) => ({
                  universityId: viewer.universityId,
                  publicId: item.publicId,
                  url: item.url,
                  width: item.width,
                  height: item.height,
                  alt: item.alt,
                  order: item.order,
                })),
              },
            }
          : {}),
        ...(poll
          ? {
              poll: {
                create: {
                  universityId: viewer.universityId,
                  endsAt: poll.endsAt,
                  options: {
                    create: poll.options.map((text, order) => ({
                      universityId: viewer.universityId,
                      text,
                      order,
                    })),
                  },
                },
              },
            }
          : {}),
      },
      select: { id: true },
    });

    await syncHashtags(db, viewer.universityId, created.id, parseHashtags(body));
    await syncMentions(db, viewer.universityId, "POST", created.id, parseMentions(body), communityId);
    if (input.draftClientDraftId) {
      await db.draft
        .deleteMany({ where: { userId: viewer.userId, clientDraftId: input.draftClientDraftId } })
        .catch(() => undefined);
    }

    if (communityId) {
      await db.community.update({
        where: { id: communityId },
        data: { postCount: { increment: 1 }, lastActivityAt: now },
      });
    }
    if (flag.flagged) {
      await db.report
        .create({
          data: {
            universityId: viewer.universityId,
            reporterId: viewer.userId,
            targetType: "POST",
            targetId: created.id,
            ...(communityId ? { communityId } : {}),
            reason: flag.reasons.some((reason) => reason.startsWith("keyword:")) ? "HARASSMENT" : "SPAM",
            details: `[automated] ${flag.reasons.join(", ")}`,
          },
        })
        .catch(() => undefined);
    }
    return { id: created.id, flagged: flag.flagged };
  } catch (error) {
    if (input.idempotencyKey && error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      const existing = await db.post.findFirst({
        where: { idempotencyKey: input.idempotencyKey, authorId: viewer.userId },
        select: { id: true },
      });
      if (existing) return { id: existing.id, flagged: false };
    }
    throw error;
  }
}

/* ------------------------------- reposts ------------------------------- */

interface RepostTarget {
  id: string;
  type: "POST" | "QUESTION" | "POLL" | "REPOST";
  repostOfId: string | null;
  status: "ACTIVE" | "REMOVED" | "DELETED";
  audiencePath: string[];
  audienceKind: PostAudienceKind;
  authorId: string;
  communityId: string | null;
}

/**
 * Resolve the real original. Reposting a repost always targets the original,
 * and every read/visibility check runs against that row, never the wrapper.
 */
async function resolveRepostTarget(
  db: TenantClient,
  viewer: SocialViewer,
  targetId: string,
): Promise<{ original: RepostTarget; access: CommunityAccess | null }> {
  const select = {
    id: true,
    type: true,
    repostOfId: true,
    status: true,
    audiencePath: true,
    audienceKind: true,
    authorId: true,
    communityId: true,
  } as const;
  let original = await db.post.findFirst({ where: { id: targetId }, select });
  if (!original) throw new SocialError("This post isn't available.", 404);
  if (original.type === "REPOST" && original.repostOfId) {
    original = await db.post.findFirst({ where: { id: original.repostOfId }, select });
    if (!original) throw new SocialError("This post isn't available.", 404);
  }
  const access = original.communityId
    ? (await loadCommunityAccessMap(db, viewer.userId, [original.communityId])).get(original.communityId) ?? null
    : null;
  if (original.status !== "ACTIVE" || !canSeePostInCommunity(viewer.studentPath, original, access)) {
    throw new SocialError("This post isn't available.", 404);
  }
  const relationships = await loadRelationships(db, viewer.userId);
  if (isHiddenAuthor(relationships, original.authorId, viewer.userId)) {
    throw new SocialError("This post isn't available.", 404);
  }
  return { original, access };
}

/**
 * One plain repost per user/original, one quote per user/original. A plain
 * repost is profile-only; a quote is a feed post that embeds the original.
 */
export async function repostPost(
  viewer: SocialViewer,
  targetId: string,
  bodyInput = "",
  idempotencyKey?: string,
): Promise<{ id: string; flagged: boolean }> {
  const limit = await rateLimit("repost", viewer.userId);
  if (!limit.success) {
    throw new SocialError("You've reached the repost limit for this hour. Try again later.", 429);
  }
  const db = tenantDb(viewer.universityId);
  if (idempotencyKey) {
    const existing = await db.post.findFirst({
      where: { idempotencyKey, authorId: viewer.userId },
      select: { id: true },
    });
    if (existing) return { id: existing.id, flagged: false };
  }

  const { original, access } = await resolveRepostTarget(db, viewer, targetId);
  if (original.authorId === viewer.userId) {
    throw new SocialError("You can't repost your own post.");
  }
  const body = bodyInput.replace(/\r\n/g, "\n").trim();
  if (body.length > MAX_POST_LENGTH) throw new SocialError("Posts can be up to 2,000 characters.");
  const audience = inheritedRepostAudience(original);
  const now = new Date();
  const plain = body.length === 0;

  if (!plain && original.communityId) {
    if (!assertCommunityAction(access, "CREATE_POST")) {
      throw new SocialError("You can't quote in this community right now.");
    }
  }

  if (plain) {
    const existing = await db.post.findFirst({
      where: {
        authorId: viewer.userId,
        repostOfId: original.id,
        type: "REPOST",
        repostKind: "PLAIN",
        status: "ACTIVE",
      },
      select: { id: true },
    });
    if (existing) return { id: existing.id, flagged: false };
  } else {
    const existing = await db.post.findFirst({
      where: {
        authorId: viewer.userId,
        repostOfId: original.id,
        type: "REPOST",
        repostKind: "QUOTE",
        status: { not: "DELETED" },
      },
      select: { id: true },
    });
    if (existing) throw new SocialError("You've already quoted this post.", 409);
  }

  try {
    const created = await db.$transaction(async (tx) => {
      const post = await tx.post.create({
        data: {
          universityId: viewer.universityId,
          authorId: viewer.userId,
          type: "REPOST",
          repostKind: plain ? "PLAIN" : "QUOTE",
          repostOfId: original.id,
          body,
          audiencePath: audience.audiencePath,
          audienceKind: audience.audienceKind,
          ...(original.communityId ? { communityId: original.communityId } : {}),
          rankAt: now,
          ...(idempotencyKey ? { idempotencyKey } : {}),
        },
        select: { id: true },
      });
      if (plain) {
        await tx.post.update({ where: { id: original.id }, data: { repostCount: { increment: 1 } } });
      } else if (original.communityId) {
        await tx.community.update({
          where: { id: original.communityId },
          data: { postCount: { increment: 1 }, lastActivityAt: now },
        });
      }
      return post;
    });

    if (!plain) {
      await syncHashtags(db, viewer.universityId, created.id, parseHashtags(body));
      await syncMentions(db, viewer.universityId, "POST", created.id, parseMentions(body), original.communityId);
    }
    return { id: created.id, flagged: false };
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      if (idempotencyKey) {
        const existing = await db.post.findFirst({
          where: { idempotencyKey, authorId: viewer.userId },
          select: { id: true },
        });
        if (existing) return { id: existing.id, flagged: false };
      }
      if (plain) {
        const existing = await db.post.findFirst({
          where: {
            authorId: viewer.userId,
            repostOfId: original.id,
            type: "REPOST",
            repostKind: "PLAIN",
            status: "ACTIVE",
          },
          select: { id: true },
        });
        if (existing) return { id: existing.id, flagged: false };
      }
      throw new SocialError("You've already quoted this post.", 409);
    }
    throw error;
  }
}

/**
 * Undo is idempotent and does not need the original to still be visible: a
 * student can always remove their own repost, even after the original was
 * removed or deleted.
 */
export async function undoRepost(viewer: SocialViewer, targetId: string): Promise<{ undone: boolean }> {
  const db = tenantDb(viewer.universityId);
  const target = await db.post.findFirst({
    where: { id: targetId },
    select: { id: true, type: true, repostOfId: true },
  });
  if (!target) return { undone: false };
  const originalId = target.type === "REPOST" && target.repostOfId ? target.repostOfId : target.id;
  const repost = await db.post.findFirst({
    where: {
      authorId: viewer.userId,
      repostOfId: originalId,
      type: "REPOST",
      repostKind: "PLAIN",
      status: "ACTIVE",
    },
    select: { id: true },
  });
  if (!repost) return { undone: false };
  await db.$transaction(async (tx) => {
    await tx.post.update({ where: { id: repost.id }, data: { status: "DELETED", body: "" } });
    await tx.post.updateMany({
      where: { id: originalId, repostCount: { gt: 0 } },
      data: { repostCount: { decrement: 1 } },
    });
  });
  return { undone: true };
}

export async function updatePost(viewer: SocialViewer, postId: string, bodyInput: string): Promise<void> {
  const body = bodyInput.replace(/\r\n/g, "\n").trim();
  if (!body) throw new SocialError("Posts can't be empty.");
  if (body.length > MAX_POST_LENGTH) throw new SocialError("Posts can be up to 2,000 characters.");
  const db = tenantDb(viewer.universityId);
  const post = await db.post.findFirst({
    where: { id: postId },
    select: { id: true, authorId: true, status: true, type: true, body: true, communityId: true },
  });
  if (!post || post.authorId !== viewer.userId || post.status !== "ACTIVE") {
    throw new SocialError("You can only edit your own active post.");
  }
  await db.$transaction(async (tx) => {
    await tx.postRevision.create({
      data: { universityId: viewer.universityId, postId: post.id, editorId: viewer.userId, body: post.body },
    });
    await tx.post.update({ where: { id: post.id }, data: { body, editedAt: new Date() } });
  });
  await syncHashtags(db, viewer.universityId, post.id, parseHashtags(body));
  await syncMentions(db, viewer.universityId, "POST", post.id, parseMentions(body), post.communityId);
}

export async function deletePost(viewer: SocialViewer, postId: string): Promise<void> {
  const db = tenantDb(viewer.universityId);
  const post = await db.post.findFirst({
    where: { id: postId },
    select: { id: true, authorId: true, status: true, repostOfId: true, repostKind: true, communityId: true },
  });
  if (!post || post.authorId !== viewer.userId || post.status === "DELETED") {
    throw new SocialError("You can only delete your own post.");
  }
  await db.$transaction(async (tx) => {
    await tx.post.update({ where: { id: post.id }, data: { status: "DELETED", body: "" } });
    if (post.repostOfId && post.repostKind === "PLAIN") {
      await tx.post.updateMany({
        where: { id: post.repostOfId, repostCount: { gt: 0 } },
        data: { repostCount: { decrement: 1 } },
      });
    }
    if (post.communityId) {
      await tx.community.update({
        where: { id: post.communityId },
        data: { postCount: { decrement: 1 } },
      });
    }
  });
}

/* ----------------------------- hashtags ------------------------------- */

const trendingCache = new Map<string, { expires: number; value: TrendingTag[] }>();

export async function getTrendingTags(viewer: SocialViewer, filter: FeedFilter): Promise<TrendingTag[]> {
  const db = tenantDb(viewer.universityId);
  const [relationships, readableIds, joinedIds] = await Promise.all([
    loadRelationships(db, viewer.userId),
    readableCommunityIds(db, viewer.userId),
    joinedActiveCommunityIds(db, viewer.userId),
  ]);
  const hidden = hiddenAuthorIds(relationships).sort();
  const communityKey = [...readableIds].sort().join(",");
  const key = `${viewer.studentPath.join("/")}|${filter}|${communityKey}|${hidden.join(",")}`;
  const cached = trendingCache.get(key);
  if (cached && cached.expires > Date.now()) return cached.value;

  const since = new Date(Date.now() - 48 * 60 * 60 * 1000);
  const filterKind = filterKindForLabel(filter);
  const scopeWhere: Prisma.PostWhereInput =
    filter === "all"
      ? visiblePostsWhere(viewer, readableIds)
      : filter === "communities"
        ? {
            audienceKind: "COMMUNITY",
            ...(joinedIds.length > 0 ? { communityId: { in: joinedIds } } : { communityId: { in: [] } }),
          }
        : {
            ...visibleAudienceFilter(viewer.studentPath),
            ...(filterKind === "ALL" ? {} : { audienceKind: filterKind }),
          };
  const grouped = await db.postHashtag.groupBy({
    by: ["hashtagId"],
    where: {
      post: {
        status: "ACTIVE",
        createdAt: { gte: since },
        ...scopeWhere,
        ...(hidden.length > 0 ? { authorId: { notIn: hidden } } : {}),
      },
    },
    _count: { postId: true },
    orderBy: { _count: { postId: "desc" } },
    take: 8,
  });
  const hashtags = grouped.length
    ? await db.hashtag.findMany({
        where: { id: { in: grouped.map((row) => row.hashtagId) } },
        select: { id: true, tag: true },
      })
    : [];
  const byId = new Map(hashtags.map((tag) => [tag.id, tag.tag]));
  const value = grouped
    .flatMap((row) => {
      const tag = byId.get(row.hashtagId);
      return tag ? [{ tag, postCount: row._count.postId }] : [];
    })
    .slice(0, 6);
  trendingCache.set(key, { expires: Date.now() + 60_000, value });
  return value;
}

export async function getHashtagPage(
  viewer: SocialViewer,
  rawTag: string,
  sort: "top" | "latest",
  cursor?: string | null,
): Promise<HashtagPage | null> {
  const tag = normalizeTag(rawTag);
  if (!tag) return null;
  const db = tenantDb(viewer.universityId);
  const [relationships, readableIds] = await Promise.all([
    loadRelationships(db, viewer.userId),
    readableCommunityIds(db, viewer.userId),
  ]);
  const hashtag = await db.hashtag.findFirst({ where: { tag }, select: { id: true, tag: true } });
  if (!hashtag) return null;
  const hidden = hiddenAuthorIds(relationships);
  const access = await loadCommunityAccessMap(db, viewer.userId, readableIds);
  const baseWhere: Prisma.PostWhereInput = {
    status: "ACTIVE",
    hashtags: { some: { hashtagId: hashtag.id } },
    ...visiblePostsWhere(viewer, readableIds),
    ...(hidden.length > 0 ? { authorId: { notIn: hidden } } : {}),
  };

  if (sort === "latest") {
    const decoded = decodeTimeCursor(cursor);
    const rows = await db.post.findMany({
      where: {
        ...baseWhere,
        ...(decoded
          ? {
              AND: [
                {
                  OR: [
                    { createdAt: { lt: new Date(decoded.createdAt) } },
                    { createdAt: new Date(decoded.createdAt), id: { lt: decoded.id } },
                  ],
                },
              ],
            }
          : {}),
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: 11,
      select: postSelect,
    });
    const page = rows
      .filter((row) => canSeePostInCommunity(viewer.studentPath, row, row.communityId ? access.get(row.communityId) : null))
      .slice(0, 10);
    const last = page[page.length - 1];
    return {
      tag: hashtag.tag,
      postCount: await db.post.count({ where: baseWhere }),
      posts: await serializeRows(db, viewer, page),
      nextCursor: rows.length > 10 && last ? encodeTimeCursor(last.createdAt, last.id) : null,
      hasMore: rows.length > 10,
      sort,
    };
  }

  const decoded = decodeScoreCursor(cursor);
  const rows = await db.post.findMany({
    where: {
      ...baseWhere,
      ...(decoded
        ? {
            AND: [
              {
                OR: [
                  { reactionCount: { lt: decoded.score } },
                  { reactionCount: decoded.score, id: { lt: decoded.id } },
                ],
              },
            ],
          }
        : {}),
    },
    orderBy: [{ reactionCount: "desc" }, { createdAt: "desc" }, { id: "desc" }],
    take: 11,
    select: postSelect,
  });
  const page = rows
    .filter((row) => canSeePostInCommunity(viewer.studentPath, row, row.communityId ? access.get(row.communityId) : null))
    .slice(0, 10);
  const last = page[page.length - 1];
  return {
    tag: hashtag.tag,
    postCount: await db.post.count({ where: baseWhere }),
    posts: await serializeRows(db, viewer, page),
    nextCursor: rows.length > 10 && last ? encodeScoreCursor(last.reactionCount, last.id) : null,
    hasMore: rows.length > 10,
    sort,
  };
}

/* ---------------------------- bookmarks ------------------------------- */

interface BookmarkCursor {
  createdAt: string;
  id: string;
}

function encodeBookmarkCursor(createdAt: Date, id: string): string {
  return Buffer.from(JSON.stringify({ c: createdAt.toISOString(), i: id }), "utf8").toString("base64url");
}

function decodeBookmarkCursor(value?: string | null): BookmarkCursor | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(Buffer.from(value, "base64url").toString("utf8")) as { c?: unknown; i?: unknown };
    if (typeof parsed.c !== "string" || typeof parsed.i !== "string") return null;
    return { createdAt: parsed.c, id: parsed.i };
  } catch {
    return null;
  }
}

export async function getBookmarks(
  viewer: SocialViewer,
  options: { q?: string; type?: "ALL" | "POST" | "QUESTION" | "POLL" | "REPOST"; cursor?: string | null } = {},
): Promise<BookmarkPage> {
  const db = tenantDb(viewer.universityId);
  const [relationships, readableIds] = await Promise.all([
    loadRelationships(db, viewer.userId),
    readableCommunityIds(db, viewer.userId),
  ]);
  const decoded = decodeBookmarkCursor(options.cursor);
  const rows = await db.bookmark.findMany({
    where: {
      userId: viewer.userId,
      ...(decoded
        ? {
            AND: [
              {
                OR: [
                  { createdAt: { lt: new Date(decoded.createdAt) } },
                  { createdAt: new Date(decoded.createdAt), id: { lt: decoded.id } },
                ],
              },
            ],
          }
        : {}),
    },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: 16,
    select: { id: true, postId: true, createdAt: true },
  });
  const hasMore = rows.length > 15;
  const pageRows = rows.slice(0, 15);
  const posts = pageRows.length
    ? await db.post.findMany({
        where: {
          id: { in: pageRows.map((row) => row.postId) },
          status: "ACTIVE",
          ...(options.type && options.type !== "ALL" ? { type: options.type } : {}),
          ...(options.q?.trim()
            ? { body: { contains: options.q.trim(), mode: "insensitive" as const } }
            : {}),
          ...visiblePostsWhere(viewer, readableIds),
        },
        select: postSelect,
      })
    : [];
  const access = await loadCommunityAccessMap(
    db,
    viewer.userId,
    posts.flatMap((post) => (post.communityId ? [post.communityId] : [])),
  );
  const byId = new Map(posts.map((post) => [post.id, post]));
  const ordered = pageRows
    .map((row) => byId.get(row.postId))
    .filter((row): row is PostRow => Boolean(row))
    .filter((row) => canSeePostInCommunity(viewer.studentPath, row, row.communityId ? access.get(row.communityId) : null))
    .filter((row) => !isHiddenAuthor(relationships, row.authorId, viewer.userId));
  const last = pageRows[pageRows.length - 1];
  return {
    posts: await serializeRows(db, viewer, ordered),
    nextCursor: hasMore && last ? encodeBookmarkCursor(last.createdAt, last.id) : null,
    hasMore,
  };
}

/* ---------------------------- profile tabs ----------------------------- */

export interface ProfileReply {
  id: string;
  body: string;
  createdAt: string;
  postId: string;
  postType: string;
  postQuestionTitle: string | null;
}

export async function getAuthorPosts(viewer: SocialViewer, authorId: string, limit = 20): Promise<PostView[]> {
  const db = tenantDb(viewer.universityId);
  const [relationships, joinedIds] = await Promise.all([
    loadRelationships(db, viewer.userId),
    joinedActiveCommunityIds(db, viewer.userId),
  ]);
  if (isHiddenAuthor(relationships, authorId, viewer.userId)) return [];
  const rows = await db.post.findMany({
    where: feedWhere(viewer, "all", relationships, joinedIds, { authorId }, { includePlainReposts: true }),
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: Math.min(limit, 30),
    select: postSelect,
  });
  const access = await loadCommunityAccessMap(
    db,
    viewer.userId,
    rows.flatMap((row) => (row.communityId ? [row.communityId] : [])),
  );
  return serializeRows(
    db,
    viewer,
    rows.filter((row) => canSeePostInCommunity(viewer.studentPath, row, row.communityId ? access.get(row.communityId) : null)),
  );
}

export async function getAuthorReplies(viewer: SocialViewer, authorId: string, limit = 30): Promise<ProfileReply[]> {
  const db = tenantDb(viewer.universityId);
  const relationships = await loadRelationships(db, viewer.userId);
  if (isHiddenAuthor(relationships, authorId, viewer.userId)) return [];
  const rows = await db.comment.findMany({
    where: { authorId, status: "ACTIVE" },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: Math.min(limit, 50),
    select: {
      id: true,
      body: true,
      createdAt: true,
      post: { select: { id: true, type: true, status: true, audiencePath: true, audienceKind: true, authorId: true, communityId: true, questionTitle: true } },
    },
  });
  const access = await loadCommunityAccessMap(
    db,
    viewer.userId,
    rows.flatMap((row) => (row.post.communityId ? [row.post.communityId] : [])),
  );
  return rows
    .filter(
      (row) =>
        row.post.status === "ACTIVE" &&
        canSeePostInCommunity(viewer.studentPath, row.post, row.post.communityId ? access.get(row.post.communityId) : null) &&
        !isHiddenAuthor(relationships, row.post.authorId, viewer.userId),
    )
    .map((row) => ({
      id: row.id,
      body: row.body,
      createdAt: row.createdAt.toISOString(),
      postId: row.post.id,
      postType: row.post.type,
      postQuestionTitle: row.post.questionTitle,
    }));
}

/* ------------------------------- drafts -------------------------------- */

export const DRAFT_PURGE_DAYS = 30;
const DRAFT_MAX = 20;
const DRAFT_MAX_BYTES = 10_000;
const DRAFT_RESTORE_DAYS = 7;

const draftSelect = {
  id: true,
  clientDraftId: true,
  type: true,
  contextKey: true,
  version: true,
  payload: true,
  audience: true,
  updatedAt: true,
} as const;

function draftView(row: {
  id: string;
  clientDraftId: string;
  type: string;
  contextKey: string;
  version: number;
  payload: Prisma.JsonValue;
  audience: Prisma.JsonValue;
  updatedAt: Date;
}): DraftView {
  return {
    id: row.id,
    clientDraftId: row.clientDraftId,
    type: row.type as DraftView["type"],
    contextKey: row.contextKey,
    version: row.version,
    payload: (row.payload ?? {}) as DraftView["payload"],
    audience: (row.audience ?? {}) as DraftView["audience"],
    updatedAt: row.updatedAt.toISOString(),
  };
}

async function purgeExpiredDrafts(db: TenantClient, userId: string): Promise<void> {
  await db.draft.deleteMany({
    where: { userId, updatedAt: { lt: new Date(Date.now() - DRAFT_PURGE_DAYS * 24 * 60 * 60 * 1000) } },
  });
}

export async function listDrafts(viewer: SocialViewer): Promise<DraftView[]> {
  const db = tenantDb(viewer.universityId);
  await purgeExpiredDrafts(db, viewer.userId);
  const rows = await db.draft.findMany({
    where: { userId: viewer.userId },
    orderBy: { updatedAt: "desc" },
    take: 50,
    select: draftSelect,
  });
  return rows.map(draftView);
}

/** Newest draft for one composer context, if it is still worth restoring. */
export async function getDraftForContext(
  viewer: SocialViewer,
  contextKey: string,
): Promise<DraftView | null> {
  const db = tenantDb(viewer.universityId);
  await purgeExpiredDrafts(db, viewer.userId);
  const row = await db.draft.findFirst({
    where: {
      userId: viewer.userId,
      contextKey,
      updatedAt: { gte: new Date(Date.now() - DRAFT_RESTORE_DAYS * 24 * 60 * 60 * 1000) },
    },
    orderBy: { updatedAt: "desc" },
    select: draftSelect,
  });
  return row ? draftView(row) : null;
}

/** Newest draft anywhere; used by Pulse's Continue your draft card. */
export async function getContinueDraft(viewer: SocialViewer): Promise<DraftView | null> {
  const db = tenantDb(viewer.universityId);
  await purgeExpiredDrafts(db, viewer.userId);
  const row = await db.draft.findFirst({
    where: {
      userId: viewer.userId,
      updatedAt: { gte: new Date(Date.now() - DRAFT_RESTORE_DAYS * 24 * 60 * 60 * 1000) },
    },
    orderBy: { updatedAt: "desc" },
    select: draftSelect,
  });
  return row ? draftView(row) : null;
}

function sanitizeDraftPayload(input: DraftView["payload"]): DraftView["payload"] {
  const body = input.body?.slice(0, MAX_POST_LENGTH) ?? "";
  const questionTitle = input.questionTitle?.slice(0, 140) ?? "";
  const payload: DraftView["payload"] = {
    body,
    ...(questionTitle ? { questionTitle } : {}),
    ...(input.topicTag ? { topicTag: input.topicTag.slice(0, 50) } : {}),
    ...(input.pollOptions ? { pollOptions: input.pollOptions.slice(0, 4).map((value) => value.slice(0, 80)) } : {}),
    ...(input.pollDurationDays ? { pollDurationDays: input.pollDurationDays } : {}),
    ...(input.media
      ? {
          media: input.media
            .filter((item) => isAllowedPostPublicId(item.publicId))
            .slice(0, 4)
            .map((item) => ({
              publicId: item.publicId,
              url: item.url,
              width: item.width,
              height: item.height,
              alt: item.alt ?? null,
            })),
        }
      : {}),
  };
  if (JSON.stringify(payload).length > DRAFT_MAX_BYTES) {
    throw new SocialError("That draft is too large to save.");
  }
  return payload;
}

/**
 * Idempotent upsert by the device-generated `clientDraftId`. A stale writer
 * (older version, or the same version with an older device time) is rejected
 * with 409 instead of overwriting a newer tab's content.
 */
export async function saveDraft(
  viewer: SocialViewer,
  input: {
    clientDraftId: string;
    type: "POST" | "QUESTION" | "POLL";
    contextKey?: string;
    version?: number;
    clientUpdatedAt?: string;
    payload: DraftView["payload"];
    audience: DraftView["audience"];
  },
): Promise<DraftView> {
  if (!DRAFT_TYPES.has(input.type)) throw new SocialError("That draft type isn't supported.");
  const clientDraftId = input.clientDraftId.trim().slice(0, 80);
  if (!clientDraftId) throw new SocialError("That draft id isn't valid.");
  const limit = await rateLimit("draftSave", viewer.userId);
  if (!limit.success) throw new SocialError("You're saving drafts too quickly. Try again soon.", 429);

  const payload = sanitizeDraftPayload(input.payload);
  if (
    !payload.body?.trim() &&
    !payload.questionTitle?.trim() &&
    !(payload.media?.length ?? 0) &&
    !(payload.pollOptions?.length ?? 0)
  ) {
    throw new SocialError("Nothing to save yet.");
  }
  const contextKey = (input.contextKey ?? input.type.toLowerCase()).slice(0, 80);
  const incomingVersion = Number.isInteger(input.version) && input.version! > 0 ? input.version! : undefined;
  const incomingClientTime = input.clientUpdatedAt ? new Date(input.clientUpdatedAt) : null;
  const db = tenantDb(viewer.universityId);
  await purgeExpiredDrafts(db, viewer.userId);

  for (let attempt = 0; attempt < 2; attempt += 1) {
    const existing = await db.draft.findFirst({
      where: { userId: viewer.userId, clientDraftId },
      select: { id: true, version: true, clientUpdatedAt: true, updatedAt: true },
    });

    if (!existing) {
      const count = await db.draft.count({ where: { userId: viewer.userId } });
      if (count >= DRAFT_MAX) {
        throw new SocialError("You have 20 saved drafts. Delete one to save another.", 409);
      }
      try {
        const created = await db.draft.create({
          data: {
            universityId: viewer.universityId,
            userId: viewer.userId,
            clientDraftId,
            type: input.type,
            contextKey,
            version: incomingVersion ?? 1,
            clientUpdatedAt: incomingClientTime ?? new Date(),
            payload: payload as Prisma.InputJsonValue,
            audience: input.audience as Prisma.InputJsonValue,
          },
          select: draftSelect,
        });
        return draftView(created);
      } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002" && attempt === 0) {
          continue;
        }
        throw error;
      }
    }

    if (
      isStaleDraftWrite(
        { version: incomingVersion, clientTime: incomingClientTime },
        { version: existing.version, clientTime: existing.clientUpdatedAt },
      )
    ) {
      const current = await db.draft.findFirst({ where: { id: existing.id }, select: draftSelect });
      throw new DraftConflict(current ? draftView(current) : null);
    }

    const claimed = await db.draft.updateMany({
      where: { id: existing.id, version: existing.version },
      data: {
        type: input.type,
        contextKey,
        version: nextDraftVersion(incomingVersion, existing.version),
        clientUpdatedAt: incomingClientTime ?? new Date(),
        payload: payload as Prisma.InputJsonValue,
        audience: input.audience as Prisma.InputJsonValue,
      },
    });
    if (claimed.count === 0) {
      if (attempt === 0) continue;
      const current = await db.draft.findFirst({ where: { id: existing.id }, select: draftSelect });
      throw new DraftConflict(current ? draftView(current) : null);
    }
    const saved = await db.draft.findFirst({ where: { id: existing.id }, select: draftSelect });
    if (!saved) throw new SocialError("That draft isn't available.");
    return draftView(saved);
  }
  throw new SocialError("That draft changed in another tab. Reopen it and try again.", 409);
}

/** Idempotent: deleting a draft that is already gone is success. */
export async function deleteDraft(viewer: SocialViewer, draftId: string): Promise<{ deleted: boolean }> {
  const db = tenantDb(viewer.universityId);
  const draft = await db.draft.findFirst({
    where: { userId: viewer.userId, OR: [{ id: draftId }, { clientDraftId: draftId }] },
    select: { id: true },
  });
  if (!draft) return { deleted: false };
  await db.draft.delete({ where: { id: draft.id } });
  return { deleted: true };
}

/* ----------------------------- discovery ------------------------------ */

export async function searchMentionableUsers(
  viewer: SocialViewer,
  query: string,
): Promise<Array<{ username: string; fullName: string; photoUrl: string | null }>> {
  const q = query.trim().replace(/^@/, "").toLowerCase();
  if (q.length < 2) return [];
  const db = tenantDb(viewer.universityId);
  const relationships = await loadRelationships(db, viewer.userId);
  const hidden = hiddenAuthorIds(relationships);
  return db.user.findMany({
    where: {
      username: { startsWith: q },
      status: { in: ["VERIFIED", "ALUMNI"] },
      ...(hidden.length > 0 ? { id: { notIn: hidden } } : {}),
    },
    orderBy: { username: "asc" },
    take: 8,
    select: { username: true, fullName: true, photoUrl: true },
  });
}

export async function searchHashtags(viewer: SocialViewer, query: string): Promise<string[]> {
  const q = query.trim().replace(/^#/, "").toLowerCase();
  if (q.length < 1) return [];
  const db = tenantDb(viewer.universityId);
  const [relationships, readableIds] = await Promise.all([
    loadRelationships(db, viewer.userId),
    readableCommunityIds(db, viewer.userId),
  ]);
  const hidden = hiddenAuthorIds(relationships);
  // Only suggest tags that appear on a post this viewer may read, so a tag
  // first used inside a private community never leaks its existence.
  const rows = await db.postHashtag.findMany({
    where: {
      hashtag: { tag: { startsWith: q } },
      post: {
        status: "ACTIVE",
        ...visiblePostsWhere(viewer, readableIds),
        ...(hidden.length > 0 ? { authorId: { notIn: hidden } } : {}),
      },
    },
    distinct: ["hashtagId"],
    orderBy: { hashtag: { tag: "asc" } },
    take: 6,
    select: { hashtag: { select: { tag: true } } },
  });
  return rows.map((row) => row.hashtag.tag);
}

/**
 * Logged-out share preview. A missing post, a deleted post, a removed post and
 * a post with a narrower audience all return the same generic result, so the
 * page cannot be used to probe for existence or content.
 */
export async function getPublicPreview(
  postId: string,
): Promise<{ kind: "preview"; firstLine: string } | { kind: "generic" }> {
  const post = await platformDb.post.findFirst({
    where: { id: postId },
    select: { status: true, audienceKind: true, body: true, questionTitle: true, communityId: true },
  });
  if (!post || post.status !== "ACTIVE" || post.audienceKind !== "PUBLIC" || post.communityId) {
    return { kind: "generic" };
  }
  const line = firstLine(post.body || post.questionTitle || "");
  if (!line) return { kind: "generic" };
  return { kind: "preview", firstLine: line.slice(0, 160) };
}

/* ------------------------- reaction lists ----------------------------- */

export async function getReactionList(
  viewer: SocialViewer,
  postId: string,
): Promise<Array<{ username: string; fullName: string; photoUrl: string | null }> | null> {
  const db = tenantDb(viewer.universityId);
  const post = await db.post.findFirst({
    where: { id: postId },
    select: { id: true, status: true, audiencePath: true, audienceKind: true, authorId: true, communityId: true },
  });
  const access = post?.communityId
    ? (await loadCommunityAccessMap(db, viewer.userId, [post.communityId])).get(post.communityId) ?? null
    : null;
  if (!post || post.status !== "ACTIVE" || !canSeePostInCommunity(viewer.studentPath, post, access)) return null;
  const relationships = await loadRelationships(db, viewer.userId);
  if (isHiddenAuthor(relationships, post.authorId, viewer.userId)) return null;
  const reactions = await db.reaction.findMany({
    where: { targetType: "POST", targetId: postId },
    orderBy: { createdAt: "desc" },
    take: 100,
    select: { userId: true },
  });
  const userIds = reactions.map((reaction) => reaction.userId).filter((userId) => !isHiddenAuthor(relationships, userId, viewer.userId));
  const users = await db.user.findMany({
    where: { id: { in: userIds } },
    select: { id: true, username: true, fullName: true, photoUrl: true },
  });
  const byId = new Map(users.map((user) => [user.id, user]));
  return userIds.flatMap((id) => {
    const user = byId.get(id);
    return user ? [{ username: user.username, fullName: user.fullName, photoUrl: user.photoUrl }] : [];
  });
}

export function __clearTrendingCache(): void {
  trendingCache.clear();
}
