import { canSee, type StudentPath } from "./academic";
import {
  canViewCommunityContent,
  type CommunityAccess,
  type CommunityRole,
} from "./community";

/**
 * Phase 3 event rules, kept pure so the same decision is used by feeds, the
 * detail page, share cards, .ics downloads, attendee lists and every service
 * mutation. Nothing here imports Prisma or a request object.
 */

export type EventCategory =
  | "TECH"
  | "ACADEMIC"
  | "DEPARTMENTAL"
  | "PARTY"
  | "COMPETITION"
  | "SPORTS"
  | "SEMINAR"
  | "RELIGIOUS"
  | "CULTURAL"
  | "MEETUP"
  | "OTHER";

export type EventAudienceKind =
  | "PUBLIC"
  | "COLLEGE"
  | "FACULTY"
  | "DEPARTMENT"
  | "LEVEL"
  | "COMMUNITY";

export type EventStatus = "SCHEDULED" | "CANCELLED" | "REMOVED";
export type EventOrganiserKind = "USER" | "COMMUNITY" | "OFFICIAL";
export type EventRsvpStatus = "GOING" | "INTERESTED" | "WAITLISTED" | "CANCELLED";
export type EventStaffRole = "HOST" | "CHECKIN";

export const EVENT_CATEGORIES: ReadonlyArray<{ value: EventCategory; label: string }> = [
  { value: "TECH", label: "Tech" },
  { value: "ACADEMIC", label: "Academic" },
  { value: "DEPARTMENTAL", label: "Departmental" },
  { value: "PARTY", label: "Party" },
  { value: "COMPETITION", label: "Competition" },
  { value: "SPORTS", label: "Sports" },
  { value: "SEMINAR", label: "Seminar" },
  { value: "RELIGIOUS", label: "Religious" },
  { value: "CULTURAL", label: "Cultural" },
  { value: "MEETUP", label: "Meetup" },
  { value: "OTHER", label: "Other" },
];

export const EVENT_CATEGORY_LABELS: Record<EventCategory, string> = Object.fromEntries(
  EVENT_CATEGORIES.map((entry) => [entry.value, entry.label]),
) as Record<EventCategory, string>;

export const EVENT_STATUS_LABELS: Record<EventStatus, string> = {
  SCHEDULED: "Scheduled",
  CANCELLED: "Cancelled",
  REMOVED: "Removed",
};

export const EVENT_RSVP_LABELS: Record<EventRsvpStatus, string> = {
  GOING: "Going",
  INTERESTED: "Interested",
  WAITLISTED: "Waitlisted",
  CANCELLED: "Not going",
};

export const MIN_EVENT_TITLE = 3;
export const MAX_EVENT_TITLE = 100;
export const MAX_EVENT_DESCRIPTION = 3000;
export const MIN_EVENT_DESCRIPTION = 1;
export const MAX_EVENT_VENUE = 120;
export const MAX_EVENT_NOTE = 300;
export const MAX_EVENT_DURATION_DAYS = 14;
export const MAX_EVENT_CAPACITY = 5000;
export const MAX_EVENT_STAFF = 6;
export const CHECKIN_OPENS_BEFORE_MS = 2 * 60 * 60 * 1000;
export const CREATION_MIN_ACCOUNT_AGE_HOURS = 24;
export const DAILY_EVENT_LIMIT = 3;
export const MAX_UPCOMING_EVENTS = 10;
export const EVENT_PAGE_SIZE = 12;
export const MAX_EVENT_UPDATES = 50;
export const MAX_EVENT_COMMENT_LENGTH = 1000;

/** Category accent used by the clay default cover (a token-friendly hex). */
export const EVENT_CATEGORY_COLORS: Record<EventCategory, string> = {
  TECH: "#4F46E5",
  ACADEMIC: "#0F766E",
  DEPARTMENTAL: "#B45309",
  PARTY: "#BE185D",
  COMPETITION: "#7C3AED",
  SPORTS: "#15803D",
  SEMINAR: "#0369A1",
  RELIGIOUS: "#6D28D9",
  CULTURAL: "#C2410C",
  MEETUP: "#0E7490",
  OTHER: "#475569",
};

export function isEventCategory(value: unknown): value is EventCategory {
  return typeof value === "string" && EVENT_CATEGORIES.some((entry) => entry.value === value);
}

export function eventCategoryLabel(value: EventCategory | string): string {
  return EVENT_CATEGORY_LABELS[value as EventCategory] ?? "Other";
}

export function eventStatusLabel(value: EventStatus | string): string {
  return EVENT_STATUS_LABELS[value as EventStatus] ?? String(value);
}

export interface EventAudienceShape {
  audienceKind: EventAudienceKind;
  audiencePath: readonly (string | number)[];
  communityId?: string | null;
  organiserKind?: EventOrganiserKind;
  createdById?: string;
  status?: EventStatus;
}

/**
 * Academic and public event visibility. COMMUNITY events are never authorized
 * here; canSeeEventInCommunity is the only rule for them.
 */
export function canSeeEvent(viewerPath: StudentPath, event: EventAudienceShape): boolean {
  if (event.status === "REMOVED") return false;
  if (event.audienceKind === "COMMUNITY") return false;
  if (event.communityId) return false;
  if (event.audienceKind === "PUBLIC") {
    return event.audiencePath.length === 1 && event.audiencePath[0] === "PUBLIC";
  }
  if (event.audiencePath.length === 0) return false;
  if (event.audiencePath.length === 1 && event.audiencePath[0] === "PUBLIC") return false;
  return canSee(viewerPath, event.audiencePath);
}

export function canSeeEventInCommunity(
  viewerPath: StudentPath,
  event: EventAudienceShape,
  access: CommunityAccess | null | undefined,
): boolean {
  if (event.audienceKind !== "COMMUNITY") return canSeeEvent(viewerPath, event);
  if (event.status === "REMOVED") return false;
  if (!event.communityId || !access || access.communityId !== event.communityId) return false;
  return canViewCommunityContent(access);
}

/**
 * Prisma filter for academic/public events this viewer may see. Community
 * events are added separately from readable community ids.
 */
export function visibleEventAudienceFilter(viewerPath: StudentPath): {
  communityId: null;
  OR: Array<{ audienceKind: "PUBLIC" } | { audiencePath: { equals: string[] } }>;
} {
  const paths: string[][] = [["PUBLIC"]];
  for (let length = 2; length <= viewerPath.length; length += 1) {
    paths.push(viewerPath.slice(0, length).map(String));
  }
  return {
    communityId: null,
    OR: paths.map((path) =>
      path.length === 1 && path[0] === "PUBLIC"
        ? { audienceKind: "PUBLIC" as const }
        : { audiencePath: { equals: path } },
    ),
  };
}

/** A community organiser always uses COMMUNITY audience; nobody else may. */
export function organizerAudienceIsValid(input: {
  organizerKind: EventOrganiserKind;
  audienceKind: EventAudienceKind;
  audiencePath: readonly (string | number)[];
}): boolean {
  if (input.organizerKind === "COMMUNITY") {
    return input.audienceKind === "COMMUNITY" && input.audiencePath.length === 0;
  }
  return input.audienceKind !== "COMMUNITY" && input.audiencePath.length > 0;
}

/**
 * The author may only pick audiences along their own path. A level audience is
 * exactly the viewer's own path; narrower layers are real prefixes.
 */
export function audienceIsOnViewerPath(
  viewerPath: StudentPath,
  audienceKind: EventAudienceKind,
  audiencePath: readonly (string | number)[],
): boolean {
  if (audienceKind === "COMMUNITY") return false;
  if (audienceKind === "PUBLIC") {
    return audiencePath.length === 1 && audiencePath[0] === "PUBLIC";
  }
  if (audiencePath.length < 2) return false;
  if (audiencePath.length > viewerPath.length) return false;
  if (audiencePath.length === 1 && audiencePath[0] === "PUBLIC") return false;
  if (!canSee(viewerPath, audiencePath)) return false;
  if (audienceKind === "LEVEL") return audiencePath.length === viewerPath.length;
  // A non-level layer must be narrower than the viewer's own level segment.
  return audiencePath.length < viewerPath.length;
}

/** Same targeting rule for announcements (committees target their own path). */
export function announcementAudienceIsAllowed(input: {
  isUniversityAdmin: boolean;
  viewerPath: StudentPath;
  audienceKind: EventAudienceKind;
  audiencePath: readonly (string | number)[];
}): boolean {
  if (input.audienceKind === "COMMUNITY") return false;
  if (input.isUniversityAdmin) {
    if (input.audienceKind === "PUBLIC") {
      return input.audiencePath.length === 1 && input.audiencePath[0] === "PUBLIC";
    }
    return input.audiencePath.length >= 2 && announcementPathIsInUniversity(input.viewerPath, input.audiencePath);
  }
  return audienceIsOnViewerPath(input.viewerPath, input.audienceKind, input.audiencePath);
}

function announcementPathIsInUniversity(
  viewerPath: StudentPath,
  audiencePath: readonly (string | number)[],
): boolean {
  if (audiencePath.length === 0) return false;
  return String(audiencePath[0]) === String(viewerPath[0]);
}

export function eventAudienceLabel(
  kind: EventAudienceKind,
  labels: { college?: string; faculty?: string; department?: string } = {},
  names: { college?: string | null; faculty?: string | null; department?: string | null } = {},
): string {
  switch (kind) {
    case "PUBLIC":
      return "Everyone at my university";
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
    case "COMMUNITY":
      return "Community members";
  }
}

export interface EventPermissionActor {
  userId: string;
  isUniversityAdmin: boolean;
  isUniversityModerator: boolean;
  communityRole?: CommunityRole | null;
  communityMemberStatus?: string | null;
  communityMuted?: boolean;
  communityAllowMemberEvents?: boolean;
  officialStaff?: { canPublishCritical: boolean } | null;
  staffRole?: EventStaffRole | null;
}

export interface EventPermissionEvent {
  organiserKind: EventOrganiserKind;
  createdById: string;
  communityId?: string | null;
  officialAccountId?: string | null;
  status: EventStatus;
  startsAt: Date | string;
  endsAt: Date | string;
  checkInEnabled: boolean;
}

export interface EventPermissions {
  isOrganiser: boolean;
  isEventStaff: boolean;
  canEdit: boolean;
  canCancel: boolean;
  canRemove: boolean;
  canRestore: boolean;
  canPostUpdate: boolean;
  canManageStaff: boolean;
  canViewAttendees: boolean;
  canExportAttendees: boolean;
  canCheckIn: boolean;
  canViewDashboard: boolean;
}

/**
 * Single permission matrix. `isOrganiser` is true for the creating student, a
 * community owner/moderator (or member when member events are allowed) and an
 * official account's staff. University admins and moderators may moderate.
 */
export function eventPermissions(actor: EventPermissionActor, event: EventPermissionEvent): EventPermissions {
  const createdByActor = event.organiserKind === "USER" && event.createdById === actor.userId;
  const communityStaff =
    event.organiserKind === "COMMUNITY" &&
    (actor.communityRole === "OWNER" || actor.communityRole === "MODERATOR");
  const communityMemberOrganiser =
    event.organiserKind === "COMMUNITY" &&
    actor.communityRole === "MEMBER" &&
    actor.communityMemberStatus === "ACTIVE" &&
    actor.communityAllowMemberEvents === true &&
    event.createdById === actor.userId;
  const officialStaff = event.organiserKind === "OFFICIAL" && Boolean(actor.officialStaff);
  const isOrganiser = createdByActor || communityStaff || communityMemberOrganiser || officialStaff;
  const isHost = actor.staffRole === "HOST";
  const isCheckin = actor.staffRole === "CHECKIN";
  const isEventStaff = Boolean(actor.staffRole);
  const ended = new Date(event.endsAt).getTime() < Date.now();
  const bookable = event.status === "SCHEDULED";
  const moderate = actor.isUniversityAdmin || actor.isUniversityModerator;

  return {
    isOrganiser,
    isEventStaff,
    canEdit: bookable && (isOrganiser || isHost) && !ended,
    canCancel: bookable && (isOrganiser || isHost || moderate),
    canRemove: moderate && event.status !== "REMOVED",
    canRestore: moderate && event.status === "REMOVED",
    canPostUpdate: bookable && (isOrganiser || isHost || isCheckin),
    canManageStaff: isOrganiser && bookable,
    canViewAttendees: isOrganiser || isHost || moderate,
    canExportAttendees: (isOrganiser || isHost) && bookable,
    canCheckIn: event.checkInEnabled && bookable && !ended && (isOrganiser || isHost || isCheckin),
    canViewDashboard: isOrganiser || isHost,
  };
}

/* ------------------------------- validation ------------------------------- */

export function eventTitleError(title: string): string | null {
  const trimmed = title.trim();
  if (trimmed.length < MIN_EVENT_TITLE) return "Give your event a title of at least 3 characters.";
  if (trimmed.length > MAX_EVENT_TITLE) return "Keep the title under 100 characters.";
  return null;
}

export function eventDescriptionError(description: string): string | null {
  const trimmed = description.trim();
  if (trimmed.length < MIN_EVENT_DESCRIPTION) return "Add a description so students know what to expect.";
  if (trimmed.length > MAX_EVENT_DESCRIPTION) return "Keep the description under 3,000 characters.";
  return null;
}

export function eventVenueError(venueName: string): string | null {
  const trimmed = venueName.trim();
  if (trimmed.length < 2) return "Add a venue.";
  if (trimmed.length > MAX_EVENT_VENUE) return "Keep the venue under 120 characters.";
  return null;
}

export function eventCapacityError(capacity: number | null): string | null {
  if (capacity === null) return null;
  if (!Number.isInteger(capacity) || capacity < 1) return "Capacity must be at least 1.";
  if (capacity > MAX_EVENT_CAPACITY) return `Capacity can be at most ${MAX_EVENT_CAPACITY}.`;
  return null;
}

export function validateEventWindow(input: {
  startsAt: Date;
  endsAt: Date;
  now?: Date;
  requireFutureStart?: boolean;
}): string | null {
  const now = input.now ?? new Date();
  const starts = input.startsAt.getTime();
  const ends = input.endsAt.getTime();
  if (Number.isNaN(starts) || Number.isNaN(ends)) return "Choose a valid start and end time.";
  if (input.requireFutureStart !== false && starts <= now.getTime()) {
    return "The start time must be in the future.";
  }
  if (ends <= starts) return "The end time must be after the start time.";
  if (ends - starts > MAX_EVENT_DURATION_DAYS * 24 * 60 * 60 * 1000) {
    return "An event can last at most 14 days.";
  }
  return null;
}

export function validateEventForCreation(input: {
  title: string;
  description: string;
  venueName: string;
  startsAt: Date;
  endsAt: Date;
  capacity: number | null;
  now?: Date;
}): string | null {
  return (
    eventTitleError(input.title) ??
    eventDescriptionError(input.description) ??
    eventVenueError(input.venueName) ??
    validateEventWindow({ startsAt: input.startsAt, endsAt: input.endsAt, now: input.now }) ??
    eventCapacityError(input.capacity)
  );
}

/* --------------------------------- RSVP ---------------------------------- */

export type GoingOutcome = "GOING" | "WAITLISTED" | "FULL";

/** Pure capacity decision mirrored by the conditional SQL updates. */
export function goingOutcome(input: {
  capacity: number | null;
  goingCount: number;
  waitlistEnabled: boolean;
}): GoingOutcome {
  if (input.capacity === null) return "GOING";
  if (input.goingCount < input.capacity) return "GOING";
  return input.waitlistEnabled ? "WAITLISTED" : "FULL";
}

export function rsvpIsOpen(event: { status: EventStatus; endsAt: Date | string }, now = new Date()): boolean {
  return event.status === "SCHEDULED" && new Date(event.endsAt).getTime() > now.getTime();
}

export function checkInWindow(event: { startsAt: Date | string; endsAt: Date | string }, now = new Date()): {
  open: boolean;
  opensAt: Date;
} {
  const opensAt = new Date(new Date(event.startsAt).getTime() - CHECKIN_OPENS_BEFORE_MS);
  const closesAt = new Date(event.endsAt);
  return { open: now.getTime() >= opensAt.getTime() && now.getTime() <= closesAt.getTime(), opensAt };
}

export function nextWaitlistPosition(waitlistCount: number): number {
  return waitlistCount + 1;
}

export function capacityRemaining(capacity: number | null, goingCount: number): number | null {
  if (capacity === null) return null;
  return Math.max(0, capacity - goingCount);
}

/* ------------------------------ presentation ----------------------------- */

export function eventIsLive(
  event: { status: EventStatus; startsAt: Date | string; endsAt: Date | string },
  now = new Date(),
): boolean {
  const starts = new Date(event.startsAt).getTime();
  const ends = new Date(event.endsAt).getTime();
  const time = now.getTime();
  return event.status === "SCHEDULED" && time >= starts && time <= ends;
}

export function eventHasEnded(
  event: { startsAt: Date | string; endsAt: Date | string },
  now = new Date(),
): boolean {
  return new Date(event.endsAt).getTime() < now.getTime();
}

export function eventHasStarted(
  event: { startsAt: Date | string },
  now = new Date(),
): boolean {
  return new Date(event.startsAt).getTime() <= now.getTime();
}

/** Outside sharing requires PUBLIC audience, the explicit toggle and a live event. */
export function eventAllowsOutsideSharing(event: {
  audienceKind: EventAudienceKind;
  allowOutsideSharing: boolean;
  status: EventStatus;
}): boolean {
  return event.audienceKind === "PUBLIC" && event.allowOutsideSharing === true && event.status === "SCHEDULED";
}

/** Only time and venue are material changes that attendees must be told about. */
export function materialEventChange(input: {
  previousStartsAt: Date;
  previousEndsAt: Date;
  previousVenueName: string;
  nextStartsAt: Date;
  nextEndsAt: Date;
  nextVenueName: string;
}): { changed: boolean; fields: string[] } {
  const fields: string[] = [];
  if (input.previousStartsAt.getTime() !== input.nextStartsAt.getTime() || input.previousEndsAt.getTime() !== input.nextEndsAt.getTime()) {
    fields.push("time");
  }
  if (input.previousVenueName.trim() !== input.nextVenueName.trim()) fields.push("venue");
  return { changed: fields.length > 0, fields };
}

export function eventCategoryColor(category: EventCategory | string): string {
  return EVENT_CATEGORY_COLORS[category as EventCategory] ?? EVENT_CATEGORY_COLORS.OTHER;
}
