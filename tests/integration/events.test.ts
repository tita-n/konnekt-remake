import { createHash } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { platformDb } from "@/lib/db/platform";
import { tenantDb } from "@/lib/db/tenant";
import type { SocialViewer } from "@/lib/services/social";
import {
  addEventComment,
  cancelRsvp,
  createEvent,
  getEventDetail,
  getMyEventsForCalendar,
  getPublicEventPreview,
  listAttendees,
  regenerateTicket,
  checkInAttendee,
  rsvpEvent,
  updateEvent,
} from "@/lib/services/events";
import {
  acknowledgeAnnouncement,
  getAnnouncementAttachment,
  publishDueAnnouncements,
} from "@/lib/services/announcements";
import { POLICIES, rateLimit, __resetMemoryRateLimits } from "@/lib/security/rate-limit";
import { storeResourceFile } from "@/lib/media/resource-store";

const suffix = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

let universityA: { id: string };
let universityB: { id: string };
let adminA: { id: string };
let users: Array<{ id: string }> = [];
let outsiderB: { id: string };
let deptA = `dept-a-${suffix}`;
let deptB = `dept-b-${suffix}`;

function viewerFor(
  user: { id: string },
  universityId: string,
  overrides: Partial<SocialViewer> = {},
): SocialViewer {
  return {
    userId: user.id,
    universityId,
    studentPath: [universityId, deptA, 300],
    departmentId: deptA,
    level: 300,
    username: `u${user.id.slice(-6)}`,
    fullName: `Student ${user.id.slice(-4)}`,
    photoUrl: null,
    labels: { college: "College", faculty: "Faculty", department: "Department" },
    lineage: { college: null, faculty: null, department: "Department" },
    accountAgeHours: 1000,
    interests: [],
    isUniversityStaff: false,
    isUniversityAdmin: false,
    isUniversityModerator: false,
    timezone: "Africa/Lagos",
    showEventAttendance: true,
    ...overrides,
  };
}

async function makeEvent(data: {
  id: string;
  title: string;
  capacity?: number | null;
  startsAt?: Date;
  endsAt?: Date;
  audiencePath?: string[];
  audienceKind?: "PUBLIC" | "DEPARTMENT";
  allowOutsideSharing?: boolean;
}) {
  return tenantDb(universityA.id).event.create({
    data: {
      id: data.id,
      universityId: universityA.id,
      createdById: adminA.id,
      organiserKind: "USER",
      audienceKind: data.audienceKind ?? "PUBLIC",
      audiencePath: data.audiencePath ?? ["PUBLIC"],
      title: data.title,
      description: "Integration test event.",
      category: "MEETUP",
      startsAt: data.startsAt ?? new Date(Date.now() + 60 * 60 * 1000),
      endsAt:
        data.endsAt ??
        new Date((data.startsAt ?? new Date(Date.now() + 60 * 60 * 1000)).getTime() + 2 * 60 * 60 * 1000),
      timezone: "Africa/Lagos",
      venueName: "Test Hall",
      capacity: data.capacity ?? null,
      waitlistEnabled: true,
      checkInEnabled: true,
      allowOutsideSharing: data.allowOutsideSharing ?? false,
    },
  });
}

beforeAll(async () => {
  universityA = await platformDb.university.create({
    data: {
      name: `Events A ${suffix}`,
      shortName: "EVA",
      slug: `events-a-${suffix}`,
      status: "ACTIVE",
      matricPattern: "^[A-Z]{3}/\\d{4}/\\d{3,4}$",
      studentEmailDomains: [`events-a-${suffix}.edu.ng`],
      labels: {},
      timezone: "Africa/Lagos",
    },
    select: { id: true },
  });
  universityB = await platformDb.university.create({
    data: {
      name: `Events B ${suffix}`,
      shortName: "EVB",
      slug: `events-b-${suffix}`,
      status: "ACTIVE",
      matricPattern: "^[A-Z]{3}/\\d{4}/\\d{3,4}$",
      studentEmailDomains: [`events-b-${suffix}.edu.ng`],
      labels: {},
      timezone: "Africa/Lagos",
    },
    select: { id: true },
  });
  const base = {
    passwordHash: "not-a-real-hash",
    emailVerified: true,
    status: "VERIFIED" as const,
    consentPolicyVersion: "2026-01-01",
    consentAcceptedAt: new Date(),
    verifiedAt: new Date(),
  };
  adminA = await platformDb.user.create({
    data: {
      ...base,
      universityId: universityA.id,
      email: `events-admin-${suffix}@events-a-${suffix}.edu.ng`,
      username: `evadmin${suffix}`.slice(0, 20),
      fullName: "Event Admin",
      matricNumber: "EVA/2024/000",
      matricNormalized: "EVA/2024/000",
      level: 400,
    },
    select: { id: true },
  });
  users = await Promise.all(
    [0, 1, 2, 3, 4].map((index) =>
      platformDb.user.create({
        data: {
          ...base,
          universityId: universityA.id,
          email: `events-student-${index}-${suffix}@events-a-${suffix}.edu.ng`,
          username: `evstud${index}${suffix}`.slice(0, 20),
          fullName: `Event Student ${index}`,
          matricNumber: `EVA/2024/10${index}`,
          matricNormalized: `EVA/2024/10${index}`,
          level: 300,
        },
        select: { id: true },
      }),
    ),
  );
  outsiderB = await platformDb.user.create({
    data: {
      ...base,
      universityId: universityB.id,
      email: `events-b-${suffix}@events-b-${suffix}.edu.ng`,
      username: `evb${suffix}`.slice(0, 20),
      fullName: "Other Tenant",
      matricNumber: "EVB/2024/001",
      matricNormalized: "EVB/2024/001",
      level: 200,
    },
    select: { id: true },
  });
});

afterAll(async () => {
  await platformDb.$disconnect();
});

describe("event isolation and privacy", () => {
  it("gives hidden and nonexistent events the same response", async () => {
    const hiddenId = `evt_hidden_${suffix}`;
    await makeEvent({
      id: hiddenId,
      title: "Hidden department event",
      audienceKind: "DEPARTMENT",
      audiencePath: [universityA.id, "a-different-department"],
    });
    const viewer = viewerFor(users[0]!, universityA.id);
    const hidden = await getEventDetail(viewer, hiddenId, { recordView: false }).catch((error) => error);
    const missing = await getEventDetail(viewer, `evt_missing_${suffix}`, { recordView: false }).catch((error) => error);
    expect(hidden).toMatchObject({ status: 404, message: "This event isn't available." });
    expect(missing).toMatchObject({ status: 404, message: "This event isn't available." });
  });

  it("never serves another university's event", async () => {
    const id = `evt_tenant_${suffix}`;
    await makeEvent({ id, title: "Tenant scoped" });
    const other = viewerFor(outsiderB, universityB.id, { studentPath: [universityB.id, deptB, 200] });
    await expect(getEventDetail(other, id, { recordView: false })).rejects.toMatchObject({ status: 404 });
  });

  it("returns no public preview until the organiser opts in", async () => {
    const id = `evt_public_${suffix}`;
    await makeEvent({ id, title: "Share me", allowOutsideSharing: false });
    expect(await getPublicEventPreview(id)).toBeNull();
    await tenantDb(universityA.id).event.update({ where: { id }, data: { allowOutsideSharing: true } });
    const preview = await getPublicEventPreview(id);
    expect(preview).toMatchObject({ title: "Share me", venueName: "Test Hall" });
    expect(preview).not.toHaveProperty("description");
    expect(preview).not.toHaveProperty("goingCount");
  });
});

describe("RSVP capacity and waitlist", () => {
  it("never oversells under concurrent RSVPs and promotes exactly one waiter", async () => {
    const id = `evt_capacity_${suffix}`;
    await makeEvent({ id, title: "Two seats", capacity: 2 });
    const results = await Promise.all(
      users.slice(0, 3).map((user) => rsvpEvent(viewerFor(user, universityA.id), id, "GOING")),
    );
    const statuses = results.map((result) => result.status).sort();
    expect(statuses).toEqual(["GOING", "GOING", "WAITLISTED"]);
    let row = await tenantDb(universityA.id).event.findUnique({ where: { id }, select: { goingCount: true, waitlistCount: true } });
    expect(row).toMatchObject({ goingCount: 2, waitlistCount: 1 });

    const goingUser = users[results.findIndex((result) => result.status === "GOING")]!;
    const waitlistedUser = users[results.findIndex((result) => result.status === "WAITLISTED")]!;
    await cancelRsvp(viewerFor(goingUser, universityA.id), id);
    row = await tenantDb(universityA.id).event.findUnique({ where: { id }, select: { goingCount: true, waitlistCount: true } });
    expect(row).toMatchObject({ goingCount: 2, waitlistCount: 0 });
    const promoted = await tenantDb(universityA.id).eventRsvp.findUnique({
      where: { eventId_userId: { eventId: id, userId: waitlistedUser.id } },
      select: { status: true, promotedAt: true },
    });
    expect(promoted?.status).toBe("GOING");
    expect(promoted?.promotedAt).not.toBeNull();
  });

  it("promotes a waiter when a Going student switches to Interested", async () => {
    const id = `evt_switch_${suffix}`;
    await makeEvent({ id, title: "Change of mind", capacity: 2 });
    const results = await Promise.all(
      users.slice(0, 3).map((user) => rsvpEvent(viewerFor(user, universityA.id), id, "GOING")),
    );
    const goingUser = users[results.findIndex((result) => result.status === "GOING")]!;
    const waitlistedUser = users[results.findIndex((result) => result.status === "WAITLISTED")]!;

    const switched = await rsvpEvent(viewerFor(goingUser, universityA.id), id, "INTERESTED");
    expect(switched).toMatchObject({ status: "INTERESTED", goingCount: 2, waitlistCount: 0 });

    const row = await tenantDb(universityA.id).event.findUnique({
      where: { id },
      select: { goingCount: true, interestedCount: true, waitlistCount: true },
    });
    expect(row).toMatchObject({ goingCount: 2, interestedCount: 1, waitlistCount: 0 });
    const promoted = await tenantDb(universityA.id).eventRsvp.findUnique({
      where: { eventId_userId: { eventId: id, userId: waitlistedUser.id } },
      select: { status: true, promotedAt: true },
    });
    expect(promoted?.status).toBe("GOING");
    expect(promoted?.promotedAt).not.toBeNull();
  });

  it("does not leak attendee identity when a student hides attendance", async () => {
    const id = `evt_privacy_${suffix}`;
    await makeEvent({ id, title: "Privacy event" });
    const visible = viewerFor(users[0]!, universityA.id);
    const hidden = viewerFor(users[1]!, universityA.id);
    await rsvpEvent(visible, id, "GOING");
    await rsvpEvent(hidden, id, "GOING");
    await tenantDb(universityA.id).eventRsvp.update({
      where: { eventId_userId: { eventId: id, userId: hidden.userId } },
      data: { showPublicly: false },
    });
    const detail = await getEventDetail(viewerFor(users[2]!, universityA.id), id, { recordView: false });
    const ids = detail.attendees.preview.map((entry) => entry.id);
    expect(ids).toContain(visible.userId);
    expect(ids).not.toContain(hidden.userId);
    expect(detail.attendees.hiddenCount).toBe(1);
  });
});

describe("tickets and check-in", () => {
  it("issues a ticket once, revokes on regeneration and makes scans idempotent", async () => {
    const id = `evt_checkin_${suffix}`;
    await makeEvent({
      id,
      title: "Check-in event",
      startsAt: new Date(Date.now() - 30 * 60 * 1000),
      endsAt: new Date(Date.now() + 2 * 60 * 60 * 1000),
    });
    const attendee = viewerFor(users[0]!, universityA.id);
    await rsvpEvent(attendee, id, "GOING");
    const first = await regenerateTicket(attendee, id);
    expect(first.code).toMatch(/^[A-Za-z0-9_-]{20,}$/);
    const second = await regenerateTicket(attendee, id);
    expect(second.code).not.toBe(first.code);
    const active = await tenantDb(universityA.id).eventTicket.findMany({
      where: { eventId: id, userId: attendee.userId, revokedAt: null },
      select: { id: true },
    });
    expect(active).toHaveLength(1);
    await expect(
      checkInAttendee(viewerFor(adminA, universityA.id), id, { method: "QR", code: first.code, clientScanId: `old-${suffix}-0001` }),
    ).rejects.toMatchObject({ status: 404 });
    const scanner = viewerFor(adminA, universityA.id);
    const result = await checkInAttendee(scanner, id, {
      method: "QR",
      code: second.code,
      clientScanId: `scan-${suffix}-0001`,
    });
    expect(result.duplicate).toBe(false);
    const replay = await checkInAttendee(scanner, id, {
      method: "QR",
      code: second.code,
      clientScanId: `scan-${suffix}-0002`,
    });
    expect(replay.duplicate).toBe(true);
    const row = await tenantDb(universityA.id).event.findUnique({ where: { id }, select: { checkedInCount: true } });
    expect(row?.checkedInCount).toBe(1);
  });

  it("rejects check-in before the two-hour window", async () => {
    const id = `evt_early_${suffix}`;
    await makeEvent({ id, title: "Later event", startsAt: new Date(Date.now() + 24 * 60 * 60 * 1000) });
    const attendee = viewerFor(users[1]!, universityA.id);
    await rsvpEvent(attendee, id, "GOING");
    const ticket = await regenerateTicket(attendee, id);
    await expect(
      checkInAttendee(viewerFor(adminA, universityA.id), id, { method: "QR", code: ticket.code, clientScanId: `early-${suffix}-0001` }),
    ).rejects.toMatchObject({ status: 409, code: "checkin_closed" });
  });
});

describe("scheduled announcements", () => {
  it("publishes a due announcement exactly once across repeated cron runs", async () => {
    const account = await tenantDb(universityA.id).officialAccount.create({
      data: {
        id: `official_${suffix}`,
        universityId: universityA.id,
        name: `Registry ${suffix}`,
        nameNormalized: `registry${suffix}`,
        slug: `registry-${suffix}`,
        category: "REGISTRY",
        description: "Test account",
        status: "ACTIVE",
      },
    });
    const announcement = await tenantDb(universityA.id).announcement.create({
      data: {
        id: `ann_${suffix}`,
        universityId: universityA.id,
        officialAccountId: account.id,
        authorId: adminA.id,
        category: "ACADEMIC",
        title: "Scheduled notice",
        body: "This should publish once.",
        audienceKind: "PUBLIC",
        audiencePath: ["PUBLIC"],
        status: "SCHEDULED",
        publishAt: new Date(Date.now() - 60 * 1000),
      },
    });
    const first = await publishDueAnnouncements(tenantDb(universityA.id));
    const second = await publishDueAnnouncements(tenantDb(universityA.id));
    expect(first.published).toBe(1);
    expect(second.published).toBe(0);
    const stored = await tenantDb(universityA.id).announcement.findUnique({
      where: { id: announcement.id },
      select: { status: true, publishedAt: true },
    });
    expect(stored?.status).toBe("PUBLISHED");
    expect(stored?.publishedAt).not.toBeNull();
  });
});

describe("Phase 3 gap checks — concurrency and counters", () => {
  it("promotes every waiter freed by simultaneous cancellation and Going-to-Interested switch", async () => {
    const id = `evt_fifo_${suffix}`;
    await makeEvent({ id, title: "FIFO event", capacity: 3 });
    for (const user of users.slice(0, 3)) {
      await rsvpEvent(viewerFor(user, universityA.id), id, "GOING");
    }
    await rsvpEvent(viewerFor(users[3]!, universityA.id), id, "GOING");
    await rsvpEvent(viewerFor(users[4]!, universityA.id), id, "GOING");
    await Promise.all([
      cancelRsvp(viewerFor(users[0]!, universityA.id), id),
      rsvpEvent(viewerFor(users[1]!, universityA.id), id, "INTERESTED"),
    ]);
    const event = await tenantDb(universityA.id).event.findUnique({
      where: { id },
      select: { goingCount: true, interestedCount: true, waitlistCount: true },
    });
    expect(event).toMatchObject({ goingCount: 3, interestedCount: 1, waitlistCount: 0 });
    const promoted = await tenantDb(universityA.id).eventRsvp.findMany({
      where: { eventId: id, userId: { in: [users[3]!.id, users[4]!.id] } },
      orderBy: { waitlistPosition: "asc" },
      select: { userId: true, status: true, promotedAt: true },
    });
    expect(promoted).toHaveLength(2);
    expect(promoted.every((row) => row.status === "GOING" && row.promotedAt !== null)).toBe(true);
    expect(promoted.map((row) => row.userId).sort()).toEqual([users[3]!.id, users[4]!.id].sort());
  });

  it("promotes waiters when the organiser raises capacity", async () => {
    const id = `evt_capacity_up_${suffix}`;
    await makeEvent({ id, title: "Capacity increase", capacity: 1 });
    await rsvpEvent(viewerFor(users[0]!, universityA.id), id, "GOING");
    await rsvpEvent(viewerFor(users[1]!, universityA.id), id, "GOING");
    await updateEvent(viewerFor(adminA, universityA.id), id, { capacity: 2 });
    const event = await tenantDb(universityA.id).event.findUnique({
      where: { id },
      select: { capacity: true, goingCount: true, waitlistCount: true },
    });
    expect(event).toMatchObject({ capacity: 2, goingCount: 2, waitlistCount: 0 });
    const promoted = await tenantDb(universityA.id).eventRsvp.findUnique({
      where: { eventId_userId: { eventId: id, userId: users[1]!.id } },
      select: { status: true, promotedAt: true },
    });
    expect(promoted?.status).toBe("GOING");
    expect(promoted?.promotedAt).not.toBeNull();
  });

  it("converges to exactly one active ticket under simultaneous regeneration", async () => {
    const id = `evt_regen_race_${suffix}`;
    await makeEvent({
      id,
      title: "Regeneration race",
      startsAt: new Date(Date.now() - 30 * 60 * 1000),
      endsAt: new Date(Date.now() + 2 * 60 * 60 * 1000),
    });
    const attendee = viewerFor(users[2]!, universityA.id);
    await rsvpEvent(attendee, id, "GOING");
    await regenerateTicket(attendee, id);
    const results = await Promise.all([
      regenerateTicket(attendee, id),
      regenerateTicket(attendee, id),
    ]);
    const active = await tenantDb(universityA.id).eventTicket.findMany({
      where: { eventId: id, userId: attendee.userId, revokedAt: null },
      select: { codeHash: true },
    });
    expect(active).toHaveLength(1);
    const working = results.find((result) => hashForTest(result.code) === active[0]!.codeHash);
    expect(working).toBeDefined();
    const checked = await checkInAttendee(viewerFor(adminA, universityA.id), id, {
      method: "QR",
      code: working!.code,
      clientScanId: `regen-race-${suffix}`,
    });
    expect(checked.duplicate).toBe(false);
  });

  it("publishes and acknowledges exactly once under parallel cron and reads", async () => {
    const account = await tenantDb(universityA.id).officialAccount.create({
      data: {
        universityId: universityA.id,
        name: `Parallel Registry ${suffix}`,
        nameNormalized: `parallelregistry${suffix}`,
        slug: `parallel-registry-${suffix}`,
        category: "REGISTRY",
        description: "Parallel test account",
        status: "ACTIVE",
      },
    });
    const scheduled = await tenantDb(universityA.id).announcement.create({
      data: {
        universityId: universityA.id,
        officialAccountId: account.id,
        authorId: adminA.id,
        category: "ACADEMIC",
        title: "Parallel scheduled notice",
        body: "Publish once even when cron and reads race.",
        audienceKind: "PUBLIC",
        audiencePath: ["PUBLIC"],
        status: "SCHEDULED",
        publishAt: new Date(Date.now() - 60 * 1000),
      },
    });
    const runs = await Promise.all(
      Array.from({ length: 6 }, () => publishDueAnnouncements(tenantDb(universityA.id))),
    );
    expect(runs.reduce((sum, run) => sum + run.published, 0)).toBe(1);
    const stored = await tenantDb(universityA.id).announcement.findUnique({
      where: { id: scheduled.id },
      select: { status: true, publishedAt: true },
    });
    expect(stored?.status).toBe("PUBLISHED");
    expect(stored?.publishedAt).not.toBeNull();

    const acks = await Promise.all(
      Array.from({ length: 4 }, () =>
        acknowledgeAnnouncement(viewerFor(users[0]!, universityA.id), scheduled.id),
      ),
    );
    expect(acks.every((ack) => ack.acknowledged)).toBe(true);
    const ackRows = await tenantDb(universityA.id).announcementAck.count({
      where: { announcementId: scheduled.id, userId: users[0]!.id },
    });
    expect(ackRows).toBe(1);
  });

  it("enforces every Phase 3 rate limit policy", async () => {
    const expected = {
      eventCreate: [3, 24 * 60 * 60],
      eventRsvp: [60, 60 * 60],
      eventCheckIn: [600, 60 * 60],
      eventCsvExport: [10, 24 * 60 * 60],
      eventShareCard: [20, 60 * 60],
      eventTicketRegenerate: [5, 24 * 60 * 60],
      announcementCreate: [10, 24 * 60 * 60],
      announcementCritical: [2, 24 * 60 * 60],
      announcementCron: [30, 10 * 60],
    } as const;
    __resetMemoryRateLimits();
    for (const [name, [limit, windowSeconds]] of Object.entries(expected)) {
      expect(POLICIES[name as keyof typeof POLICIES]).toEqual({ limit, windowSeconds });
      for (let index = 0; index < limit; index += 1) {
        expect((await rateLimit(name as keyof typeof POLICIES, `gap-${name}`)).success).toBe(true);
      }
      expect((await rateLimit(name as keyof typeof POLICIES, `gap-${name}`)).success).toBe(false);
    }
    __resetMemoryRateLimits();
  });
});

describe("Phase 3 gap checks — privacy, calendar and attachments", () => {
  it("removes blocked students from event counts, comments and updates but keeps the organiser list complete", async () => {
    const id = `evt_block_${suffix}`;
    await makeEvent({ id, title: "Blocked event", capacity: 10 });
    const hidden = viewerFor(users[1]!, universityA.id);
    const viewer = viewerFor(users[2]!, universityA.id);
    await rsvpEvent(hidden, id, "GOING");
    await rsvpEvent(viewer, id, "GOING");
    await addEventComment(hidden, id, { body: "A blocked student comment that must disappear." });
    await tenantDb(universityA.id).eventUpdate.create({
      data: {
        universityId: universityA.id,
        eventId: id,
        authorId: hidden.userId,
        body: "A blocked organiser update that must disappear.",
      },
    });
    await tenantDb(universityA.id).block.create({
      data: { universityId: universityA.id, userId: viewer.userId, blockedUserId: hidden.userId },
    });
    try {
      const detail = await getEventDetail(viewer, id, { recordView: false });
      expect(detail.attendees.count).toBe(1);
      expect(detail.attendees.preview.map((row) => row.id)).not.toContain(hidden.userId);
      expect(detail.attendees.hiddenCount).toBe(0);
      expect(detail.comments).toHaveLength(0);
      expect(detail.updates).toHaveLength(0);
      expect(detail.commentCount).toBe(0);
      const organiser = await listAttendees(viewerFor(adminA, universityA.id), id, { status: "ALL" });
      expect(organiser.attendees.map((row) => row.userId).sort()).toEqual(
        [hidden.userId, viewer.userId].sort(),
      );
    } finally {
      await tenantDb(universityA.id).block.deleteMany({
        where: { userId: viewer.userId, blockedUserId: hidden.userId },
      });
    }
  });

  it("exports only events the student can currently see to the calendar", async () => {
    const visibleId = `evt_calendar_visible_${suffix}`;
    const hiddenId = `evt_calendar_hidden_${suffix}`;
    await makeEvent({ id: visibleId, title: "Visible calendar event" });
    await makeEvent({
      id: hiddenId,
      title: "Hidden calendar event",
      audienceKind: "DEPARTMENT",
      audiencePath: [universityA.id, "not-my-department"],
    });
    const student = viewerFor(users[0]!, universityA.id);
    await rsvpEvent(student, visibleId, "GOING");
    const rows = await getMyEventsForCalendar(student);
    expect(rows.map((row) => row.id)).toContain(visibleId);
    expect(rows.map((row) => row.id)).not.toContain(hiddenId);
  });

  it("checks announcement audience again before serving a private attachment", async () => {
    const account = await tenantDb(universityA.id).officialAccount.create({
      data: {
        universityId: universityA.id,
        name: `Attachment Registry ${suffix}`,
        nameNormalized: `attachmentregistry${suffix}`,
        slug: `attachment-registry-${suffix}`,
        category: "REGISTRY",
        description: "Attachment test account",
        status: "ACTIVE",
      },
    });
    const stored = await storeResourceFile({
      filename: "notice.pdf",
      contentType: "application/pdf",
      bytes: Buffer.from("%PDF-1.4\nprivate notice\n"),
    });
    const announcement = await tenantDb(universityA.id).announcement.create({
      data: {
        universityId: universityA.id,
        officialAccountId: account.id,
        authorId: adminA.id,
        category: "ACADEMIC",
        title: "Department-only attachment",
        body: "Only this department may download the file.",
        audienceKind: "DEPARTMENT",
        audiencePath: [universityA.id, deptA],
        status: "PUBLISHED",
        publishAt: new Date(Date.now() - 60 * 1000),
        publishedAt: new Date(Date.now() - 60 * 1000),
        attachments: {
          create: {
            universityId: universityA.id,
            fileKey: stored.fileKey,
            name: "notice.pdf",
            mimeType: "application/pdf",
            sizeBytes: stored.sizeBytes,
          },
        },
      },
      select: { id: true, attachments: { select: { id: true } } },
    });
    const allowed = await getAnnouncementAttachment(
      viewerFor(users[0]!, universityA.id),
      announcement.id,
      announcement.attachments[0]!.id,
    );
    expect(allowed.name).toBe("notice.pdf");
    expect(allowed.localBytes?.toString()).toContain("private notice");
    const outsider = viewerFor(users[3]!, universityA.id, {
      studentPath: [universityA.id, deptB, 300],
      departmentId: deptB,
    });
    await expect(
      getAnnouncementAttachment(outsider, announcement.id, announcement.attachments[0]!.id),
    ).rejects.toMatchObject({ status: 404 });
    await expect(
      getAnnouncementAttachment(viewerFor(users[0]!, universityA.id), announcement.id, "not-the-attachment"),
    ).rejects.toMatchObject({ status: 404 });
  });
});

  it("refuses an eleventh upcoming event for the same organiser", async () => {
    const organiser = users[4]!;
    const startsAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
    await Promise.all(
      Array.from({ length: 10 }, (_, index) =>
        makeEvent({
          id: `evt_limit_${suffix}_${index}`,
          title: `Upcoming ${index}`,
          startsAt,
        }).then((row) =>
          tenantDb(universityA.id).event.update({
            where: { id: row.id },
            data: { createdById: organiser.id, createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000) },
          }),
        ),
      ),
    );
    await expect(
      createEvent(viewerFor(organiser, universityA.id), {
        title: "Eleventh upcoming event",
        description: "This must be refused before it is written.",
        category: "MEETUP",
        audienceKind: "PUBLIC",
        audiencePath: ["PUBLIC"],
        startsAt,
        endsAt: new Date(startsAt.getTime() + 60 * 60 * 1000),
        venueName: "Test Hall",
        capacity: 10,
      }),
    ).rejects.toMatchObject({ status: 409, code: "limit_reached" });
  });
function hashForTest(code: string): string {
  return createHash("sha256").update(code, "utf8").digest("hex");
}
