"use client";

/**
 * Phase 3 and Phase 4 design-showcase fixtures.
 *
 * Presentation-only: every screen renders the real product component with
 * fixture props so the visual layer can be reviewed in both themes without
 * touching services, the database or the seed. Never reachable in production
 * (`/design/preview/[screen]` 404s there).
 */
import { EventCard } from "@/components/events/event-card";
import { EventsHub } from "@/components/events/events-hub";
import { EventDetail } from "@/components/events/event-detail";
import { TicketCard } from "@/components/events/ticket-card";
import { CheckinScanner } from "@/components/events/checkin-scanner";
import { OrganiserDashboard } from "@/components/events/organiser-dashboard";
import { MyEvents } from "@/components/events/my-events";
import { OfficialChannel } from "@/components/official/official-channel";
import { AnnouncementCard } from "@/components/official/announcement-card";
import { AnnouncementDetail } from "@/components/official/announcement-detail";
import { CriticalBanner, OfficialBanner } from "@/components/official/banners";
import { PulseEventModules } from "@/components/pulse/event-modules";
import { PlacesConsole } from "@/components/admin/places-console";
import { OfficialConsole } from "@/components/admin/official-console";
import { AnnouncementConsole } from "@/components/admin/announcement-console";
import { EventModerationConsole } from "@/components/admin/event-moderation-console";
import { AdminShell } from "@/components/admin/admin-shell";
import type { EventDetailResult, SerializedEvent } from "@/lib/services/events";
import type { AnnouncementBanner, SerializedAnnouncement } from "@/lib/services/announcements";
import { GALLERY_UNIVERSITY } from "../../../fixtures/design-gallery";

type FeedItem = SerializedAnnouncement & { acknowledged: boolean };

const NOW = Date.parse("2026-11-18T10:00:00.000Z");
const HOUR = 3_600_000;
const DAY = 24 * HOUR;

const PEOPLE = [
  { id: "u1", username: "chinedu_okafor", fullName: "Chinedu Okafor", photoUrl: null },
  { id: "u2", username: "aisha_bello", fullName: "Aisha Bello", photoUrl: null },
  { id: "u3", username: "tunde_adeyemi", fullName: "Tunde Adeyemi", photoUrl: null },
  { id: "u4", username: "ngozi_eze", fullName: "Ngozi Eze", photoUrl: null },
  { id: "u5", username: "ibrahim_musa", fullName: "Ibrahim Musa", photoUrl: null },
];

function baseEvent(over: Record<string, unknown> = {}) {
  return {
    id: "evt-1",
    title: "Nova Tech Summit: Build Night",
    description: "An evening of prototypes, past-question drills and demo practice with the Software Engineering society.",
    category: "TECH",
    startsAt: new Date(NOW + 4 * DAY).toISOString(),
    endsAt: new Date(NOW + 4 * DAY + 3 * HOUR).toISOString(),
    timezone: "Africa/Lagos",
    venueName: "Central Auditorium",
    venueNote: "Gate 3, opposite the library",
    coverPublicId: null,
    coverUrl: null,
    capacity: 50,
    waitlistEnabled: true,
    checkInEnabled: true,
    allowOutsideSharing: true,
    status: "SCHEDULED",
    cancelReason: null,
    cancelledAt: null,
    lastMaterialChangeAt: null,
    materialChanges: [],
    goingCount: 34,
    interestedCount: 12,
    waitlistCount: 0,
    checkedInCount: 0,
    audienceKind: "UNIVERSITY",
    audiencePath: "nova-university",
    organiserKind: "USER",
    communityId: null,
    officialAccountId: null,
    createdById: "u2",
    createdAt: new Date(NOW - 6 * DAY).toISOString(),
    community: null,
    officialAccount: null,
    place: { id: "pl-1", name: "Central Auditorium", latitude: 6.5, longitude: 3.4 },
    organisers: PEOPLE[1]!,
    categoryColor: "#4f46e5",
    live: false,
    ended: false,
    started: false,
    capacityRemaining: 16,
    shareable: true,
    attendeePreview: PEOPLE.slice(0, 3),
    ...over,
  } as unknown as SerializedEvent;
}

const EVENTS = {
  open: baseEvent(),
  going: baseEvent({ id: "evt-going" }),
  interested: baseEvent({ id: "evt-interested" }),
  full: baseEvent({ id: "evt-full", capacity: 40, goingCount: 40, capacityRemaining: 0, waitlistCount: 9 }),
  waitlisted: baseEvent({ id: "evt-waitlist", capacity: 40, goingCount: 40, capacityRemaining: 0, waitlistCount: 9 }),
  cancelled: baseEvent({ id: "evt-cancelled", status: "CANCELLED", cancelReason: "The hall is closed for repairs.", cancelledAt: new Date(NOW - DAY).toISOString(), lastMaterialChangeAt: null }),
  updated: baseEvent({ id: "evt-updated", lastMaterialChangeAt: new Date(NOW - 2 * HOUR).toISOString(), materialChanges: [{ at: new Date(NOW - 2 * HOUR).toISOString(), fields: ["venueName"], previous: { venueName: "Old Hall" } }] }),
  ended: baseEvent({ id: "evt-ended", startsAt: new Date(NOW - 3 * DAY).toISOString(), endsAt: new Date(NOW - 3 * DAY + 2 * HOUR).toISOString(), ended: true, checkedInCount: 28, attendeePreview: [] }),
  live: baseEvent({ id: "evt-live", startsAt: new Date(NOW - HOUR).toISOString(), endsAt: new Date(NOW + 2 * HOUR).toISOString(), live: true, started: true, checkedInCount: 12 }),
};

const VIEWER_STATE = (status: string | null, hasTicket = false) => ({ status, hasTicket, staffRole: null });

function detailFor(event: unknown, over: Record<string, unknown> = {}) {
  return {
    event,
    viewer: over.viewer ?? VIEWER_STATE(null),
    permissions: {
      isOrganiser: false,
      isEventStaff: false,
      canEdit: false,
      canCancel: false,
      canRemove: false,
      canRestore: false,
      canPostUpdate: false,
      canManageStaff: false,
      canViewAttendees: false,
      canExportAttendees: false,
      canCheckIn: false,
      canComment: true,
      canReport: true,
      ...((over.permissions as object) ?? {}),
    },
    actor: { staffRole: null, officialStaff: null, communityRole: null, communityMemberStatus: null, communityMuted: false, communityAllowMemberEvents: false },
    attendees: { count: 34, preview: PEOPLE, hiddenCount: 4 },
    updates: [
      {
        id: "up-1",
        body: "Doors open at 5:30 PM. Bring your student ID for check-in.",
        createdAt: new Date(NOW - 2 * HOUR).toISOString(),
        author: PEOPLE[1]!,
      },
    ],
    comments: [
      {
        id: "c-1",
        body: "Is the hackerspace open for teams that want to keep working after the demos?",
        createdAt: new Date(NOW - 40 * 60_000).toISOString(),
        author: PEOPLE[2]!,
        replies: [
          {
            id: "c-1r",
            body: "Yes — the reading room stays open until 9 PM.",
            createdAt: new Date(NOW - 30 * 60_000).toISOString(),
            author: PEOPLE[1]!,
          },
        ],
      },
    ],
    commentCount: 2,
    changeLog: [],
    rsvpOpen: true,
    checkInOpen: false,
    checkInOpensAt: new Date(NOW + 4 * DAY - HOUR).toISOString(),
    ...(over as object),
  } as unknown as EventDetailResult;
}

const ANNOUNCEMENT = {
  id: "ann-1",
  title: "Registration for the 2026/2027 session closes Friday",
  body: "All students must complete course registration on the portal before Friday at 11:59 PM. Late registration attracts a penalty fee and may affect examination eligibility.",
  excerpt:
    "All students must complete course registration on the portal before Friday at 11:59 PM. Late registration attracts a penalty fee and may affect examination eligibility.",
  category: "ACADEMIC",
  critical: false,
  audienceKind: "ALL",
  audiencePath: null,
  status: "PUBLISHED",
  publishAt: new Date(NOW - 3 * HOUR).toISOString(),
  publishedAt: new Date(NOW - 3 * HOUR).toISOString(),
  editedAt: null,
  archivedAt: null,
  createdAt: new Date(NOW - 4 * HOUR).toISOString(),
  officialAccount: {
    id: "oa-1",
    name: "Registrar",
    slug: "registrar",
    description: "Academic notices from the Registrar's office.",
    verified: true,
  },
  attachments: [
    { id: "at-1", name: "Registration-guide.pdf", sizeBytes: 420000 },
    { id: "at-2", name: "Penalty-schedule.pdf", sizeBytes: 96000 },
  ],
  acknowledged: false,
  ackCount: 812,
} as unknown as FeedItem;

const CRITICAL = {
  ...ANNOUNCEMENT,
  id: "ann-2",
  critical: true,
  title: "Campus closed to vehicular traffic on Thursday",
  body: "The senate has approved a full campus closure on Thursday from 6 AM to 6 PM for the graduation rehearsal. Pedestrian gates remain open with your student ID.",
  excerpt:
    "The senate has approved a full campus closure on Thursday from 6 AM to 6 PM for the graduation rehearsal. Pedestrian gates remain open with your student ID.",
  publishedAt: new Date(NOW - 30 * 60_000).toISOString(),
};

const FEED: { announcements: FeedItem[]; nextCursor: string | null } = {
  announcements: [CRITICAL, ANNOUNCEMENT, { ...ANNOUNCEMENT, id: "ann-3", title: "Library extends night hours during exams", critical: false, attachments: [], editedAt: new Date(NOW - HOUR).toISOString() }],
  nextCursor: null,
};

export function Phase3Showcase({ screen }: { screen: string }) {
  if (screen === "phase3-event-cards") {
    return (
      <main className="mx-auto w-full max-w-feed space-y-3 px-4 py-4">
        <EventCard event={EVENTS.open} rsvpStatus={null} />
        <EventCard event={EVENTS.going} rsvpStatus="GOING" />
        <EventCard event={EVENTS.interested} rsvpStatus="INTERESTED" />
        <EventCard event={EVENTS.full} rsvpStatus={null} />
        <EventCard event={EVENTS.waitlisted} rsvpStatus="WAITLISTED" />
        <EventCard event={EVENTS.updated} rsvpStatus={null} />
        <EventCard event={EVENTS.cancelled} rsvpStatus="CANCELLED" />
        <EventCard event={EVENTS.ended} rsvpStatus="GOING" />
        <EventCard event={EVENTS.live} rsvpStatus={null} />
        <EventCard event={EVENTS.open} rsvpStatus={null} compact />
      </main>
    );
  }

  if (screen === "phase3-events-hub") {
    return (
      <main className="mx-auto w-full max-w-feed px-1 pb-6 pt-1">
        <EventsHub
          initial={{ events: [EVENTS.open, EVENTS.updated, EVENTS.full], viewer: { "evt-1": VIEWER_STATE(null), "evt-updated": VIEWER_STATE("GOING"), "evt-full": VIEWER_STATE(null) }, nextCursor: null, happeningNow: [EVENTS.live], range: null } as never}
          timezone="Africa/Lagos"
          canCreate
        />
      </main>
    );
  }

  if (screen === "phase3-event-detail" || screen === "phase3-event-detail-cancelled" || screen === "phase3-event-detail-full" || screen === "phase3-event-detail-ended" || screen === "phase3-event-detail-live" || screen === "phase3-event-detail-organiser") {
    const map: Record<string, [SerializedEvent, Record<string, unknown>]> = {
      "phase3-event-detail": [EVENTS.open, {}],
      "phase3-event-detail-cancelled": [EVENTS.cancelled, { rsvpOpen: false }],
      "phase3-event-detail-full": [EVENTS.full, { viewer: VIEWER_STATE("WAITLISTED") }],
      "phase3-event-detail-ended": [EVENTS.ended, { rsvpOpen: false }],
      "phase3-event-detail-live": [EVENTS.live, { checkInOpen: true }],
      "phase3-event-detail-organiser": [EVENTS.open, { permissions: { isOrganiser: true, canEdit: true, canCancel: true, canPostUpdate: true, canManageStaff: true, canViewAttendees: true, canExportAttendees: true } }],
    };
    const [event, over] = map[screen] ?? [EVENTS.open, {}];
    return (
      <main className="mx-auto w-full max-w-feed pb-4">
        <EventDetail detail={detailFor(event, over)} currentUser={PEOPLE[0]!} />
      </main>
    );
  }

  if (screen === "phase3-ticket") {
    return (
      <main className="mx-auto w-full max-w-sm px-2 pt-4">
        <TicketCard
          meta={{ event: EVENTS.open, status: "GOING", hasTicket: true, checkInOpen: false } as never}
          attendee={{ fullName: "Chinedu Okafor", username: "chinedu_okafor", photoUrl: null }}
        />
      </main>
    );
  }

  if (screen === "phase3-scanner") {
    return (
      <main className="min-h-dvh bg-bg px-4 pb-8 pt-4">
        <CheckinScanner event={EVENTS.live} initialCheckedIn={12} />
      </main>
    );
  }

  if (screen === "phase3-dashboard") {
    return (
      <main className="mx-auto w-full max-w-3xl px-4 py-4">
        <OrganiserDashboard
          dashboard={
            {
              event: EVENTS.open,
              stats: { views: 1284, going: 34, interested: 12, waitlisted: 9, checkedIn: 21, checkInRate: 62 },
              attendees: PEOPLE.map((person, index) => ({
                userId: person.id,
                fullName: person.fullName,
                username: person.username,
                photoUrl: person.photoUrl,
                level: 300,
                department: "Software Engineering",
                checkedInAt: index < 2 ? new Date(NOW - HOUR).toISOString() : null,
              })),
              changeLog: [{ at: new Date(NOW - 2 * HOUR).toISOString(), fields: ["venueName", "startsAt"], previous: { venueName: "Old Hall" } }],
              trend: {
                views: Array.from({ length: 14 }, (_, i) => ({ date: `2026-11-${String(i + 8).padStart(2, "0")}`, value: [4, 6, 9, 7, 12, 18, 22, 19, 25, 28, 30, 27, 33, 34][i] ?? 10 })),
                checkIns: Array.from({ length: 14 }, (_, i) => ({ date: `2026-11-${String(i + 8).padStart(2, "0")}`, value: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 6, 21][i] ?? 0 })),
              },
            } as never
          }
          initialStaff={[{ id: "u2", role: "HOST", user: { id: "u2", username: "aisha_bello", fullName: "Aisha Bello", photoUrl: null, level: 300 } } as never]}
          canManageStaff
          canExport
        />
      </main>
    );
  }

  if (screen === "phase3-my-events") {
    const rows = [
      { id: "evt-1", title: "Nova Tech Summit: Build Night", startsAt: EVENTS.open.startsAt, endsAt: EVENTS.open.endsAt, timezone: "Africa/Lagos", venueName: "Central Auditorium", coverUrl: null, status: "SCHEDULED", cancelled: false, category: "TECH", categoryColor: "#4f46e5", checkInEnabled: true, capacity: 50, goingCount: 34, waitlistCount: 0, hasTicket: true, rsvpStatus: "GOING", attendeePreview: [{ id: "u1", username: "aisha_bello", fullName: "Aisha Bello", photoUrl: null }], organiserKind: "USER", organisers: { fullName: "Aisha Bello", username: "aisha_bello", photoUrl: null } },
      { id: "evt-2", title: "Design Critique: Final Projects", startsAt: EVENTS.updated.startsAt, endsAt: EVENTS.updated.endsAt, timezone: "Africa/Lagos", venueName: "Design Studio 2", coverUrl: null, status: "SCHEDULED", cancelled: false, category: "ACADEMIC", categoryColor: "#0f766e", capacity: 20, goingCount: 18, waitlistCount: 2, hasTicket: false, attendeePreview: [], organiserKind: "COMMUNITY", organisers: { fullName: "Campus Design Collective", username: "design_collective", photoUrl: null }, community: { id: "c-2", name: "Campus Design Collective", slug: "design-collective", iconUrl: null, bannerUrl: null, memberCount: 412, privacy: "PUBLIC" } },
      { id: "evt-3", title: "Hall Welcome Quiz Night", startsAt: EVENTS.ended.startsAt, endsAt: EVENTS.ended.endsAt, timezone: "Africa/Lagos", venueName: "Mariam Hall", coverUrl: null, status: "CANCELLED", cancelReason: "The hall is closed for repairs.", cancelledAt: new Date(NOW - DAY).toISOString(), lastMaterialChangeAt: null, cancelled: true, category: "SOCIAL", categoryColor: "#be123c", capacity: 80, goingCount: 64, waitlistCount: 0, hasTicket: false, attendeePreview: [], organiserKind: "COMMUNITY", organisers: { fullName: "Mariam Hall", username: "mariam_hall", photoUrl: null }, community: { id: "c-3", name: "Mariam Hall", slug: "mariam-hall", iconUrl: null, bannerUrl: null, memberCount: 1840, privacy: "PUBLIC" } },
    ];
    return (
      <main className="mx-auto w-full max-w-feed px-4 py-4">
        <MyEvents initialTab="going" initialEvents={rows as never} />
      </main>
    );
  }

  if (screen === "phase3-official") {
    return (
      <main className="mx-auto w-full max-w-feed px-4 pb-8 pt-2">
        <OfficialChannel
          initialFeed={FEED}
          banners={{ critical: CRITICAL, official: ANNOUNCEMENT } as unknown as AnnouncementBanner}
          accounts={[{ id: "oa-1", name: "Registrar", slug: "registrar", canPost: false }]}
          canPost={false}
          timezone="Africa/Lagos"
        />
      </main>
    );
  }

  if (screen === "phase3-announcement") {
    return (
      <main className="mx-auto w-full max-w-feed px-4 py-4">
        <AnnouncementDetail announcement={ANNOUNCEMENT} acknowledged={false} timezone="Africa/Lagos" />
      </main>
    );
  }

  if (screen === "phase3-cards-plain") {
    return (
      <main className="mx-auto w-full max-w-feed space-y-3 px-4 py-4">
        <AnnouncementCard announcement={ANNOUNCEMENT} acknowledged={false} timezone="Africa/Lagos" />
        <AnnouncementCard announcement={CRITICAL} acknowledged={false} timezone="Africa/Lagos" />
        <OfficialBanner announcement={ANNOUNCEMENT as never} />
        <CriticalBanner announcement={CRITICAL as never} />
        <PulseEventModules
          banners={{ critical: null, official: ANNOUNCEMENT } as never}
          happeningNow={[EVENTS.live]}
          upcoming={EVENTS.open}
          viewerState={{ "evt-1": { status: null, hasTicket: false, staffRole: null } }}
        />
      </main>
    );
  }

  if (screen === "phase3-admin-places") {
    return (
      <AdminShell university={GALLERY_UNIVERSITY} user={{ fullName: "Funke Adebayo", photoUrl: null }} pendingCount={5} reportCount={12} isAdmin canModerate>
        <PlacesConsole
          initialPlaces={[
            { id: "pl-1", name: "Central Auditorium", category: "AUDITORIUM", latitude: 6.5076, longitude: 3.3437, note: "Gate 3, opposite the library", active: true } as never,
            { id: "pl-2", name: "Faculty of Engineering Workshop", category: "WORKSHOP", latitude: 6.5081, longitude: 3.3429, note: null, active: true } as never,
            { id: "pl-3", name: "Mariam Hall Common Room", category: "HALL", latitude: null, longitude: null, note: "Hostels row 4", active: false } as never,
          ]}
        />
      </AdminShell>
    );
  }

  if (screen === "phase3-admin-official") {
    return (
      <AdminShell university={GALLERY_UNIVERSITY} user={{ fullName: "Funke Adebayo", photoUrl: null }} pendingCount={5} reportCount={12} isAdmin canModerate>
        <OfficialConsole
          initialAccounts={[
            { id: "oa-1", name: "Registrar", slug: "registrar", description: "Academic notices from the Registrar's office.", category: "ACADEMIC", status: "ACTIVE", staff: [{ userId: "u9", fullName: "Bola Adeyemi", username: "bola_adeyemi", role: "STAFF", canPublishCritical: true }] } as never,
            { id: "oa-2", name: "SUG", slug: "sug", description: "Students' Union Government.", category: "STUDENT_LIFE", status: "SUSPENDED", staff: [] } as never,
          ]}
        />
      </AdminShell>
    );
  }

  if (screen === "phase3-admin-announcements") {
    return (
      <AdminShell university={GALLERY_UNIVERSITY} user={{ fullName: "Funke Adebayo", photoUrl: null }} pendingCount={5} reportCount={12} isAdmin canModerate>
        <AnnouncementConsole
          initialAnnouncements={[
            { ...ANNOUNCEMENT, acknowledgementCount: 812, audienceLabel: "Everyone" } as never,
            { ...CRITICAL, acknowledgementCount: 1190, audienceLabel: "Everyone" } as never,
          ]}
          timezone="Africa/Lagos"
          canCompose
        />
      </AdminShell>
    );
  }

  if (screen === "phase3-admin-events") {
    return (
      <AdminShell university={GALLERY_UNIVERSITY} user={{ fullName: "Funke Adebayo", photoUrl: null }} pendingCount={5} reportCount={12} isAdmin canModerate>
        <EventModerationConsole
          initialEvents={[
            { id: "evt-1", title: "Nova Tech Summit: Build Night", status: "SCHEDULED", startsAt: EVENTS.open.startsAt, endsAt: EVENTS.open.endsAt, timezone: "Africa/Lagos", venueName: "Central Auditorium", capacity: 50, goingCount: 34, audienceKind: "UNIVERSITY", organiser: "Aisha Bello", organiserKind: "USER", categoryName: "Tech", createdAt: EVENTS.open.createdAt, communityName: null, reported: 0 } as never,
            { id: "evt-2", title: "Late Night Cram Session (Alcohol sponsored)", status: "REMOVED", startsAt: EVENTS.live.startsAt, endsAt: EVENTS.live.endsAt, timezone: "Africa/Lagos", venueName: "Off campus", capacity: 200, goingCount: 180, audienceKind: "PUBLIC", organiser: "Tunde Adeyemi", organiserKind: "USER", categoryName: "Social", createdAt: EVENTS.open.createdAt, communityName: null, reported: 4 } as never,
          ]}
          timezone="Africa/Lagos"
        />
      </AdminShell>
    );
  }

  return (
    <main className="mx-auto w-full max-w-feed space-y-3 px-4 py-4">
      <EventCard event={EVENTS.open} rsvpStatus={null} />
    </main>
  );
}

export const PHASE3_SCREENS = [
  "phase3-event-cards",
  "phase3-events-hub",
  "phase3-event-detail",
  "phase3-event-detail-cancelled",
  "phase3-event-detail-full",
  "phase3-event-detail-ended",
  "phase3-event-detail-live",
  "phase3-event-detail-organiser",
  "phase3-ticket",
  "phase3-scanner",
  "phase3-dashboard",
  "phase3-my-events",
  "phase3-official",
  "phase3-announcement",
  "phase3-cards-plain",
  "phase3-admin-places",
  "phase3-admin-official",
  "phase3-admin-announcements",
  "phase3-admin-events",
];
