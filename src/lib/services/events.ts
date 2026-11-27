import "server-only";
import type { Prisma } from "@prisma/client";
import { writeAudit } from "@/lib/audit";
import { tenantDb, withTenantTransaction, type TenantClient } from "@/lib/db/tenant";
import { cloudinaryImageUrl } from "@/lib/media/image-url";
import {
  audienceIsOnViewerPath,
  canSeeEvent,
  canSeeEventInCommunity,
  capacityRemaining,
  checkInWindow,
  DAILY_EVENT_LIMIT,
  EVENT_PAGE_SIZE,
  eventAllowsOutsideSharing,
  eventCategoryColor,
  eventPermissions,
  eventTitleError,
  eventDescriptionError,
  eventVenueError,
  eventCapacityError,
  eventHasEnded,
  eventHasStarted,
  eventIsLive,
  goingOutcome,
  MAX_EVENT_STAFF,
  MAX_EVENT_TITLE,
  MAX_EVENT_DESCRIPTION,
  MAX_UPCOMING_EVENTS,
  materialEventChange,
  nextWaitlistPosition,
  organizerAudienceIsValid,
  rsvpIsOpen,
  validateEventWindow,
  type EventAudienceKind,
  type EventCategory,
  type EventPermissionActor,
  type EventRsvpStatus,
  type EventStaffRole,
  type EventStatus,
} from "@/lib/domain/events";
import { generateTicketCode, hashTicketCode, ticketCodeMatches } from "@/lib/domain/event-ticket";
import { calendarMonthBounds, eventDateKey } from "@/lib/domain/event-time";
import { SocialError } from "@/lib/posts/errors";
import { rateLimit } from "@/lib/security/rate-limit";
import { loadCommunityAccessMap } from "./community-access";
import { isHiddenAuthor, loadRelationships, type RelationshipSets, type SocialViewer } from "./social";

/**
 * Event service. All reads and writes go through tenantDb, and every read
 * re-applies the visibility decision — community membership, academic path,
 * blocks and status — so a filter mismatch can never become a read.
 */

export const EVENT_NOT_AVAILABLE = new SocialError("This event isn't available.", 404, "not_available");

export const eventSelect = {
  id: true,
  title: true,
  description: true,
  category: true,
  startsAt: true,
  endsAt: true,
  timezone: true,
  venueName: true,
  venueNote: true,
  coverPublicId: true,
  capacity: true,
  waitlistEnabled: true,
  checkInEnabled: true,
  allowOutsideSharing: true,
  status: true,
  cancelReason: true,
  cancelledAt: true,
  lastMaterialChangeAt: true,
  materialChanges: true,
  goingCount: true,
  interestedCount: true,
  waitlistCount: true,
  checkedInCount: true,
  audienceKind: true,
  audiencePath: true,
  organiserKind: true,
  communityId: true,
  officialAccountId: true,
  createdById: true,
  createdAt: true,
  updatedAt: true,
  community: {
    select: { id: true, name: true, slug: true, iconPublicId: true, privacy: true, status: true, isOfficial: true },
  },
  officialAccount: {
    select: { id: true, name: true, slug: true, avatarPublicId: true, category: true, status: true },
  },
  placeId: true,
  place: { select: { id: true, name: true, latitude: true, longitude: true } },
  createdBy: {
    select: {
      id: true,
      username: true,
      fullName: true,
      photoUrl: true,
      level: true,
      department: { select: { name: true } },
    },
  },
} satisfies Prisma.EventSelect;

export type EventRow = Prisma.EventGetPayload<{ select: typeof eventSelect }>;

export interface EventViewerState {
  status: EventRsvpStatus | null;
  hasTicket: boolean;
  staffRole: EventStaffRole | null;
}

export interface MaterialChange {
  at: string;
  fields: string[];
  previous: { startsAt?: string; endsAt?: string; venueName?: string };
}

export function parseMaterialChanges(value: Prisma.JsonValue): MaterialChange[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry) => {
    if (!entry || typeof entry !== "object") return [];
    const row = entry as Record<string, unknown>;
    if (typeof row.at !== "string" || !Array.isArray(row.fields)) return [];
    return [
      {
        at: row.at,
        fields: row.fields.filter((field): field is string => typeof field === "string"),
        previous: (row.previous && typeof row.previous === "object" ? row.previous : {}) as MaterialChange["previous"],
      },
    ];
  });
}

export function serializeEvent(row: EventRow) {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    category: row.category,
    startsAt: row.startsAt.toISOString(),
    endsAt: row.endsAt.toISOString(),
    timezone: row.timezone,
    venueName: row.venueName,
    venueNote: row.venueNote,
    coverPublicId: row.coverPublicId,
    capacity: row.capacity,
    waitlistEnabled: row.waitlistEnabled,
    checkInEnabled: row.checkInEnabled,
    allowOutsideSharing: row.allowOutsideSharing,
    status: row.status,
    cancelReason: row.cancelReason,
    cancelledAt: row.cancelledAt?.toISOString() ?? null,
    lastMaterialChangeAt: row.lastMaterialChangeAt?.toISOString() ?? null,
    materialChanges: parseMaterialChanges(row.materialChanges),
    goingCount: row.goingCount,
    interestedCount: row.interestedCount,
    waitlistCount: row.waitlistCount,
    checkedInCount: row.checkedInCount,
    audienceKind: row.audienceKind,
    audiencePath: row.audiencePath,
    organiserKind: row.organiserKind,
    communityId: row.communityId,
    officialAccountId: row.officialAccountId,
    createdById: row.createdById,
    createdAt: row.createdAt.toISOString(),
    community: row.community,
    officialAccount: row.officialAccount,
    place: row.place,
    // Never expose the staff member behind an official account, and show the
    // community rather than an individual member for community events.
    organisers:
      row.organiserKind === "USER"
        ? row.createdBy
        : {
            id: row.communityId ?? row.officialAccountId ?? "",
            username: "",
            fullName: row.community?.name ?? row.officialAccount?.name ?? "Organiser",
            photoUrl: null,
          },
    coverUrl: coverUrl(row.coverPublicId),
    categoryColor: eventCategoryColor(row.category),
    live: eventIsLive(row),
    ended: eventHasEnded(row),
    started: eventHasStarted(row),
    capacityRemaining: capacityRemaining(row.capacity, row.goingCount),
    shareable: eventAllowsOutsideSharing(row),
    attendeePreview: [] as Array<{ id: string; username: string; fullName: string; photoUrl: string | null }>,
  };
}

export type SerializedEvent = ReturnType<typeof serializeEvent>;

export function coverUrl(publicId: string | null | undefined): string | null {
  if (!publicId) return null;
  // Demo seed art is served by the app itself, never uploaded to Cloudinary.
  if (publicId.startsWith("/")) return publicId;
  if (publicId.startsWith("local:")) return `/uploads/posts/${publicId.slice("local:".length)}.webp`;
  return cloudinaryImageUrl(publicId, "cover");
}

/* ------------------------------- visibility ------------------------------- */

interface ViewerContext {
  db: TenantClient;
  relationships: RelationshipSets;
  communityAccess: Awaited<ReturnType<typeof loadCommunityAccessMap>>;
}

async function loadViewerContext(viewer: SocialViewer, rows: EventRow[]): Promise<ViewerContext> {
  const db = tenantDb(viewer.universityId);
  const [relationships, communityAccess] = await Promise.all([
    loadRelationships(db, viewer.userId),
    loadCommunityAccessMap(
      db,
      viewer.userId,
      rows.map((row) => row.communityId).filter((id): id is string => Boolean(id)),
    ),
  ]);
  return { db, relationships, communityAccess };
}

function viewerCanSeeRow(viewer: SocialViewer, row: EventRow, context: Pick<ViewerContext, "relationships" | "communityAccess">): boolean {
  if (row.status === "REMOVED") return false;
  if (row.organiserKind === "USER" && isHiddenAuthor(context.relationships, row.createdById, viewer.userId)) {
    return false;
  }
  if (row.audienceKind === "COMMUNITY") {
    const access = row.communityId ? context.communityAccess.get(row.communityId) : null;
    return canSeeEventInCommunity(viewer.studentPath, row, access);
  }
  return canSeeEvent(viewer.studentPath, row);
}

/** The exact rows this viewer may see, expressed as a Prisma filter. */
export function visibleEventsWhere(
  viewer: SocialViewer,
  relationships: RelationshipSets,
  communityIds: readonly string[],
): Prisma.EventWhereInput {
  const prefixes: string[][] = [["PUBLIC"]];
  for (let length = 2; length <= viewer.studentPath.length; length += 1) {
    prefixes.push(viewer.studentPath.slice(0, length).map(String));
  }
  const hidden = [
    ...new Set([...relationships.blocked, ...relationships.blockedBy]),
  ];
  return {
    status: { in: ["SCHEDULED", "CANCELLED"] },
    OR: [
      { audienceKind: "PUBLIC" },
      ...prefixes.slice(1).map((path) => ({ audiencePath: { equals: path } })),
      ...(communityIds.length > 0
        ? [{ audienceKind: "COMMUNITY" as const, communityId: { in: [...communityIds] } }]
        : []),
    ],
    ...(hidden.length > 0
      ? { NOT: { organiserKind: "USER" as const, createdById: { in: hidden } } }
      : {}),
  };
}

export async function readableCommunityEventIds(db: TenantClient, viewerId: string): Promise<string[]> {
  const [joined, publicCommunities] = await Promise.all([
    db.communityMember.findMany({
      where: { userId: viewerId, status: "ACTIVE", community: { status: "ACTIVE" } },
      select: { communityId: true },
    }),
    db.community.findMany({ where: { status: "ACTIVE", privacy: "PUBLIC" }, select: { id: true } }),
  ]);
  return [...new Set([...joined.map((row) => row.communityId), ...publicCommunities.map((row) => row.id)])];
}

async function rsvpStateFor(db: TenantClient, viewerId: string, eventIds: string[]): Promise<Map<string, EventRsvpStatus>> {
  if (eventIds.length === 0) return new Map();
  const rows = await db.eventRsvp.findMany({
    where: { userId: viewerId, eventId: { in: eventIds }, status: { not: "CANCELLED" } },
    select: { eventId: true, status: true },
  });
  return new Map(rows.map((row) => [row.eventId, row.status as EventRsvpStatus]));
}

async function ticketStateFor(db: TenantClient, viewerId: string, eventIds: string[]): Promise<Set<string>> {
  if (eventIds.length === 0) return new Set();
  const rows = await db.eventTicket.findMany({
    where: { userId: viewerId, eventId: { in: eventIds }, revokedAt: null },
    select: { eventId: true },
  });
  return new Set(rows.map((row) => row.eventId));
}

/* --------------------------------- reads --------------------------------- */

export type EventListTab = "for-you" | "this-week" | "calendar";

export interface EventListOptions {
  tab?: EventListTab;
  category?: EventCategory | null;
  month?: { year: number; month: number } | null;
  cursor?: string | null;
  limit?: number;
}

export interface EventListResult {
  events: SerializedEvent[];
  viewer: Record<string, EventViewerState>;
  nextCursor: string | null;
  happeningNow: SerializedEvent[];
  range: { start: string; end: string } | null;
}

function cursorWhere(cursor: string | null | undefined): Prisma.EventWhereInput | null {
  if (!cursor) return null;
  const parsed = new Date(cursor);
  if (Number.isNaN(parsed.getTime())) return null;
  return { startsAt: { gt: parsed } };
}

export async function listEvents(viewer: SocialViewer, options: EventListOptions = {}): Promise<EventListResult> {
  const db = tenantDb(viewer.universityId);
  const now = new Date();
  const tab = options.tab ?? "for-you";
  const limit = Math.min(Math.max(options.limit ?? EVENT_PAGE_SIZE, 1), 30);
  const [relationships, communityIds] = await Promise.all([
    loadRelationships(db, viewer.userId),
    readableCommunityEventIds(db, viewer.userId),
  ]);
  const base = visibleEventsWhere(viewer, relationships, communityIds);

  const startRange =
    tab === "calendar"
      ? calendarMonthBounds(
          options.month?.year ?? now.getFullYear(),
          options.month?.month ?? now.getMonth() + 1,
          viewer.timezone,
        )
      : tab === "this-week"
        ? { start: now, end: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000) }
        : null;

  const where: Prisma.EventWhereInput = {
    ...base,
    ...(options.category ? { category: options.category } : {}),
    ...(startRange ? { startsAt: { gte: startRange.start, lte: startRange.end } } : {}),
    ...(tab === "for-you" ? { endsAt: { gt: now } } : {}),
    ...(tab === "calendar" ? {} : {}),
  };

  const cursorFilter = cursorWhere(options.cursor);
  const rows = await db.event.findMany({
    where: cursorFilter ? { AND: [where, cursorFilter] } : where,
    orderBy: [{ startsAt: "asc" }, { id: "asc" }],
    take: limit + 1,
    select: eventSelect,
  });
  const page = rows.slice(0, limit);
  const candidates = page.filter((row) => {
    if (row.status === "REMOVED") return false;
    if (row.organiserKind === "USER" && isHiddenAuthor(relationships, row.createdById, viewer.userId)) {
      return false;
    }
    // Community rows are decided after their membership map is loaded.
    if (row.audienceKind === "COMMUNITY") return true;
    return canSeeEvent(viewer.studentPath, row);
  });

  const communityAccess = await loadCommunityAccessMap(
    db,
    viewer.userId,
    candidates.map((row) => row.communityId).filter((id): id is string => Boolean(id)),
  );
  const finalRows = candidates.filter((row) =>
    viewerCanSeeRow(viewer, row, { relationships, communityAccess }),
  );
  const eventIds = finalRows.map((row) => row.id);
  const [statuses, tickets] = await Promise.all([
    rsvpStateFor(db, viewer.userId, eventIds),
    ticketStateFor(db, viewer.userId, eventIds),
  ]);

  const happeningRows = await db.event.findMany({
    where: {
      ...base,
      startsAt: { lte: now },
      endsAt: { gt: now },
      ...(options.category ? { category: options.category } : {}),
    },
    orderBy: [{ startsAt: "asc" }],
    take: 6,
    select: eventSelect,
  });
  const happeningAccess = await loadCommunityAccessMap(
    db,
    viewer.userId,
    happeningRows.map((row) => row.communityId).filter((id): id is string => Boolean(id)),
  );
  const happeningNow = happeningRows
    .filter((row) => viewerCanSeeRow(viewer, row, { relationships, communityAccess: happeningAccess }))
    .map(serializeEvent);

  const viewerState: Record<string, EventViewerState> = {};
  for (const row of finalRows) {
    viewerState[row.id] = {
      status: statuses.get(row.id) ?? null,
      hasTicket: tickets.has(row.id),
      staffRole: null,
    };
  }
  const previewRows =
    eventIds.length > 0
      ? await db.eventRsvp.findMany({
          where: { eventId: { in: eventIds }, status: "GOING", showPublicly: true },
          orderBy: { createdAt: "asc" },
          take: 150,
          select: { eventId: true, userId: true, user: { select: { id: true, username: true, fullName: true, photoUrl: true } } },
        })
      : [];
  const previewByEvent = new Map<string, Array<{ id: string; username: string; fullName: string; photoUrl: string | null }>>();
  for (const entry of previewRows) {
    if (isHiddenAuthor(relationships, entry.userId, viewer.userId)) continue;
    const list = previewByEvent.get(entry.eventId) ?? [];
    if (list.length < 5) {
      list.push(entry.user);
      previewByEvent.set(entry.eventId, list);
    }
  }

  return {
    events: finalRows.map((row) => ({ ...serializeEvent(row), attendeePreview: previewByEvent.get(row.id) ?? [] })),
    viewer: viewerState,
    nextCursor: rows.length > limit ? page[page.length - 1]?.startsAt.toISOString() ?? null : null,
    happeningNow,
    range: startRange ? { start: startRange.start.toISOString(), end: startRange.end.toISOString() } : null,
  };
}

export interface EventActorContext {
  staffRole: EventStaffRole | null;
  officialStaff: { canPublishCritical: boolean } | null;
  communityRole: "OWNER" | "MODERATOR" | "MEMBER" | null;
  communityMemberStatus: string | null;
  communityMuted: boolean;
  communityAllowMemberEvents: boolean;
  permissions: ReturnType<typeof eventPermissions>;
}

export async function loadEventActorContext(
  db: TenantClient,
  viewer: SocialViewer,
  row: EventRow,
): Promise<EventActorContext> {
  const [staff, officialStaff, membership, community] = await Promise.all([
    db.eventStaff.findFirst({ where: { eventId: row.id, userId: viewer.userId }, select: { role: true } }),
    row.officialAccountId
      ? db.officialAccountStaff.findFirst({
          where: { officialAccountId: row.officialAccountId, userId: viewer.userId },
          select: { canPublishCritical: true },
        })
      : Promise.resolve(null),
    row.communityId
      ? db.communityMember.findUnique({
          where: { communityId_userId: { communityId: row.communityId, userId: viewer.userId } },
          select: { role: true, status: true, mutedUntil: true },
        })
      : Promise.resolve(null),
    row.communityId
      ? db.community.findFirst({
          where: { id: row.communityId },
          select: { allowMemberEvents: true },
        })
      : Promise.resolve(null),
  ]);

  const actor: EventPermissionActor = {
    userId: viewer.userId,
    isUniversityAdmin: viewer.isUniversityAdmin,
    isUniversityModerator: viewer.isUniversityModerator,
    communityRole: (membership?.role as "OWNER" | "MODERATOR" | "MEMBER" | undefined) ?? null,
    communityMemberStatus: membership?.status ?? null,
    communityMuted: Boolean(membership?.mutedUntil && membership.mutedUntil.getTime() > Date.now()),
    communityAllowMemberEvents: community?.allowMemberEvents ?? false,
    officialStaff: officialStaff ?? null,
    staffRole: (staff?.role as EventStaffRole | undefined) ?? null,
  };

  return {
    staffRole: (staff?.role as EventStaffRole | undefined) ?? null,
    officialStaff: officialStaff ?? null,
    communityRole: (membership?.role as "OWNER" | "MODERATOR" | "MEMBER" | undefined) ?? null,
    communityMemberStatus: membership?.status ?? null,
    communityMuted: Boolean(actor.communityMuted),
    communityAllowMemberEvents: community?.allowMemberEvents ?? false,
    permissions: eventPermissions(actor, row),
  };
}

export interface EventDetailResult {
  event: SerializedEvent;
  viewer: EventViewerState;
  permissions: EventActorContext["permissions"];
  actor: Omit<EventActorContext, "permissions">;
  attendees: {
    count: number;
    preview: Array<{ id: string; username: string; fullName: string; photoUrl: string | null }>;
    hiddenCount: number;
  };
  updates: Array<{ id: string; body: string; createdAt: string; author: { username: string; fullName: string; photoUrl: string | null } }>;
  comments: Array<{
    id: string;
    body: string;
    createdAt: string;
    author: { id: string; username: string; fullName: string; photoUrl: string | null };
    replies: Array<{ id: string; body: string; createdAt: string; author: { id: string; username: string; fullName: string; photoUrl: string | null } }>;
  }>;
  commentCount: number;
  changeLog: MaterialChange[];
  rsvpOpen: boolean;
  checkInOpen: boolean;
  checkInOpensAt: string;
}

export async function getEventDetail(
  viewer: SocialViewer,
  eventId: string,
  options: { recordView?: boolean } = {},
): Promise<EventDetailResult> {
  const db = tenantDb(viewer.universityId);
  const row = await db.event.findFirst({ where: { id: eventId }, select: eventSelect });
  if (!row) throw EVENT_NOT_AVAILABLE;
  const context = await loadViewerContext(viewer, [row]);
  if (!viewerCanSeeRow(viewer, row, context)) throw EVENT_NOT_AVAILABLE;

  const actor = await loadEventActorContext(db, viewer, row);
  const [rsvp, ticket, attendeeRows, hiddenAttendees, updates, commentRows, changeLog] = await Promise.all([
    db.eventRsvp.findUnique({
      where: { eventId_userId: { eventId: row.id, userId: viewer.userId } },
      select: { status: true },
    }),
    db.eventTicket.findFirst({
      where: { eventId: row.id, userId: viewer.userId, revokedAt: null },
      select: { id: true },
    }),
    db.eventRsvp.findMany({
      where: { eventId: row.id, status: "GOING" },
      orderBy: [{ createdAt: "asc" }],
      select: {
        showPublicly: true,
        userId: true,
        user: {
          select: { id: true, username: true, fullName: true, photoUrl: true },
        },
      },
    }),
    loadRelationships(db, viewer.userId),
    db.eventUpdate.findMany({
      where: { eventId: row.id },
      orderBy: { createdAt: "desc" },
      take: 20,
      select: {
        id: true,
        body: true,
        createdAt: true,
        author: { select: { id: true, username: true, fullName: true, photoUrl: true } },
      },
    }),
    db.eventComment.findMany({
      where: { eventId: row.id, status: "ACTIVE", parentId: null },
      orderBy: { createdAt: "asc" },
      take: 100,
      select: {
        id: true,
        body: true,
        createdAt: true,
        author: { select: { id: true, username: true, fullName: true, photoUrl: true } },
        replies: {
          where: { status: "ACTIVE" },
          orderBy: { createdAt: "asc" },
          take: 20,
          select: {
            id: true,
            body: true,
            createdAt: true,
            author: { select: { id: true, username: true, fullName: true, photoUrl: true } },
          },
        },
      },
    }),
    Promise.resolve(parseMaterialChanges(row.materialChanges)),
  ]);

  const visibleAttendees = attendeeRows.filter(
    (entry) =>
      !isHiddenAuthor(hiddenAttendees, entry.userId, viewer.userId),
  );
  const preview = visibleAttendees
    .filter((entry) => entry.showPublicly)
    .slice(0, 5)
    .map((entry) => entry.user);
  const hiddenCount = visibleAttendees.length - visibleAttendees.filter((entry) => entry.showPublicly).length;
  // Blocked students disappear from comments, updates and the count, exactly
  // as they do from feeds. Organisers still get the complete list through the
  // dedicated organiser endpoint.
  const visibleUpdates = updates.filter(
    (update) => !isHiddenAuthor(hiddenAttendees, update.author.id, viewer.userId),
  );
  const visibleComments = commentRows
    .filter((comment) => !isHiddenAuthor(hiddenAttendees, comment.author.id, viewer.userId))
    .map((comment) => ({
      ...comment,
      replies: comment.replies.filter(
        (reply) => !isHiddenAuthor(hiddenAttendees, reply.author.id, viewer.userId),
      ),
    }));
  const window = checkInWindow(row);

  if (options.recordView !== false) {
    await recordEventView(viewer, row.id).catch(() => undefined);
  }

  return {
    event: serializeEvent(row),
    viewer: {
      status: (rsvp?.status as EventRsvpStatus | undefined) ?? null,
      hasTicket: Boolean(ticket),
      staffRole: actor.staffRole,
    },
    permissions: actor.permissions,
    actor: {
      staffRole: actor.staffRole,
      officialStaff: actor.officialStaff,
      communityRole: actor.communityRole,
      communityMemberStatus: actor.communityMemberStatus,
      communityMuted: actor.communityMuted,
      communityAllowMemberEvents: actor.communityAllowMemberEvents,
    },
    attendees: {
      count: visibleAttendees.length,
      preview,
      hiddenCount,
    },
    updates: visibleUpdates.map((update) => ({
      id: update.id,
      body: update.body,
      createdAt: update.createdAt.toISOString(),
      author: update.author,
    })),
    comments: visibleComments.map((comment) => ({
      id: comment.id,
      body: comment.body,
      createdAt: comment.createdAt.toISOString(),
      author: comment.author,
      replies: comment.replies.map((reply) => ({
        id: reply.id,
        body: reply.body,
        createdAt: reply.createdAt.toISOString(),
        author: reply.author,
      })),
    })),
    commentCount: visibleComments.reduce((sum, comment) => sum + 1 + comment.replies.length, 0),
    changeLog,
    rsvpOpen: rsvpIsOpen(row),
    checkInOpen: window.open,
    checkInOpensAt: window.opensAt.toISOString(),
  };
}

/** One unique view per student per day. Repeats are silently ignored. */
export async function recordEventView(viewer: SocialViewer, eventId: string): Promise<void> {
  const db = tenantDb(viewer.universityId);
  const date = new Date(`${eventDateKey(new Date(), viewer.timezone)}T00:00:00.000Z`);
  await db.eventViewDaily.createMany({
    data: [{ universityId: viewer.universityId, eventId, userId: viewer.userId, date }],
    skipDuplicates: true,
  });
}

export async function getHappeningNow(viewer: SocialViewer): Promise<SerializedEvent[]> {
  const result = await listEvents(viewer, { tab: "for-you", limit: 1 });
  return result.happeningNow;
}

export async function getUpcomingEvent(viewer: SocialViewer): Promise<SerializedEvent | null> {
  const result = await listEvents(viewer, { tab: "for-you", limit: 3 });
  return result.events.find((event) => !event.ended && !event.live) ?? result.events[0] ?? null;
}

export async function getMyEvents(
  viewer: SocialViewer,
  tab: "going" | "interested" | "waitlisted" | "past",
): Promise<{ events: Array<SerializedEvent & { rsvpStatus: EventRsvpStatus; hasTicket: boolean }> }> {
  const db = tenantDb(viewer.universityId);
  const now = new Date();
  const rows = await db.eventRsvp.findMany({
    where: { userId: viewer.userId, status: { not: "CANCELLED" } },
    orderBy: { createdAt: "desc" },
    take: 200,
    select: { status: true, event: { select: eventSelect } },
  });
  const events = rows.map((row) => ({ ...row.event, rsvpStatus: row.status as EventRsvpStatus }));
  const relationships = await loadRelationships(db, viewer.userId);
  const access = await loadCommunityAccessMap(
    db,
    viewer.userId,
    events.map((event) => event.communityId).filter((id): id is string => Boolean(id)),
  );
  const visible = events.filter((event) => viewerCanSeeRow(viewer, event as EventRow, { relationships, communityAccess: access }));
  const ticketIds = await ticketStateFor(db, viewer.userId, visible.map((event) => event.id));

  const filtered = visible.filter((event) => {
    const ended = eventHasEnded(event, now);
    if (tab === "past") return ended;
    if (ended) return false;
    if (tab === "going") return event.rsvpStatus === "GOING";
    if (tab === "interested") return event.rsvpStatus === "INTERESTED";
    return event.rsvpStatus === "WAITLISTED";
  });

  return {
    events: filtered.map((event) => ({
      ...serializeEvent(event as EventRow),
      rsvpStatus: event.rsvpStatus,
      hasTicket: ticketIds.has(event.id),
    })),
  };
}

/** Events in the viewer's My Events that are safe to export to a calendar. */
export async function getMyEventsForCalendar(viewer: SocialViewer): Promise<EventRow[]> {
  const db = tenantDb(viewer.universityId);
  const rows = await db.eventRsvp.findMany({
    where: { userId: viewer.userId, status: { not: "CANCELLED" } },
    take: 200,
    select: { event: { select: eventSelect } },
  });
  const relationships = await loadRelationships(db, viewer.userId);
  const events = rows.map((row) => row.event);
  const access = await loadCommunityAccessMap(
    db,
    viewer.userId,
    events.map((event) => event.communityId).filter((id): id is string => Boolean(id)),
  );
  return events.filter((event) => viewerCanSeeRow(viewer, event, { relationships, communityAccess: access }));
}

/* -------------------------------- writes --------------------------------- */

export interface CreateEventInput {
  title: string;
  description: string;
  category: EventCategory;
  audienceKind: EventAudienceKind;
  audiencePath: string[];
  startsAt: Date;
  endsAt: Date;
  venueName: string;
  placeId?: string | null;
  venueNote?: string | null;
  coverPublicId?: string | null;
  capacity?: number | null;
  waitlistEnabled?: boolean;
  checkInEnabled?: boolean;
  allowOutsideSharing?: boolean;
  communityId?: string | null;
  officialAccountId?: string | null;
}

export interface OrganizerChoice {
  organiserKind: "USER" | "COMMUNITY" | "OFFICIAL";
  communityId: string | null;
  officialAccountId: string | null;
}

async function resolveOrganizer(
  db: TenantClient,
  viewer: SocialViewer,
  input: { communityId?: string | null; officialAccountId?: string | null },
): Promise<OrganizerChoice> {
  if (input.communityId && input.officialAccountId) {
    throw new SocialError("Choose one organiser: a community or an official account.");
  }
  if (input.communityId) {
    const [community, membership] = await Promise.all([
      db.community.findFirst({
        where: { id: input.communityId, status: "ACTIVE" },
        select: { id: true, allowMemberEvents: true },
      }),
      db.communityMember.findUnique({
        where: { communityId_userId: { communityId: input.communityId, userId: viewer.userId } },
        select: { role: true, status: true, mutedUntil: true },
      }),
    ]);
    if (!community) throw new SocialError("That community isn't available.");
    const isStaff = membership?.status === "ACTIVE" && (membership.role === "OWNER" || membership.role === "MODERATOR");
    const isMember = membership?.status === "ACTIVE" && community.allowMemberEvents;
    const muted = membership?.mutedUntil && membership.mutedUntil.getTime() > Date.now();
    if (!isStaff && !(isMember && !muted)) {
      throw new SocialError("Only community owners and moderators can create events for this community.", 403, "forbidden");
    }
    return { organiserKind: "COMMUNITY", communityId: community.id, officialAccountId: null };
  }
  if (input.officialAccountId) {
    const account = await db.officialAccount.findFirst({
      where: { id: input.officialAccountId, status: "ACTIVE" },
      select: { id: true },
    });
    if (!account) throw new SocialError("That official account isn't available.");
    const staff = await db.officialAccountStaff.findUnique({
      where: { officialAccountId_userId: { officialAccountId: account.id, userId: viewer.userId } },
      select: { id: true },
    });
    if (!staff && !viewer.isUniversityAdmin) {
      throw new SocialError("You don't have posting rights for this official account.", 403, "forbidden");
    }
    return { organiserKind: "OFFICIAL", communityId: null, officialAccountId: account.id };
  }
  return { organiserKind: "USER", communityId: null, officialAccountId: null };
}

async function validatePlace(db: TenantClient, placeId: string | null | undefined): Promise<string | null> {
  if (!placeId) return null;
  const place = await db.campusPlace.findFirst({ where: { id: placeId, active: true }, select: { id: true } });
  if (!place) throw new SocialError("That campus place isn't available.");
  return place.id;
}

function normalizeCover(publicId: string | null | undefined): string | null {
  if (!publicId) return null;
  if (publicId.startsWith("local:")) {
    if (!/^local:[a-f0-9-]{8,}$/i.test(publicId)) throw new SocialError("That cover image is not valid.");
    return publicId;
  }
  if (!/^[a-zA-Z0-9_/-]{3,200}$/.test(publicId)) throw new SocialError("That cover image is not valid.");
  return publicId;
}

export async function createEvent(
  viewer: SocialViewer,
  input: CreateEventInput,
): Promise<{ id: string }> {
  if (viewer.accountAgeHours < 24) {
    throw new SocialError("Your account must be at least 24 hours old before you can create an event.", 403, "account_too_new");
  }
  const limit = await rateLimit("eventCreate", viewer.userId);
  if (!limit.success) throw new SocialError("You can create 3 events per day. Try again tomorrow.", 429, "rate_limited");
  const titleError = eventTitleError(input.title);
  if (titleError) throw new SocialError(titleError);
  const descriptionError = eventDescriptionError(input.description);
  if (descriptionError) throw new SocialError(descriptionError);
  const venueError = eventVenueError(input.venueName);
  if (venueError) throw new SocialError(venueError);
  const capacityError = eventCapacityError(input.capacity ?? null);
  if (capacityError) throw new SocialError(capacityError);
  const windowError = validateEventWindow({ startsAt: input.startsAt, endsAt: input.endsAt });
  if (windowError) throw new SocialError(windowError);

  const db = tenantDb(viewer.universityId);
  const organizer = await resolveOrganizer(db, viewer, input);
  if (!organizerAudienceIsValid({
    organizerKind: organizer.organiserKind,
    audienceKind: input.audienceKind,
    audiencePath: input.audiencePath,
  })) {
    throw new SocialError("Choose an audience for this event.");
  }
  if (organizer.organiserKind !== "COMMUNITY") {
    if (!audienceIsOnViewerPath(viewer.studentPath, input.audienceKind, input.audiencePath)) {
      throw new SocialError("You can only choose an audience on your own academic path.", 403, "forbidden");
    }
  }
  const placeId = await validatePlace(db, input.placeId);
  const coverPublicId = normalizeCover(input.coverPublicId);

  const recentCount = await db.event.count({
    where: {
      createdById: viewer.userId,
      organiserKind: organizer.organiserKind,
      ...(organizer.communityId ? { communityId: organizer.communityId } : {}),
      ...(organizer.officialAccountId ? { officialAccountId: organizer.officialAccountId } : {}),
      createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
    },
  });
  if (recentCount >= DAILY_EVENT_LIMIT) {
    throw new SocialError("You can create 3 events per day. Try again tomorrow.", 429, "rate_limited");
  }
  const upcoming = await db.event.count({
    where: {
      createdById: viewer.userId,
      status: "SCHEDULED",
      endsAt: { gt: new Date() },
    },
  });
  if (upcoming >= MAX_UPCOMING_EVENTS) {
    throw new SocialError("You already have 10 upcoming events. Cancel or finish one first.", 409, "limit_reached");
  }

  const created = await db.event.create({
    data: {
      universityId: viewer.universityId,
      createdById: viewer.userId,
      organiserKind: organizer.organiserKind,
      communityId: organizer.communityId,
      officialAccountId: organizer.officialAccountId,
      audienceKind: input.audienceKind,
      audiencePath: input.audiencePath,
      title: input.title.trim(),
      description: input.description.trim(),
      category: input.category,
      startsAt: input.startsAt,
      endsAt: input.endsAt,
      timezone: viewer.timezone,
      venueName: input.venueName.trim(),
      placeId,
      venueNote: input.venueNote?.trim().slice(0, 300) || null,
      coverPublicId,
      capacity: input.capacity ?? null,
      waitlistEnabled: Boolean(input.waitlistEnabled),
      checkInEnabled: input.checkInEnabled !== false,
      allowOutsideSharing: Boolean(input.allowOutsideSharing),
    },
    select: { id: true },
  });

  await writeAudit({
    actorId: viewer.userId,
    universityId: viewer.universityId,
    action: "event.create",
    targetType: "Event",
    targetId: created.id,
    metadata: {
      organiserKind: organizer.organiserKind,
      audienceKind: input.audienceKind,
      category: input.category,
      capacity: input.capacity ?? null,
    },
  });
  return created;
}

export interface UpdateEventInput {
  title?: string;
  description?: string;
  category?: EventCategory;
  startsAt?: Date;
  endsAt?: Date;
  venueName?: string;
  placeId?: string | null;
  venueNote?: string | null;
  coverPublicId?: string | null;
  capacity?: number | null;
  waitlistEnabled?: boolean;
  checkInEnabled?: boolean;
  allowOutsideSharing?: boolean;
}

export async function updateEvent(
  viewer: SocialViewer,
  eventId: string,
  input: UpdateEventInput,
): Promise<{ id: string }> {
  const db = tenantDb(viewer.universityId);
  const row = await db.event.findFirst({ where: { id: eventId }, select: eventSelect });
  if (!row) throw EVENT_NOT_AVAILABLE;
  const context = await loadViewerContext(viewer, [row]);
  if (!viewerCanSeeRow(viewer, row, context)) throw EVENT_NOT_AVAILABLE;
  const actor = await loadEventActorContext(db, viewer, row);
  if (!actor.permissions.canEdit && !actor.permissions.canCancel) {
    throw new SocialError("You can't edit this event.", 403, "forbidden");
  }
  const started = eventHasStarted(row);
  const ended = eventHasEnded(row);
  if (row.status !== "SCHEDULED") throw new SocialError("This event can no longer be edited.");

  if (started || ended) {
    const allowsOnlyDescription =
      actor.permissions.canEdit || viewer.isUniversityAdmin || viewer.isUniversityModerator;
    const otherFields = Object.keys(input).filter((key) => key !== "description");
    if (!allowsOnlyDescription || otherFields.length > 0) {
      throw new SocialError("This event has started. Only a description correction is allowed.", 409, "event_started");
    }
    if (input.description === undefined) throw new SocialError("Nothing to update.");
    const error = eventDescriptionError(input.description);
    if (error) throw new SocialError(error);
    const updated = await db.event.update({
      where: { id: eventId },
      data: { description: input.description.trim() },
      select: { id: true },
    });
    await writeAudit({
      actorId: viewer.userId,
      universityId: viewer.universityId,
      action: "event.edit",
      targetType: "Event",
      targetId: eventId,
      metadata: { fields: ["description"], correction: true },
    });
    return updated;
  }

  const nextTitle = input.title ?? row.title;
  const nextDescription = input.description ?? row.description;
  const nextVenue = input.venueName ?? row.venueName;
  const nextStarts = input.startsAt ?? row.startsAt;
  const nextEnds = input.endsAt ?? row.endsAt;
  const nextCapacity = input.capacity === undefined ? row.capacity : input.capacity;
  const titleError = eventTitleError(nextTitle);
  if (titleError) throw new SocialError(titleError);
  const descriptionError = eventDescriptionError(nextDescription);
  if (descriptionError) throw new SocialError(descriptionError);
  const venueError = eventVenueError(nextVenue);
  if (venueError) throw new SocialError(venueError);
  const capacityError = eventCapacityError(nextCapacity);
  if (capacityError) throw new SocialError(capacityError);
  const windowError = validateEventWindow({ startsAt: nextStarts, endsAt: nextEnds, requireFutureStart: false });
  if (windowError) throw new SocialError(windowError);
  const placeId = input.placeId === undefined ? row.placeId : await validatePlace(db, input.placeId);
  const coverPublicId = input.coverPublicId === undefined ? row.coverPublicId : normalizeCover(input.coverPublicId);

  const change = materialEventChange({
    previousStartsAt: row.startsAt,
    previousEndsAt: row.endsAt,
    previousVenueName: row.venueName,
    nextStartsAt: nextStarts,
    nextEndsAt: nextEnds,
    nextVenueName: nextVenue,
  });
  const hasRsvps = row.goingCount + row.interestedCount + row.waitlistCount > 0;
  const changes = parseMaterialChanges(row.materialChanges);
  if (change.changed && hasRsvps) {
    changes.push({
      at: new Date().toISOString(),
      fields: change.fields,
      previous: {
        startsAt: row.startsAt.toISOString(),
        endsAt: row.endsAt.toISOString(),
        venueName: row.venueName,
      },
    });
  }

  let promoted = 0;
  const updated = await withTenantTransaction(viewer.universityId, async (tx) => {
    const saved = await tx.event.update({
      where: { id: eventId },
      data: {
        title: nextTitle.trim(),
        description: nextDescription.trim(),
        category: input.category ?? row.category,
        startsAt: nextStarts,
        endsAt: nextEnds,
        venueName: nextVenue.trim(),
        placeId,
        venueNote: input.venueNote === undefined ? row.venueNote : input.venueNote?.trim().slice(0, 300) || null,
        coverPublicId,
        capacity: nextCapacity,
        waitlistEnabled: input.waitlistEnabled ?? row.waitlistEnabled,
        checkInEnabled: input.checkInEnabled ?? row.checkInEnabled,
        allowOutsideSharing: input.allowOutsideSharing ?? row.allowOutsideSharing,
        ...(change.changed && hasRsvps
          ? {
              lastMaterialChangeAt: new Date(),
              materialChanges: changes as unknown as Prisma.InputJsonValue,
            }
          : {}),
      },
      select: { id: true },
    });
    const capacityIncreased =
      nextCapacity === null ? row.capacity !== null : row.capacity !== null && nextCapacity > row.capacity;
    if (capacityIncreased) {
      while (await promoteFirstWaiter(tx, viewer.universityId, eventId, row.checkInEnabled, nextCapacity)) {
        promoted += 1;
      }
    }
    return saved;
  });
  await writeAudit({
    actorId: viewer.userId,
    universityId: viewer.universityId,
    action: "event.edit",
    targetType: "Event",
    targetId: eventId,
    metadata: {
      material: change.changed && hasRsvps,
      fields: Object.keys(input),
      promoted,
    },
  });
  return updated;
}

export async function cancelEvent(
  viewer: SocialViewer,
  eventId: string,
  reason: string,
): Promise<{ id: string }> {
  const trimmed = reason.trim();
  if (trimmed.length < 3) throw new SocialError("Tell attendees why the event is cancelled.");
  if (trimmed.length > 300) throw new SocialError("Keep the cancellation reason under 300 characters.");
  const db = tenantDb(viewer.universityId);
  const row = await db.event.findFirst({ where: { id: eventId }, select: eventSelect });
  if (!row) throw EVENT_NOT_AVAILABLE;
  const context = await loadViewerContext(viewer, [row]);
  if (!viewerCanSeeRow(viewer, row, context)) throw EVENT_NOT_AVAILABLE;
  const actor = await loadEventActorContext(db, viewer, row);
  if (!actor.permissions.canCancel) throw new SocialError("You can't cancel this event.", 403, "forbidden");
  if (row.status !== "SCHEDULED") throw new SocialError("This event is already closed.");

  await withTenantTransaction(viewer.universityId, async (tx) => {
    await tx.event.update({
      where: { id: eventId },
      data: { status: "CANCELLED", cancelReason: trimmed, cancelledAt: new Date() },
    });
    await tx.eventTicket.updateMany({
      where: { eventId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  });
  await writeAudit({
    actorId: viewer.userId,
    universityId: viewer.universityId,
    action: "event.cancel",
    targetType: "Event",
    targetId: eventId,
    metadata: { reason: trimmed },
  });
  return { id: eventId };
}

export async function removeEvent(viewer: SocialViewer, eventId: string): Promise<{ id: string }> {
  if (!viewer.isUniversityAdmin && !viewer.isUniversityModerator) {
    throw new SocialError("Only university moderators can remove events.", 403, "forbidden");
  }
  const db = tenantDb(viewer.universityId);
  const row = await db.event.findFirst({ where: { id: eventId }, select: { id: true, status: true } });
  if (!row) throw EVENT_NOT_AVAILABLE;
  if (row.status === "REMOVED") throw new SocialError("This event is already removed.");
  await withTenantTransaction(viewer.universityId, async (tx) => {
    await tx.event.update({ where: { id: eventId }, data: { status: "REMOVED" } });
    await tx.eventTicket.updateMany({ where: { eventId, revokedAt: null }, data: { revokedAt: new Date() } });
  });
  await writeAudit({
    actorId: viewer.userId,
    universityId: viewer.universityId,
    action: "event.remove",
    targetType: "Event",
    targetId: eventId,
    metadata: { previousStatus: row.status },
  });
  return { id: eventId };
}

export async function restoreEvent(viewer: SocialViewer, eventId: string): Promise<{ id: string }> {
  if (!viewer.isUniversityAdmin && !viewer.isUniversityModerator) {
    throw new SocialError("Only university moderators can restore events.", 403, "forbidden");
  }
  const db = tenantDb(viewer.universityId);
  const row = await db.event.findFirst({ where: { id: eventId }, select: { id: true, status: true } });
  if (!row) throw EVENT_NOT_AVAILABLE;
  if (row.status !== "REMOVED") throw new SocialError("This event is not removed.");
  await db.event.update({ where: { id: eventId }, data: { status: "SCHEDULED" } });
  await writeAudit({
    actorId: viewer.userId,
    universityId: viewer.universityId,
    action: "event.restore",
    targetType: "Event",
    targetId: eventId,
    metadata: {},
  });
  return { id: eventId };
}

/**
 * A bounded live check used by the "Updated" banner tests and by the detail
 * page without exposing the raw change log elsewhere.
 */
export function eventWasMateriallyUpdated(row: EventRow): boolean {
  return Boolean(row.lastMaterialChangeAt && parseMaterialChanges(row.materialChanges).length > 0);
}

export { MAX_EVENT_STAFF, MAX_EVENT_TITLE, MAX_EVENT_DESCRIPTION };

/* ------------------------------ RSVP & tickets ----------------------------- */

async function issueTicketFor(
  tx: TenantClient,
  universityId: string,
  userId: string,
  eventId: string,
): Promise<string | null> {
  const existing = await tx.eventTicket.findFirst({
    where: { eventId, userId, revokedAt: null },
    select: { id: true },
  });
  if (existing) return null;
  const code = generateTicketCode();
  try {
    await tx.eventTicket.create({
      data: { universityId, eventId, userId, codeHash: hashTicketCode(code) },
    });
    return code;
  } catch (error) {
    if ((error as { code?: string }).code === "P2002") return null;
    throw error;
  }
}

export interface RsvpResult {
  status: EventRsvpStatus;
  ticketCode: string | null;
  goingCount: number;
  interestedCount: number;
  waitlistCount: number;
  waitlistPosition: number | null;
}

async function promoteFirstWaiter(
  tx: TenantClient,
  universityId: string,
  eventId: string,
  checkInEnabled: boolean,
  capacity: number | null,
): Promise<boolean> {
  // A concurrent cancellation may have claimed the first waiter between our
  // read and update. Retry the next waiter rather than leaving the freed seat
  // empty; the seat claim below is still the final guard against overselling.
  for (;;) {
    const waiter = await tx.eventRsvp.findFirst({
      where: { eventId, status: "WAITLISTED" },
      orderBy: [{ waitlistPosition: "asc" }, { createdAt: "asc" }],
      select: { id: true, userId: true, waitlistPosition: true },
    });
    if (!waiter) return false;
    const claimed = await tx.eventRsvp.updateMany({
      where: { id: waiter.id, status: "WAITLISTED" },
      data: { status: "GOING", promotedAt: new Date(), waitlistPosition: null },
    });
    if (claimed.count !== 1) continue;

    const seat = await tx.event.updateMany({
      where: {
        id: eventId,
        status: "SCHEDULED",
        ...(capacity !== null ? { goingCount: { lt: capacity } } : {}),
      },
      data: { goingCount: { increment: 1 } },
    });
    if (seat.count !== 1) {
      await tx.eventRsvp.updateMany({
        where: { id: waiter.id, status: "GOING" },
        data: { status: "WAITLISTED", promotedAt: null, waitlistPosition: waiter.waitlistPosition },
      });
      return false;
    }
    await tx.event.updateMany({ where: { id: eventId, waitlistCount: { gt: 0 } }, data: { waitlistCount: { decrement: 1 } } });
    if (checkInEnabled) {
      await issueTicketFor(tx, universityId, waiter.userId, eventId);
    }
    return true;
  }
}

export async function rsvpEvent(
  viewer: SocialViewer,
  eventId: string,
  target: "GOING" | "INTERESTED",
): Promise<RsvpResult> {
  const limit = await rateLimit("eventRsvp", viewer.userId);
  if (!limit.success) throw new SocialError("You're RSVPing very quickly. Try again in a minute.", 429, "rate_limited");
  const db = tenantDb(viewer.universityId);
  const row = await db.event.findFirst({ where: { id: eventId }, select: eventSelect });
  if (!row) throw EVENT_NOT_AVAILABLE;
  const context = await loadViewerContext(viewer, [row]);
  if (!viewerCanSeeRow(viewer, row, context)) throw EVENT_NOT_AVAILABLE;
  if (!rsvpIsOpen(row)) throw new SocialError("RSVPs for this event are closed.", 409, "rsvp_closed");

  const result = await withTenantTransaction(viewer.universityId, async (tx) => {
    const existing = await tx.eventRsvp.findUnique({
      where: { eventId_userId: { eventId, userId: viewer.userId } },
      select: { id: true, status: true, showPublicly: true, waitlistPosition: true },
    });
    const current = existing?.status as EventRsvpStatus | undefined;

    if (target === "INTERESTED") {
      if (current === "INTERESTED") {
        return { status: "INTERESTED" as EventRsvpStatus, ticketCode: null, releasedGoing: false };
      }
      if (current === "GOING") {
        await tx.event.updateMany({ where: { id: eventId, goingCount: { gt: 0 } }, data: { goingCount: { decrement: 1 } } });
        await tx.eventTicket.updateMany({ where: { eventId, userId: viewer.userId, revokedAt: null }, data: { revokedAt: new Date() } });
        // Changing your mind frees a seat exactly like cancelling does.
        await promoteFirstWaiter(tx, viewer.universityId, eventId, row.checkInEnabled, row.capacity);
      } else if (current === "WAITLISTED") {
        await tx.event.updateMany({ where: { id: eventId, waitlistCount: { gt: 0 } }, data: { waitlistCount: { decrement: 1 } } });
      }
      await tx.event.updateMany({ where: { id: eventId }, data: { interestedCount: { increment: 1 } } });
      await tx.eventRsvp.upsert({
        where: { eventId_userId: { eventId, userId: viewer.userId } },
        create: {
          universityId: viewer.universityId,
          eventId,
          userId: viewer.userId,
          status: "INTERESTED",
          showPublicly: viewer.showEventAttendance,
        },
        update: { status: "INTERESTED", waitlistPosition: null, cancelledAt: null },
      });
      return { status: "INTERESTED" as EventRsvpStatus, ticketCode: null, releasedGoing: current === "GOING" };
    }

    if (current === "GOING") {
      return { status: "GOING" as EventRsvpStatus, ticketCode: null, releasedGoing: false };
    }

    // Try to claim a going slot atomically. The conditional update is the only
    // place capacity is enforced, so concurrent RSVPs cannot overfill the event.
    let newStatus: EventRsvpStatus = "GOING";
    let waitlistPosition: number | null = null;
    const claimed = await tx.event.updateMany({
      where: {
        id: eventId,
        status: "SCHEDULED",
        ...(row.capacity !== null ? { goingCount: { lt: row.capacity } } : {}),
      },
      data: { goingCount: { increment: 1 } },
    });
    if (claimed.count === 0) {
      const outcome = goingOutcome({
        capacity: row.capacity,
        goingCount: row.capacity ?? 0,
        waitlistEnabled: row.waitlistEnabled,
      });
      if (outcome === "WAITLISTED") {
        newStatus = "WAITLISTED";
        const updated = await tx.event.update({
          where: { id: eventId },
          data: { waitlistCount: { increment: 1 } },
          select: { waitlistCount: true },
        });
        waitlistPosition = updated.waitlistCount;
      } else {
        throw new SocialError("This event is full.", 409, "event_full");
      }
    }

    if (newStatus === "GOING") {
      if (current === "INTERESTED") {
        await tx.event.updateMany({ where: { id: eventId, interestedCount: { gt: 0 } }, data: { interestedCount: { decrement: 1 } } });
      } else if (current === "WAITLISTED") {
        await tx.event.updateMany({ where: { id: eventId, waitlistCount: { gt: 0 } }, data: { waitlistCount: { decrement: 1 } } });
      }
    }

    await tx.eventRsvp.upsert({
      where: { eventId_userId: { eventId, userId: viewer.userId } },
      create: {
        universityId: viewer.universityId,
        eventId,
        userId: viewer.userId,
        status: newStatus,
        showPublicly: viewer.showEventAttendance,
        waitlistPosition,
      },
      update: {
        status: newStatus,
        waitlistPosition,
        cancelledAt: null,
        promotedAt: null,
      },
    });

    let ticketCode: string | null = null;
    if (newStatus === "GOING" && row.checkInEnabled) {
      ticketCode = await issueTicketFor(tx, viewer.universityId, viewer.userId, eventId);
    }
    return { status: newStatus, ticketCode, releasedGoing: false };
  });

  await writeAudit({
    actorId: viewer.userId,
    universityId: viewer.universityId,
    action: `event.rsvp.${result.status.toLocaleLowerCase("en")}`,
    targetType: "Event",
    targetId: eventId,
    metadata: { previous: null },
  });
  const counts = await db.event.findFirst({
    where: { id: eventId },
    select: { goingCount: true, interestedCount: true, waitlistCount: true },
  });
  return {
    status: result.status,
    ticketCode: result.ticketCode,
    goingCount: counts?.goingCount ?? 0,
    interestedCount: counts?.interestedCount ?? 0,
    waitlistCount: counts?.waitlistCount ?? 0,
    waitlistPosition: null,
  };
}

export async function cancelRsvp(viewer: SocialViewer, eventId: string): Promise<{ status: "CANCELLED" }> {
  const db = tenantDb(viewer.universityId);
  const row = await db.event.findFirst({ where: { id: eventId }, select: eventSelect });
  if (!row) throw EVENT_NOT_AVAILABLE;
  const context = await loadViewerContext(viewer, [row]);
  if (!viewerCanSeeRow(viewer, row, context)) throw EVENT_NOT_AVAILABLE;
  if (eventHasEnded(row)) throw new SocialError("This event has ended.", 409, "event_ended");

  await withTenantTransaction(viewer.universityId, async (tx) => {
    const existing = await tx.eventRsvp.findUnique({
      where: { eventId_userId: { eventId, userId: viewer.userId } },
      select: { status: true },
    });
    if (!existing || existing.status === "CANCELLED") return;
    const previous = existing.status as EventRsvpStatus;
    if (previous === "GOING") {
      await tx.event.updateMany({ where: { id: eventId, goingCount: { gt: 0 } }, data: { goingCount: { decrement: 1 } } });
      await tx.eventTicket.updateMany({ where: { eventId, userId: viewer.userId, revokedAt: null }, data: { revokedAt: new Date() } });
    } else if (previous === "INTERESTED") {
      await tx.event.updateMany({ where: { id: eventId, interestedCount: { gt: 0 } }, data: { interestedCount: { decrement: 1 } } });
    } else if (previous === "WAITLISTED") {
      await tx.event.updateMany({ where: { id: eventId, waitlistCount: { gt: 0 } }, data: { waitlistCount: { decrement: 1 } } });
    }
    await tx.eventRsvp.update({
      where: { eventId_userId: { eventId, userId: viewer.userId } },
      data: { status: "CANCELLED", cancelledAt: new Date(), waitlistPosition: null },
    });

    if (previous !== "GOING") return;
    // Exactly one waiter is promoted per freed slot. The conditional update is
    // the claim; a concurrent cancellation promotes a different waiter.
    await promoteFirstWaiter(tx, viewer.universityId, eventId, row.checkInEnabled, row.capacity);
  });
  await writeAudit({
    actorId: viewer.userId,
    universityId: viewer.universityId,
    action: "event.rsvp.cancelled",
    targetType: "Event",
    targetId: eventId,
    metadata: {},
  });
  return { status: "CANCELLED" };
}

export interface TicketMeta {
  event: SerializedEvent;
  status: EventRsvpStatus | null;
  hasTicket: boolean;
  checkInOpen: boolean;
}

export async function getTicketMeta(viewer: SocialViewer, eventId: string): Promise<TicketMeta> {
  const detail = await getEventDetail(viewer, eventId, { recordView: false });
  return {
    event: detail.event,
    status: detail.viewer.status,
    hasTicket: detail.viewer.hasTicket,
    checkInOpen: detail.checkInOpen,
  };
}

/**
 * The raw ticket code is not stored, so a student who loses the code on their
 * device gets a fresh opaque ticket; the previous one is revoked first.
 */
export async function regenerateTicket(viewer: SocialViewer, eventId: string): Promise<{ code: string }> {
  const db = tenantDb(viewer.universityId);
  const row = await db.event.findFirst({ where: { id: eventId }, select: eventSelect });
  if (!row) throw EVENT_NOT_AVAILABLE;
  const context = await loadViewerContext(viewer, [row]);
  if (!viewerCanSeeRow(viewer, row, context)) throw EVENT_NOT_AVAILABLE;
  if (!row.checkInEnabled) throw new SocialError("This event does not use tickets.", 409, "no_tickets");
  const rsvp = await db.eventRsvp.findUnique({
    where: { eventId_userId: { eventId, userId: viewer.userId } },
    select: { status: true },
  });
  if (rsvp?.status !== "GOING") throw new SocialError("RSVP as Going first.", 409, "not_going");
  if (row.status !== "SCHEDULED" || eventHasEnded(row)) throw new SocialError("This event is closed.", 409, "event_closed");
  const limit = await rateLimit("eventTicketRegenerate", viewer.userId);
  if (!limit.success) throw new SocialError("You've regenerated this ticket too many times today.", 429, "rate_limited");
  let code = generateTicketCode();
  let stored = false;
  // Two devices regenerating at once both revoke the active ticket. The
  // partial unique index lets only one insert win; the loser retries, revoking
  // the winner's row, so exactly one active ticket remains.
  for (let attempt = 0; attempt < 3 && !stored; attempt += 1) {
    if (attempt > 0) code = generateTicketCode();
    try {
      await withTenantTransaction(viewer.universityId, async (tx) => {
        await tx.eventTicket.updateMany({
          where: { eventId, userId: viewer.userId, revokedAt: null },
          data: { revokedAt: new Date() },
        });
        await tx.eventTicket.create({
          data: { universityId: viewer.universityId, eventId, userId: viewer.userId, codeHash: hashTicketCode(code) },
        });
      });
      stored = true;
    } catch (error) {
      if ((error as { code?: string }).code !== "P2002") throw error;
    }
  }
  if (!stored) throw new SocialError("Couldn't generate a ticket. Try again.", 409, "ticket_race");
  await writeAudit({
    actorId: viewer.userId,
    universityId: viewer.universityId,
    action: "event.ticket.regenerate",
    targetType: "Event",
    targetId: eventId,
    metadata: {},
  });
  return { code };
}

export async function setShowEventAttendance(viewer: SocialViewer, show: boolean): Promise<{ show: boolean }> {
  const db = tenantDb(viewer.universityId);
  await withTenantTransaction(viewer.universityId, async (tx) => {
    await tx.user.update({ where: { id: viewer.userId }, data: { showEventAttendance: show } });
    await tx.eventRsvp.updateMany({
      where: { userId: viewer.userId, status: { in: ["GOING", "INTERESTED", "WAITLISTED"] } },
      data: { showPublicly: show },
    });
  });
  return { show };
}

/* -------------------------------- check-in -------------------------------- */

export interface CheckInResult {
  duplicate: boolean;
  checkedInAt: string;
  method: "QR" | "MANUAL";
  attendee: {
    id: string;
    username: string;
    fullName: string;
    photoUrl: string | null;
    department: string | null;
    level: number | null;
  };
}

async function attendeeSummary(db: TenantClient, userId: string) {
  const user = await db.user.findFirst({
    where: { id: userId },
    select: {
      id: true,
      username: true,
      fullName: true,
      photoUrl: true,
      level: true,
      department: { select: { name: true } },
    },
  });
  if (!user) throw new SocialError("That student isn't available.", 404, "not_available");
  return {
    id: user.id,
    username: user.username,
    fullName: user.fullName,
    photoUrl: user.photoUrl,
    department: user.department?.name ?? null,
    level: user.level,
  };
}

export async function checkInAttendee(
  viewer: SocialViewer,
  eventId: string,
  input: {
    code?: string | null;
    userId?: string | null;
    clientScanId: string;
    method: "QR" | "MANUAL";
    deviceLabel?: string | null;
  },
): Promise<CheckInResult> {
  const db = tenantDb(viewer.universityId);
  const row = await db.event.findFirst({ where: { id: eventId }, select: eventSelect });
  if (!row) throw EVENT_NOT_AVAILABLE;
  const context = await loadViewerContext(viewer, [row]);
  if (!viewerCanSeeRow(viewer, row, context)) throw EVENT_NOT_AVAILABLE;
  const actor = await loadEventActorContext(db, viewer, row);
  if (!actor.permissions.canCheckIn) throw new SocialError("You can't check students in for this event.", 403, "forbidden");
  const window = checkInWindow(row);
  if (!window.open) throw new SocialError("Check-in opens 2 hours before the event starts.", 409, "checkin_closed");
  if (row.status !== "SCHEDULED") throw new SocialError("This event is closed.", 409, "event_closed");
  const clientScanId = input.clientScanId.trim().slice(0, 100);
  if (clientScanId.length < 8) throw new SocialError("Missing scan id. Refresh and try again.");
  const deviceLabel = input.deviceLabel?.trim().slice(0, 40) || null;
  const limit = await rateLimit("eventCheckIn", `${viewer.userId}:${deviceLabel ?? "default"}`);
  if (!limit.success) throw new SocialError("This device has scanned too many tickets. Try again later.", 429, "rate_limited");

  let attendeeId: string;
  if (input.method === "QR") {
    const code = typeof input.code === "string" ? input.code.trim() : "";
    if (!code) throw new SocialError("Enter or scan a ticket code.");
    const ticket = await db.eventTicket.findFirst({
      where: { eventId, codeHash: hashTicketCode(code), revokedAt: null },
      select: { userId: true, codeHash: true },
    });
    if (!ticket || !ticketCodeMatches(code, ticket.codeHash)) {
      throw new SocialError("That ticket isn't valid for this event.", 404, "invalid_ticket");
    }
    attendeeId = ticket.userId;
  } else {
    if (!input.userId) throw new SocialError("Choose a student to check in.");
    attendeeId = input.userId;
  }

  const rsvp = await db.eventRsvp.findUnique({
    where: { eventId_userId: { eventId, userId: attendeeId } },
    select: { status: true },
  });
  if (rsvp?.status !== "GOING") throw new SocialError("That student isn't going to this event.", 409, "not_going");
  const attendee = await attendeeSummary(db, attendeeId);

  const result = await withTenantTransaction(viewer.universityId, async (tx) => {
    const replay = await tx.eventCheckIn.findUnique({
      where: { eventId_clientScanId: { eventId, clientScanId } },
      select: { scannedAt: true, method: true, userId: true },
    });
    if (replay) {
      return { duplicate: true, checkedInAt: replay.scannedAt, method: replay.method as "QR" | "MANUAL" };
    }
    try {
      const created = await tx.eventCheckIn.create({
        data: {
          universityId: viewer.universityId,
          eventId,
          userId: attendeeId,
          scannedById: viewer.userId,
          method: input.method,
          clientScanId,
          deviceLabel,
        },
        select: { scannedAt: true },
      });
      await tx.event.update({ where: { id: eventId }, data: { checkedInCount: { increment: 1 } } });
      return { duplicate: false, checkedInAt: created.scannedAt, method: input.method };
    } catch (error) {
      if ((error as { code?: string }).code !== "P2002") throw error;
      const byUser = await tx.eventCheckIn.findUnique({
        where: { eventId_userId: { eventId, userId: attendeeId } },
        select: { scannedAt: true, method: true },
      });
      if (!byUser) throw error;
      return { duplicate: true, checkedInAt: byUser.scannedAt, method: byUser.method as "QR" | "MANUAL" };
    }
  });

  if (!result.duplicate) {
    await writeAudit({
      actorId: viewer.userId,
      universityId: viewer.universityId,
      action: "event.checkin",
      targetType: "Event",
      targetId: eventId,
      metadata: { method: input.method, device: deviceLabel },
    });
  }
  return {
    duplicate: result.duplicate,
    checkedInAt: result.checkedInAt.toISOString(),
    method: result.method,
    attendee,
  };
}

export async function searchCheckInCandidates(
  viewer: SocialViewer,
  eventId: string,
  query: string,
): Promise<Array<{ id: string; username: string; fullName: string; photoUrl: string | null; level: number | null; department: string | null; checkedInAt: string | null }>> {
  const q = query.trim();
  if (q.length < 2) return [];
  const db = tenantDb(viewer.universityId);
  const row = await db.event.findFirst({ where: { id: eventId }, select: eventSelect });
  if (!row) throw EVENT_NOT_AVAILABLE;
  const context = await loadViewerContext(viewer, [row]);
  if (!viewerCanSeeRow(viewer, row, context)) throw EVENT_NOT_AVAILABLE;
  const actor = await loadEventActorContext(db, viewer, row);
  if (!actor.permissions.canCheckIn) throw new SocialError("You can't check students in for this event.", 403, "forbidden");
  const rows = await db.eventRsvp.findMany({
    where: {
      eventId,
      status: "GOING",
      user: {
        OR: [
          { fullName: { contains: q, mode: "insensitive" } },
          { username: { contains: q, mode: "insensitive" } },
        ],
      },
    },
    take: 10,
    select: {
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
  const checkIns = await db.eventCheckIn.findMany({
    where: { eventId, userId: { in: rows.map((entry) => entry.user.id) } },
    select: { userId: true, scannedAt: true },
  });
  const checked = new Map(checkIns.map((entry) => [entry.userId, entry.scannedAt]));
  return rows.map((entry) => ({
    id: entry.user.id,
    username: entry.user.username,
    fullName: entry.user.fullName,
    photoUrl: entry.user.photoUrl,
    level: entry.user.level,
    department: entry.user.department?.name ?? null,
    checkedInAt: checked.get(entry.user.id)?.toISOString() ?? null,
  }));
}

/* ------------------------------ attendee lists ----------------------------- */

export interface AttendeeRow {
  userId: string;
  username: string;
  fullName: string;
  photoUrl: string | null;
  department: string | null;
  level: number | null;
  status: EventRsvpStatus;
  checkedInAt: string | null;
  showPublicly: boolean;
}

export async function listAttendees(
  viewer: SocialViewer,
  eventId: string,
  options: { q?: string; status?: EventRsvpStatus | "ALL" } = {},
): Promise<{ attendees: AttendeeRow[]; total: number }> {
  const db = tenantDb(viewer.universityId);
  const row = await db.event.findFirst({ where: { id: eventId }, select: eventSelect });
  if (!row) throw EVENT_NOT_AVAILABLE;
  const context = await loadViewerContext(viewer, [row]);
  if (!viewerCanSeeRow(viewer, row, context)) throw EVENT_NOT_AVAILABLE;
  const actor = await loadEventActorContext(db, viewer, row);
  if (!actor.permissions.canViewAttendees) {
    throw new SocialError("Only the organiser and event staff can see the attendee list.", 403, "forbidden");
  }
  const q = options.q?.trim() ?? "";
  const status = options.status && options.status !== "ALL" ? options.status : null;
  const where: Prisma.EventRsvpWhereInput = {
    eventId,
    ...(status ? { status } : { status: { not: "CANCELLED" } }),
    ...(q.length >= 2
      ? {
          user: {
            OR: [
              { fullName: { contains: q, mode: "insensitive" } },
              { username: { contains: q, mode: "insensitive" } },
            ],
          },
        }
      : {}),
  };
  const [rows, total] = await Promise.all([
    db.eventRsvp.findMany({
      where,
      orderBy: [{ status: "asc" }, { createdAt: "asc" }],
      take: 200,
      select: {
        status: true,
        showPublicly: true,
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
    }),
    db.eventRsvp.count({ where }),
  ]);
  const checkIns = await db.eventCheckIn.findMany({
    where: { eventId, userId: { in: rows.map((entry) => entry.user.id) } },
    select: { userId: true, scannedAt: true },
  });
  const checked = new Map(checkIns.map((entry) => [entry.userId, entry.scannedAt]));
  return {
    total,
    attendees: rows.map((entry) => ({
      userId: entry.user.id,
      username: entry.user.username,
      fullName: entry.user.fullName,
      photoUrl: entry.user.photoUrl,
      department: entry.user.department?.name ?? null,
      level: entry.user.level,
      status: entry.status as EventRsvpStatus,
      checkedInAt: checked.get(entry.user.id)?.toISOString() ?? null,
      showPublicly: entry.showPublicly,
    })),
  };
}

function csvCell(value: string): string {
  const safe = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  return `"${safe.replace(/"/g, '""')}"`;
}

export async function exportAttendeesCsv(
  viewer: SocialViewer,
  eventId: string,
): Promise<{ filename: string; csv: string }> {
  const db = tenantDb(viewer.universityId);
  const row = await db.event.findFirst({ where: { id: eventId }, select: eventSelect });
  if (!row) throw EVENT_NOT_AVAILABLE;
  const context = await loadViewerContext(viewer, [row]);
  if (!viewerCanSeeRow(viewer, row, context)) throw EVENT_NOT_AVAILABLE;
  const actor = await loadEventActorContext(db, viewer, row);
  if (!actor.permissions.canExportAttendees) {
    throw new SocialError("Only the organiser and host staff can export the attendee list.", 403, "forbidden");
  }
  const limit = await rateLimit("eventCsvExport", viewer.userId);
  if (!limit.success) throw new SocialError("You've reached today's export limit.", 429, "rate_limited");
  const { attendees } = await listAttendees(viewer, eventId, { status: "ALL" });
  const header = ["Name", "Username", "Department", "Level", "RSVP", "Checked in at"];
  const lines = [header.map(csvCell).join(",")];
  for (const attendee of attendees) {
    lines.push(
      [
        attendee.fullName,
        attendee.username,
        attendee.department ?? "",
        attendee.level ? String(attendee.level) : "",
        attendee.status,
        attendee.checkedInAt ?? "",
      ].map(csvCell).join(","),
    );
  }
  await writeAudit({
    actorId: viewer.userId,
    universityId: viewer.universityId,
    action: "event.attendees.export",
    targetType: "Event",
    targetId: eventId,
    metadata: { rows: attendees.length },
  });
  const filename = `${row.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40) || "event"}-attendees.csv`;
  return { filename, csv: `${lines.join("\r\n")}\r\n` };
}

/* ------------------------------ organiser view ----------------------------- */

export async function getOrganiserDashboard(viewer: SocialViewer, eventId: string) {
  const db = tenantDb(viewer.universityId);
  const row = await db.event.findFirst({ where: { id: eventId }, select: eventSelect });
  if (!row) throw EVENT_NOT_AVAILABLE;
  const context = await loadViewerContext(viewer, [row]);
  if (!viewerCanSeeRow(viewer, row, context)) throw EVENT_NOT_AVAILABLE;
  const actor = await loadEventActorContext(db, viewer, row);
  if (!actor.permissions.canViewDashboard) {
    throw new SocialError("Only the organiser and event staff can open the dashboard.", 403, "forbidden");
  }
  const since = new Date(Date.now() - 13 * 24 * 60 * 60 * 1000);
  const [views, viewRows, checkInRows, attendeeRows, checkInMap] = await Promise.all([
    db.eventViewDaily.count({ where: { eventId } }),
    db.eventViewDaily.findMany({
      where: { eventId, date: { gte: new Date(since.toISOString().slice(0, 10)) } },
      select: { date: true },
    }),
    db.eventCheckIn.findMany({
      where: { eventId, scannedAt: { gte: since } },
      orderBy: { scannedAt: "asc" },
      select: { scannedAt: true },
    }),
    db.eventRsvp.findMany({
      where: { eventId, status: "GOING" },
      take: 40,
      orderBy: { createdAt: "asc" },
      select: {
        user: { select: { id: true, username: true, fullName: true, photoUrl: true, level: true, department: { select: { name: true } } } },
      },
    }),
    db.eventCheckIn.findMany({
      where: { eventId },
      select: { userId: true, scannedAt: true },
    }),
  ]);
  const checkedInByUser = new Map(checkInMap.map((entry) => [entry.userId, entry.scannedAt]));
  const viewsByDay = new Map<string, number>();
  for (const entry of viewRows) {
    const key = entry.date.toISOString().slice(0, 10);
    viewsByDay.set(key, (viewsByDay.get(key) ?? 0) + 1);
  }
  const checkInsByDay = new Map<string, number>();
  for (const entry of checkInRows) {
    const key = entry.scannedAt.toISOString().slice(0, 10);
    checkInsByDay.set(key, (checkInsByDay.get(key) ?? 0) + 1);
  }
  const checkedIn = attendeeRows.filter((entry) => checkedInByUser.has(entry.user.id)).length;
  return {
    event: serializeEvent(row),
    stats: {
      views,
      going: row.goingCount,
      interested: row.interestedCount,
      waitlisted: row.waitlistCount,
      checkedIn: row.checkedInCount,
      capacity: row.capacity,
      checkInRate: row.goingCount > 0 ? Math.round((row.checkedInCount / row.goingCount) * 100) : 0,
    },
    trend: {
      views: [...viewsByDay.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([date, value]) => ({ date, value })),
      checkIns: [...checkInsByDay.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([date, value]) => ({ date, value })),
    },
    attendees: attendeeRows.map((entry) => ({
      userId: entry.user.id,
      username: entry.user.username,
      fullName: entry.user.fullName,
      photoUrl: entry.user.photoUrl,
      department: entry.user.department?.name ?? null,
      level: entry.user.level,
      checkedInAt: checkedInByUser.get(entry.user.id)?.toISOString() ?? null,
    })),
    checkedInSample: checkedIn,
    changeLog: parseMaterialChanges(row.materialChanges),
  };
}

/* --------------------------- updates and comments -------------------------- */

export async function postEventUpdate(
  viewer: SocialViewer,
  eventId: string,
  body: string,
): Promise<{ id: string; body: string; createdAt: string }> {
  const limit = await rateLimit("eventUpdate", viewer.userId);
  if (!limit.success) throw new SocialError("You've posted a lot of updates. Try again later.", 429, "rate_limited");
  const trimmed = body.trim();
  if (trimmed.length < 1) throw new SocialError("Write an update first.");
  if (trimmed.length > 1000) throw new SocialError("Keep updates under 1,000 characters.");
  const db = tenantDb(viewer.universityId);
  const row = await db.event.findFirst({ where: { id: eventId }, select: eventSelect });
  if (!row) throw EVENT_NOT_AVAILABLE;
  const context = await loadViewerContext(viewer, [row]);
  if (!viewerCanSeeRow(viewer, row, context)) throw EVENT_NOT_AVAILABLE;
  const actor = await loadEventActorContext(db, viewer, row);
  if (!actor.permissions.canPostUpdate) throw new SocialError("Only event staff can post updates.", 403, "forbidden");
  const created = await db.eventUpdate.create({
    data: { universityId: viewer.universityId, eventId, authorId: viewer.userId, body: trimmed },
    select: { id: true, body: true, createdAt: true },
  });
  await writeAudit({
    actorId: viewer.userId,
    universityId: viewer.universityId,
    action: "event.update.post",
    targetType: "Event",
    targetId: eventId,
    metadata: {},
  });
  return { id: created.id, body: created.body, createdAt: created.createdAt.toISOString() };
}

export async function addEventComment(
  viewer: SocialViewer,
  eventId: string,
  input: { body: string; parentId?: string | null },
): Promise<{ id: string; body: string; createdAt: string }> {
  const limit = await rateLimit("eventComment", viewer.userId);
  if (!limit.success) throw new SocialError("You're commenting very quickly. Try again in a minute.", 429, "rate_limited");
  const hourly = await rateLimit("eventCommentHourly", viewer.userId);
  if (!hourly.success) throw new SocialError("You've reached today's comment limit.", 429, "rate_limited");
  const body = input.body.trim();
  if (!body) throw new SocialError("Write a comment first.");
  if (body.length > 1000) throw new SocialError("Keep comments under 1,000 characters.");
  const db = tenantDb(viewer.universityId);
  const row = await db.event.findFirst({ where: { id: eventId }, select: eventSelect });
  if (!row) throw EVENT_NOT_AVAILABLE;
  const context = await loadViewerContext(viewer, [row]);
  if (!viewerCanSeeRow(viewer, row, context)) throw EVENT_NOT_AVAILABLE;
  if (row.status === "CANCELLED") throw new SocialError("This event was cancelled.", 409, "event_cancelled");
  if (input.parentId) {
    const parent = await db.eventComment.findFirst({
      where: { id: input.parentId, eventId, parentId: null, status: "ACTIVE" },
      select: { id: true },
    });
    if (!parent) throw new SocialError("That comment isn't available.");
  }
  const created = await db.eventComment.create({
    data: {
      universityId: viewer.universityId,
      eventId,
      authorId: viewer.userId,
      parentId: input.parentId ?? null,
      body,
    },
    select: { id: true, body: true, createdAt: true },
  });
  return { id: created.id, body: created.body, createdAt: created.createdAt.toISOString() };
}

/* ----------------------------- public preview ------------------------------ */

export interface PublicEventPreview {
  title: string;
  startsAt: string;
  endsAt: string;
  venueName: string;
  universityName: string;
  timezone: string;
}

/**
 * Logged-out share previews. Only PUBLIC events with the organiser's explicit
 * sharing toggle reveal anything, and never attendees, counts or organiser
 * identity. Everything else returns null and renders the generic card.
 */
export async function getPublicEventPreview(eventId: string): Promise<PublicEventPreview | null> {
  const { platformDb } = await import("@/lib/db/platform");
  const row = await platformDb.event.findUnique({
    where: { id: eventId },
    select: {
      title: true,
      startsAt: true,
      endsAt: true,
      venueName: true,
      timezone: true,
      audienceKind: true,
      allowOutsideSharing: true,
      status: true,
      universityId: true,
    },
  });
  if (!row) return null;
  if (row.audienceKind !== "PUBLIC" || !row.allowOutsideSharing || row.status !== "SCHEDULED") return null;
  const university = await platformDb.university.findUnique({
    where: { id: row.universityId },
    select: { name: true },
  });
  if (!university) return null;
  return {
    title: row.title,
    startsAt: row.startsAt.toISOString(),
    endsAt: row.endsAt.toISOString(),
    venueName: row.venueName,
    universityName: university.name,
    timezone: row.timezone,
  };
}

/* ------------------------------- event staff ------------------------------- */

export async function listEventStaff(viewer: SocialViewer, eventId: string) {
  const db = tenantDb(viewer.universityId);
  const row = await db.event.findFirst({ where: { id: eventId }, select: eventSelect });
  if (!row) throw EVENT_NOT_AVAILABLE;
  const context = await loadViewerContext(viewer, [row]);
  if (!viewerCanSeeRow(viewer, row, context)) throw EVENT_NOT_AVAILABLE;
  const staff = await db.eventStaff.findMany({
    where: { eventId },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      role: true,
      user: { select: { id: true, username: true, fullName: true, photoUrl: true, level: true } },
    },
  });
  return staff;
}

export async function addEventStaff(
  viewer: SocialViewer,
  eventId: string,
  userId: string,
  role: "HOST" | "CHECKIN",
): Promise<{ id: string }> {
  const db = tenantDb(viewer.universityId);
  const row = await db.event.findFirst({ where: { id: eventId }, select: eventSelect });
  if (!row) throw EVENT_NOT_AVAILABLE;
  const context = await loadViewerContext(viewer, [row]);
  if (!viewerCanSeeRow(viewer, row, context)) throw EVENT_NOT_AVAILABLE;
  const actor = await loadEventActorContext(db, viewer, row);
  if (!actor.permissions.canManageStaff) throw new SocialError("Only the organiser can manage event staff.", 403, "forbidden");
  const target = await db.user.findFirst({
    where: { id: userId, status: "VERIFIED" },
    select: { id: true },
  });
  if (!target) throw new SocialError("Choose a verified student.", 404, "not_available");
  const count = await db.eventStaff.count({ where: { eventId } });
  const existing = await db.eventStaff.findUnique({
    where: { eventId_userId: { eventId, userId } },
    select: { id: true },
  });
  if (existing) {
    await db.eventStaff.update({ where: { id: existing.id }, data: { role } });
  } else {
    if (count >= MAX_EVENT_STAFF) throw new SocialError("An event can have at most 6 staff.", 409, "limit_reached");
    await db.eventStaff.create({
      data: { universityId: viewer.universityId, eventId, userId, role },
    });
  }
  await writeAudit({
    actorId: viewer.userId,
    universityId: viewer.universityId,
    action: "event.staff.add",
    targetType: "Event",
    targetId: eventId,
    metadata: { userId, role },
  });
  const saved = await db.eventStaff.findUnique({
    where: { eventId_userId: { eventId, userId } },
    select: { id: true },
  });
  if (!saved) throw new SocialError("Could not save that staff member.", 500, "save_failed");
  return saved;
}

export async function removeEventStaff(
  viewer: SocialViewer,
  eventId: string,
  userId: string,
): Promise<{ removed: true }> {
  const db = tenantDb(viewer.universityId);
  const row = await db.event.findFirst({ where: { id: eventId }, select: eventSelect });
  if (!row) throw EVENT_NOT_AVAILABLE;
  const context = await loadViewerContext(viewer, [row]);
  if (!viewerCanSeeRow(viewer, row, context)) throw EVENT_NOT_AVAILABLE;
  const actor = await loadEventActorContext(db, viewer, row);
  if (!actor.permissions.canManageStaff) throw new SocialError("Only the organiser can manage event staff.", 403, "forbidden");
  const existing = await db.eventStaff.findUnique({
    where: { eventId_userId: { eventId, userId } },
    select: { id: true },
  });
  if (!existing) throw new SocialError("That staff member wasn't found.", 404, "not_available");
  await db.eventStaff.delete({ where: { id: existing.id } });
  await writeAudit({
    actorId: viewer.userId,
    universityId: viewer.universityId,
    action: "event.staff.remove",
    targetType: "Event",
    targetId: eventId,
    metadata: { userId },
  });
  return { removed: true };
}

export async function searchEventStaffCandidates(viewer: SocialViewer, eventId: string, query: string) {
  const db = tenantDb(viewer.universityId);
  const row = await db.event.findFirst({ where: { id: eventId }, select: eventSelect });
  if (!row) throw EVENT_NOT_AVAILABLE;
  const context = await loadViewerContext(viewer, [row]);
  if (!viewerCanSeeRow(viewer, row, context)) throw EVENT_NOT_AVAILABLE;
  const actor = await loadEventActorContext(db, viewer, row);
  if (!actor.permissions.canManageStaff) throw new SocialError("Only the organiser can manage event staff.", 403, "forbidden");
  const q = query.trim();
  if (q.length < 2) return [];
  return db.user.findMany({
    where: {
      status: "VERIFIED",
      NOT: { id: viewer.userId },
      OR: [
        { fullName: { contains: q, mode: "insensitive" } },
        { username: { contains: q, mode: "insensitive" } },
      ],
    },
    take: 10,
    select: { id: true, username: true, fullName: true, photoUrl: true, level: true },
  });
}
