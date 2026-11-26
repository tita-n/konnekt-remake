import { describe, expect, it } from "vitest";
import { buildStudentPath } from "@/lib/domain/academic";
import {
  audienceIsOnViewerPath,
  canSeeEvent,
  capacityRemaining,
  checkInWindow,
  eventPermissions,
  goingOutcome,
  materialEventChange,
  nextWaitlistPosition,
  organizerAudienceIsValid,
  rsvpIsOpen,
  validateEventForCreation,
  validateEventWindow,
  type EventPermissionActor,
  type EventPermissionEvent,
} from "@/lib/domain/events";
import {
  generateTicketCode,
  hashTicketCode,
  isTicketCodeShape,
  ticketCodeMatches,
} from "@/lib/domain/event-ticket";
import {
  buildIcs,
  eventDateKey,
  formatEventWhen,
  icsFileName,
  zonedTimeToUtc,
} from "@/lib/domain/event-time";
import {
  announcementAttachmentError,
  canSeeAnnouncement,
  resolveAnnouncementStatus,
  scheduleError,
  visibleAnnouncementFilter,
} from "@/lib/domain/announcements";
import { canPublishAsOfficial, canPublishCritical, normalizeOfficialName, officialNameError } from "@/lib/domain/official";

const UNI = "uni_nova";
const COLLEGE = "college_eng";
const FACULTY = "faculty_computing";
const DEPT = "dept_swe";

const path = buildStudentPath({
  universityId: UNI,
  college: { id: COLLEGE, name: "Engineering" },
  faculty: { id: FACULTY, name: "Computing" },
  department: { id: DEPT, name: "Software Engineering" },
  level: 300,
});

const eventActor: EventPermissionActor = {
  userId: "user_owner",
  isUniversityAdmin: false,
  isUniversityModerator: false,
};

function event(overrides: Partial<EventPermissionEvent> = {}): EventPermissionEvent {
  return {
    organiserKind: "USER",
    createdById: "user_owner",
    status: "SCHEDULED",
    startsAt: new Date(Date.now() + 60 * 60 * 1000),
    endsAt: new Date(Date.now() + 3 * 60 * 60 * 1000),
    checkInEnabled: true,
    ...overrides,
  };
}

describe("event visibility", () => {
  it("lets a student see public and ancestor audiences, never wider ones", () => {
    expect(canSeeEvent(path, { audienceKind: "PUBLIC", audiencePath: ["PUBLIC"] })).toBe(true);
    expect(canSeeEvent(path, { audienceKind: "COLLEGE", audiencePath: [UNI, COLLEGE] })).toBe(true);
    expect(canSeeEvent(path, { audienceKind: "FACULTY", audiencePath: [UNI, COLLEGE, FACULTY] })).toBe(true);
    expect(canSeeEvent(path, { audienceKind: "DEPARTMENT", audiencePath: [UNI, COLLEGE, FACULTY, DEPT] })).toBe(true);
    expect(canSeeEvent(path, { audienceKind: "LEVEL", audiencePath: [UNI, COLLEGE, FACULTY, DEPT, 400] })).toBe(false);
    expect(canSeeEvent(path, { audienceKind: "PUBLIC", audiencePath: [UNI, "PUBLIC"] })).toBe(false);
    expect(canSeeEvent(path, { audienceKind: "COMMUNITY", audiencePath: [] })).toBe(false);
  });

  it("never lets an organiser compose above their own path", () => {
    expect(audienceIsOnViewerPath(path, "LEVEL", [UNI, COLLEGE, FACULTY, DEPT, 300])).toBe(true);
    expect(audienceIsOnViewerPath(path, "PUBLIC", ["PUBLIC"])).toBe(true);
    expect(audienceIsOnViewerPath(path, "DEPARTMENT", ["another-dept"])).toBe(false);
    expect(audienceIsOnViewerPath(path, "COMMUNITY", [])).toBe(false);
    expect(organizerAudienceIsValid({ organizerKind: "COMMUNITY", audienceKind: "COMMUNITY", audiencePath: [] })).toBe(true);
    expect(organizerAudienceIsValid({ organizerKind: "USER", audienceKind: "COMMUNITY", audiencePath: [] })).toBe(false);
  });
});

describe("event permissions", () => {
  it("gives the creator edit, staff and check-in rights only while bookable", () => {
    const permissions = eventPermissions(eventActor, event());
    expect(permissions.isOrganiser).toBe(true);
    expect(permissions.canEdit).toBe(true);
    expect(permissions.canManageStaff).toBe(true);
    expect(permissions.canCheckIn).toBe(true);
    expect(permissions.canViewAttendees).toBe(true);
    const ended = eventPermissions(eventActor, event({ endsAt: new Date(Date.now() - 1000) }));
    expect(ended.canEdit).toBe(false);
    expect(ended.canCheckIn).toBe(false);
  });

  it("separates host, check-in and moderator powers", () => {
    const checkin = eventPermissions({ ...eventActor, userId: "staff", staffRole: "CHECKIN" }, event());
    expect(checkin.canCheckIn).toBe(true);
    expect(checkin.isEventStaff).toBe(true);
    expect(checkin.canEdit).toBe(false);
    expect(checkin.canExportAttendees).toBe(false);
    const moderate = eventPermissions(
      { userId: "admin", isUniversityAdmin: true, isUniversityModerator: false },
      event(),
    );
    expect(moderate.canRemove).toBe(true);
    expect(moderate.canCancel).toBe(true);
    expect(moderate.canViewAttendees).toBe(true);
    expect(moderate.canViewDashboard).toBe(false);
  });

  it("lets a community member organise only when the community allows it", () => {
    const base = { ...eventActor, userId: "member", communityRole: "MEMBER" as const, communityMemberStatus: "ACTIVE" };
    const allowed = eventPermissions(
      { ...base, communityAllowMemberEvents: true },
      event({ organiserKind: "COMMUNITY", createdById: "member", communityId: "c1" }),
    );
    const blocked = eventPermissions(
      { ...base, communityAllowMemberEvents: false },
      event({ organiserKind: "COMMUNITY", createdById: "member", communityId: "c1" }),
    );
    expect(allowed.isOrganiser).toBe(true);
    expect(blocked.isOrganiser).toBe(false);
  });
});

describe("capacity and waitlist", () => {
  it("fills, waitlists or refuses deterministically", () => {
    expect(goingOutcome({ capacity: 10, goingCount: 9, waitlistEnabled: false })).toBe("GOING");
    expect(goingOutcome({ capacity: 10, goingCount: 10, waitlistEnabled: true })).toBe("WAITLISTED");
    expect(goingOutcome({ capacity: 10, goingCount: 10, waitlistEnabled: false })).toBe("FULL");
    expect(goingOutcome({ capacity: null, goingCount: 9999, waitlistEnabled: false })).toBe("GOING");
    expect(capacityRemaining(10, 4)).toBe(6);
    expect(capacityRemaining(null, 4)).toBeNull();
    expect(nextWaitlistPosition(3)).toBe(4);
  });

  it("closes RSVPs at the end time and opens check-in two hours before", () => {
    const now = new Date("2026-12-01T12:00:00.000Z");
    const event = { startsAt: "2026-12-01T14:00:00.000Z", endsAt: "2026-12-01T18:00:00.000Z" };
    expect(checkInWindow(event, now).open).toBe(true);
    expect(checkInWindow(event, new Date("2026-12-01T11:59:00.000Z")).open).toBe(false);
    expect(checkInWindow(event, new Date("2026-12-01T18:01:00.000Z")).open).toBe(false);
    expect(rsvpIsOpen({ status: "SCHEDULED", endsAt: event.endsAt }, now)).toBe(true);
    expect(rsvpIsOpen({ status: "CANCELLED", endsAt: event.endsAt }, now)).toBe(false);
  });

  it("records only material time and venue edits", () => {
    const before = {
      previousStartsAt: new Date("2026-12-01T14:00:00.000Z"),
      previousEndsAt: new Date("2026-12-01T18:00:00.000Z"),
      previousVenueName: "Hall A",
      nextStartsAt: new Date("2026-12-01T14:00:00.000Z"),
      nextEndsAt: new Date("2026-12-01T18:00:00.000Z"),
      nextVenueName: "Hall B",
    };
    expect(materialEventChange(before)).toEqual({ changed: true, fields: ["venue"] });
    expect(materialEventChange({ ...before, nextVenueName: "Hall A", nextStartsAt: new Date("2026-12-01T15:00:00.000Z") }).fields).toContain("time");
    expect(materialEventChange({ ...before, nextVenueName: "Hall A" })).toEqual({ changed: false, fields: [] });
  });
});

describe("ticket codes", () => {
  it("generates opaque 128-bit codes and compares them in constant time", () => {
    const first = generateTicketCode();
    const second = generateTicketCode();
    expect(first).not.toBe(second);
    expect(isTicketCodeShape(first)).toBe(true);
    expect(isTicketCodeShape("short")).toBe(false);
    const hash = hashTicketCode(first);
    expect(hash).toHaveLength(64);
    expect(ticketCodeMatches(first, hash)).toBe(true);
    expect(ticketCodeMatches(second, hash)).toBe(false);
  });
});

describe("timezones and calendar files", () => {
  it("stores UTC while rendering the university timezone", () => {
    const utc = zonedTimeToUtc({ year: 2026, month: 12, day: 1, hour: 18, minute: 0 }, "Africa/Lagos");
    expect(utc.toISOString()).toBe("2026-12-01T17:00:00.000Z");
    expect(eventDateKey(utc, "Africa/Lagos")).toBe("2026-12-01");
    expect(formatEventWhen(utc, new Date(utc.getTime() + 2 * 60 * 60 * 1000), "Africa/Lagos")).toContain("06:00");
  });

  it("emits an escaped, folded .ics and skips removed events", () => {
    const ics = buildIcs({
      now: new Date("2026-11-25T10:00:00.000Z"),
      calendarName: "My events, Konnekt",
      baseUrl: "https://konnekt.ng",
      events: [
        {
          id: "evt_1",
          title: "Robotics, demos & more",
          description: "Line one\nLine two",
          venueName: "Main; Auditorium",
          startsAt: "2026-12-01T17:00:00.000Z",
          endsAt: "2026-12-01T19:00:00.000Z",
          status: "SCHEDULED",
          url: "/events/evt_1",
        },
        {
          id: "evt_2",
          title: "Removed",
          description: "x",
          venueName: "x",
          startsAt: "2026-12-02T17:00:00.000Z",
          endsAt: "2026-12-02T19:00:00.000Z",
          status: "REMOVED",
        },
      ],
    });
    expect(ics).toContain("BEGIN:VCALENDAR");
    expect(ics).toContain("X-WR-CALNAME:My events\\, Konnekt");
    expect(ics).toContain("LOCATION:Main\\; Auditorium");
    expect(ics).toContain("Robotics\\, demos");
    expect(ics).toContain("DTSTART:20261201T170000Z");
    expect(ics).toContain("URL:https://konnekt.ng/events/evt_1");
    expect(ics).not.toContain("evt_2");
    expect(ics.endsWith("\r\n")).toBe(true);
    expect(icsFileName("Robotics Demo Night!")).toBe("robotics-demo-night.ics");
  });
});

describe("announcement rules", () => {
  const now = new Date("2026-11-25T12:00:00.000Z");

  it("only exposes published, in-audience announcements", () => {
    const base = {
      audienceKind: "PUBLIC" as const,
      audiencePath: ["PUBLIC"],
      status: "PUBLISHED" as const,
      publishedAt: new Date("2026-11-25T09:00:00.000Z"),
      publishAt: new Date("2026-11-25T09:00:00.000Z"),
    };
    expect(canSeeAnnouncement(path, base, now)).toBe(true);
    expect(canSeeAnnouncement(path, { ...base, status: "SCHEDULED" }, now)).toBe(false);
    expect(canSeeAnnouncement(path, { ...base, publishedAt: new Date("2026-11-26T09:00:00.000Z") }, now)).toBe(false);
    expect(canSeeAnnouncement(path, { ...base, audiencePath: [UNI, "other"] }, now)).toBe(false);
    expect(visibleAnnouncementFilter(path, now).OR).toHaveLength(path.length);
  });

  it("validates schedules, critical limits and PDF attachments", () => {
    expect(scheduleError(new Date("2026-11-25T13:00:00.000Z"), now)).toBeNull();
    expect(scheduleError(new Date("2026-11-25T11:00:00.000Z"), now)).not.toBeNull();
    expect(scheduleError(new Date("2027-01-01T12:00:00.000Z"), now)).toMatch(/30 days/);
    expect(resolveAnnouncementStatus({ publishNow: true, publishAt: now, now }).status).toBe("PUBLISHED");
    expect(resolveAnnouncementStatus({ publishNow: false, publishAt: new Date("2026-11-26T09:00:00.000Z"), now }).status).toBe("SCHEDULED");
    expect(announcementAttachmentError({ count: 4, mimeType: "application/pdf", sizeBytes: 10 })).not.toBeNull();
    expect(announcementAttachmentError({ count: 1, mimeType: "image/png", sizeBytes: 10 })).not.toBeNull();
    expect(announcementAttachmentError({ count: 1, mimeType: "application/pdf", sizeBytes: 11 * 1024 * 1024 })).not.toBeNull();
    expect(announcementAttachmentError({ count: 1, mimeType: "application/pdf", sizeBytes: 1024 })).toBeNull();
  });
});

describe("official account rules", () => {
  it("keeps posting and critical rights server-enforced", () => {
    expect(canPublishAsOfficial({ userId: "u1", isUniversityAdmin: false, isUniversityModerator: false, staff: null, isActiveStaff: false }, { status: "ACTIVE" })).toBe(false);
    expect(
      canPublishAsOfficial(
        { userId: "u1", isUniversityAdmin: false, isUniversityModerator: false, staff: { canPublishCritical: false }, isActiveStaff: true },
        { status: "ACTIVE" },
      ),
    ).toBe(true);
    expect(
      canPublishCritical(
        { userId: "u1", isUniversityAdmin: false, isUniversityModerator: false, staff: { canPublishCritical: false }, isActiveStaff: true },
        { status: "ACTIVE" },
      ),
    ).toBe(false);
    expect(canPublishAsOfficial({ userId: "u1", isUniversityAdmin: true, isUniversityModerator: false, staff: null, isActiveStaff: false }, { status: "SUSPENDED" })).toBe(false);
    expect(normalizeOfficialName("Nova  ICT!!")).toBe("novaict");
    expect(officialNameError("A")).not.toBeNull();
  });
});

describe("event creation validation", () => {
  it("rejects bad windows, capacity and audiences without touching the database", () => {
    const startsAt = new Date(Date.now() + 60 * 60 * 1000);
    const base = {
      title: "Demo night",
      description: "Come and see.",
      venueName: "Main Hall",
      startsAt,
      endsAt: new Date(startsAt.getTime() + 60 * 60 * 1000),
      capacity: 50,
    };
    expect(validateEventForCreation(base)).toBeNull();
    expect(validateEventForCreation({ ...base, title: "a" })).not.toBeNull();
    expect(validateEventForCreation({ ...base, endsAt: startsAt })).not.toBeNull();
    expect(validateEventForCreation({ ...base, capacity: 0 })).not.toBeNull();
    expect(audienceIsOnViewerPath(path, "PUBLIC", ["PUBLIC"])).toBe(true);
  });
});

describe("Phase 3 gap checks — time boundaries", () => {
  it("formats events that cross midnight with both local dates", () => {
    const startsAt = new Date("2026-12-01T22:30:00.000Z"); // 23:30 Lagos
    const endsAt = new Date("2026-12-02T01:30:00.000Z"); // 02:30 next day Lagos
    expect(eventDateKey(startsAt, "Africa/Lagos")).toBe("2026-12-01");
    expect(eventDateKey(endsAt, "Africa/Lagos")).toBe("2026-12-02");
    const when = formatEventWhen(startsAt, endsAt, "Africa/Lagos");
    expect(when).toContain("1 Dec 2026");
    expect(when).toContain("2 Dec 2026");
    expect(when).toContain("11:30");
    expect(when).toContain("02:30");
  });

  it("opens check-in exactly two hours before and closes exactly at the end", () => {
    const event = { startsAt: "2026-12-01T14:00:00.000Z", endsAt: "2026-12-01T18:00:00.000Z" };
    expect(checkInWindow(event, new Date("2026-12-01T11:59:59.999Z")).open).toBe(false);
    expect(checkInWindow(event, new Date("2026-12-01T12:00:00.000Z")).open).toBe(true);
    expect(checkInWindow(event, new Date("2026-12-01T17:59:59.999Z")).open).toBe(true);
    expect(checkInWindow(event, new Date("2026-12-01T18:00:00.000Z")).open).toBe(true);
    expect(checkInWindow(event, new Date("2026-12-01T18:00:00.001Z")).open).toBe(false);
  });

  it("allows exactly 14 days, rejects longer events and past starts", () => {
    const now = new Date("2026-12-01T12:00:00.000Z");
    const startsAt = new Date("2026-12-02T12:00:00.000Z");
    const fourteenDays = new Date(startsAt.getTime() + 14 * 24 * 60 * 60 * 1000);
    expect(validateEventWindow({ startsAt, endsAt: fourteenDays, now })).toBeNull();
    expect(
      validateEventWindow({ startsAt, endsAt: new Date(fourteenDays.getTime() + 1), now }),
    ).toMatch(/14 days/);
    expect(validateEventWindow({ startsAt: now, endsAt: fourteenDays, now })).toMatch(/future/);
  });
});
