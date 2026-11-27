/**
 * Phase 3 development seed: official accounts, campus places, events, RSVPs and
 * announcements. Non-production only; seed.ts gates this module with
 * assertSeedAllowed(). Deterministic ids make the Playwright fixtures stable.
 */
import type { PrismaClient } from "@prisma/client";

interface Author {
  id: string;
  fullName: string;
}

export async function seedEvents(
  db: PrismaClient,
  input: { universityId: string; adminId: string; reviewerId: string; demoAuthors: Author[] },
): Promise<void> {
  const existing = await db.event.count({ where: { universityId: input.universityId } });
  if (existing > 0) return;

  const now = Date.now();
  const hours = (value: number) => value * 60 * 60 * 1000;
  const timezone = "Africa/Lagos";

  const places = await Promise.all(
    [
      { id: "seed-place-auditorium", name: "Main Auditorium", latitude: 6.5244, longitude: 3.3792 },
      { id: "seed-place-library", name: "University Library", latitude: 6.5231, longitude: 3.3775 },
      { id: "seed-place-sports", name: "Sports Complex", latitude: 6.5202, longitude: 3.3811 },
    ].map((place) =>
      db.campusPlace.upsert({
        where: { universityId_name: { universityId: input.universityId, name: place.name } },
        create: { ...place, universityId: input.universityId },
        update: {},
      }),
    ),
  );

  const registrar = await db.officialAccount.upsert({
    where: { universityId_slug: { universityId: input.universityId, slug: "nova-registrar" } },
    create: {
      id: "seed-official-registrar",
      universityId: input.universityId,
      name: "Nova Registrar",
      nameNormalized: "novaregistrar",
      slug: "nova-registrar",
      category: "REGISTRY",
      description: "Official academic records, registration and examination notices from the Registrar's office.",
      status: "ACTIVE",
    },
    update: {},
  });
  const ict = await db.officialAccount.upsert({
    where: { universityId_slug: { universityId: input.universityId, slug: "nova-ict" } },
    create: {
      id: "seed-official-ict",
      universityId: input.universityId,
      name: "Nova ICT Service Desk",
      nameNormalized: "novaictservicedesk",
      slug: "nova-ict",
      category: "ICT",
      description: "Network maintenance, portal access and campus Wi-Fi updates.",
      status: "ACTIVE",
    },
    update: {},
  });
  await db.officialAccountStaff.upsert({
    where: { officialAccountId_userId: { officialAccountId: registrar.id, userId: input.adminId } },
    create: {
      universityId: input.universityId,
      officialAccountId: registrar.id,
      userId: input.adminId,
      canPublishCritical: true,
    },
    update: {},
  });
  await db.officialAccountStaff.upsert({
    where: { officialAccountId_userId: { officialAccountId: ict.id, userId: input.reviewerId } },
    create: {
      universityId: input.universityId,
      officialAccountId: ict.id,
      userId: input.reviewerId,
      canPublishCritical: false,
    },
    update: {},
  });

  const community = await db.community.findFirst({
    where: { universityId: input.universityId, name: "Software Engineering Hub" },
    select: { id: true },
  });
  const [verified, levelmate, otherLevel, otherDept, courseRep] = input.demoAuthors;

  async function createEvent(data: {
    id: string;
    title: string;
    description: string;
    category: "TECH" | "ACADEMIC" | "PARTY" | "SPORTS" | "SEMINAR" | "CULTURAL" | "MEETUP";
    startsAt: Date;
    endsAt: Date;
    venue: string;
    placeId?: string;
    capacity?: number;
    organiserKind: "USER" | "COMMUNITY" | "OFFICIAL";
    creatorId: string;
    communityId?: string;
    officialAccountId?: string;
    audienceKind: "PUBLIC" | "DEPARTMENT" | "LEVEL" | "COMMUNITY";
    audiencePath: string[];
    checkInEnabled?: boolean;
    allowOutsideSharing?: boolean;
    going: Array<{ userId: string; status?: "GOING" | "INTERESTED" | "WAITLISTED"; showPublicly?: boolean }>;
    checkedIn?: string[];
  }) {
    const event = await db.event.create({
      data: {
        id: data.id,
        universityId: input.universityId,
        createdById: data.creatorId,
        organiserKind: data.organiserKind,
        communityId: data.communityId ?? null,
        officialAccountId: data.officialAccountId ?? null,
        audienceKind: data.audienceKind,
        audiencePath: data.audiencePath,
        title: data.title,
        description: data.description,
        category: data.category,
        startsAt: data.startsAt,
        endsAt: data.endsAt,
        timezone,
        venueName: data.venue,
        placeId: data.placeId ?? null,
        capacity: data.capacity ?? null,
        waitlistEnabled: true,
        checkInEnabled: data.checkInEnabled ?? true,
        allowOutsideSharing: data.allowOutsideSharing ?? false,
      },
    });
    if (data.going.length > 0) {
      await db.eventRsvp.createMany({
        data: data.going.map((entry) => ({
          universityId: input.universityId,
          eventId: event.id,
          userId: entry.userId,
          status: entry.status ?? "GOING",
          showPublicly: entry.showPublicly ?? true,
        })),
        skipDuplicates: true,
      });
    }
    const goingCount = data.going.filter((entry) => (entry.status ?? "GOING") === "GOING").length;
    const interestedCount = data.going.filter((entry) => entry.status === "INTERESTED").length;
    const waitlistCount = data.going.filter((entry) => entry.status === "WAITLISTED").length;
    const checkedInCount = data.checkedIn?.length ?? 0;
    if (checkedInCount > 0) {
      await db.eventCheckIn.createMany({
        data: data.checkedIn!.map((userId) => ({
          universityId: input.universityId,
          eventId: event.id,
          userId,
          scannedById: data.creatorId,
          method: "QR" as const,
          clientScanId: `seed-${event.id}-${userId}`.slice(0, 100),
        })),
        skipDuplicates: true,
      });
    }
    await db.event.update({
      where: { id: event.id },
      data: { goingCount, interestedCount, waitlistCount, checkedInCount },
    });
    return event;
  }

  const swePublicPath = ["PUBLIC"];
  const liveStart = new Date(now - hours(1));
  const liveEnd = new Date(now + hours(2));
  await createEvent({
    id: "seed-event-live",
    title: "Robotics Demo Night",
    description:
      "Final-year teams are showing their robots, from line followers to a voice-controlled arm. Walk in, ask questions and vote for the audience award.\n\nDoors close at 7:30pm sharp because the auditorium is shared with evening lectures.",
    category: "TECH",
    startsAt: liveStart,
    endsAt: liveEnd,
    venue: "Main Auditorium",
    placeId: places[0]!.id,
    capacity: 120,
    organiserKind: "COMMUNITY",
    creatorId: verified!.id,
    communityId: community?.id ?? undefined,
    audienceKind: "PUBLIC",
    audiencePath: swePublicPath,
    going: [
      { userId: verified!.id },
      { userId: levelmate!.id },
      { userId: otherLevel!.id },
      { userId: otherDept!.id },
    ],
    checkedIn: [verified!.id],
  });

  await createEvent({
    id: "seed-event-upcoming",
    title: "Engineering Career Fair",
    description:
      "Meet recruiters from 20 companies hiring interns and graduates in engineering, product and data. Bring printed CVs; the deadline to register is Friday.",
    category: "SEMINAR",
    startsAt: new Date(now + hours(48)),
    endsAt: new Date(now + hours(54)),
    venue: "Sports Complex",
    placeId: places[2]!.id,
    capacity: 300,
    organiserKind: "OFFICIAL",
    creatorId: input.adminId,
    officialAccountId: registrar.id,
    audienceKind: "PUBLIC",
    audiencePath: swePublicPath,
    allowOutsideSharing: true,
    going: [
      { userId: verified!.id },
      { userId: levelmate!.id },
      { userId: courseRep!.id },
      { userId: otherDept!.id, status: "INTERESTED" },
    ],
  });

  await createEvent({
    id: "seed-event-swe",
    title: "SWE Project Clinic",
    description:
      "Bring your side project, coursework or final-year idea. Senior students and two alumni review your architecture and give honest feedback in 15-minute slots.",
    category: "ACADEMIC",
    startsAt: new Date(now + hours(72)),
    endsAt: new Date(now + hours(75)),
    venue: "University Library",
    placeId: places[1]!.id,
    capacity: 40,
    organiserKind: "USER",
    creatorId: levelmate!.id,
    audienceKind: "PUBLIC",
    audiencePath: swePublicPath,
    going: [
      { userId: levelmate!.id },
      { userId: verified!.id },
      { userId: otherLevel!.id },
    ],
  });

  await createEvent({
    id: "seed-event-full",
    title: "Inter-Faculty Football Final",
    description: "Engineering against Law under the lights. Come early for a seat and stay for the trophy presentation.",
    category: "SPORTS",
    startsAt: new Date(now + hours(96)),
    endsAt: new Date(now + hours(99)),
    venue: "Sports Complex",
    placeId: places[2]!.id,
    capacity: 2,
    organiserKind: "USER",
    creatorId: otherDept!.id,
    audienceKind: "PUBLIC",
    audiencePath: swePublicPath,
    going: [
      { userId: verified!.id },
      { userId: levelmate!.id },
      { userId: otherLevel!.id, status: "WAITLISTED" },
    ],
  });

  await createEvent({
    id: "seed-event-past",
    title: "Freshers' Welcome Mixer",
    description: "The first mixer of the semester, with music, games and a very competitive quiz.",
    category: "PARTY",
    startsAt: new Date(now - hours(240)),
    endsAt: new Date(now - hours(236)),
    venue: "Main Auditorium",
    placeId: places[0]!.id,
    organiserKind: "USER",
    creatorId: verified!.id,
    audienceKind: "PUBLIC",
    audiencePath: swePublicPath,
    going: [{ userId: verified!.id }, { userId: otherLevel!.id }],
    checkedIn: [verified!.id],
  });

  await createEvent({
    id: "seed-event-scanner",
    title: "Live Check-in Lab",
    description: "A live event used to review the organiser dashboard, scanner and ticket states.",
    category: "TECH",
    startsAt: liveStart,
    endsAt: liveEnd,
    venue: "University Library",
    placeId: places[1]!.id,
    capacity: 80,
    organiserKind: "USER",
    creatorId: verified!.id,
    audienceKind: "PUBLIC",
    audiencePath: swePublicPath,
    going: [
      { userId: verified!.id },
      { userId: levelmate!.id },
      { userId: otherLevel!.id },
    ],
  });

  await createEvent({
    id: "seed-event-joinable",
    title: "Open Campus Picnic",
    description: "A public picnic the demo student has not RSVP'd to yet.",
    category: "MEETUP",
    startsAt: new Date(now + hours(192)),
    endsAt: new Date(now + hours(195)),
    venue: "Sports Complex",
    placeId: places[2]!.id,
    capacity: 100,
    organiserKind: "USER",
    creatorId: levelmate!.id,
    audienceKind: "PUBLIC",
    audiencePath: swePublicPath,
    going: [{ userId: levelmate!.id }],
  });

  await createEvent({
    id: "seed-event-waitlist",
    title: "Sold-out Robotics Tour",
    description: "A one-seat tour that is already full, used to review the waitlist state.",
    category: "TECH",
    startsAt: new Date(now + hours(200)),
    endsAt: new Date(now + hours(202)),
    venue: "University Library",
    placeId: places[1]!.id,
    capacity: 1,
    organiserKind: "USER",
    creatorId: levelmate!.id,
    audienceKind: "PUBLIC",
    audiencePath: swePublicPath,
    going: [{ userId: levelmate!.id }],
  });

  const cancelled = await createEvent({
    id: "seed-event-cancelled",
    title: "Cancelled: Hallowe'en Costume Parade",
    description: "This event was cancelled after the venue withdrew permission.",
    category: "CULTURAL",
    startsAt: new Date(now + hours(120)),
    endsAt: new Date(now + hours(123)),
    venue: "Main Auditorium",
    placeId: places[0]!.id,
    organiserKind: "USER",
    creatorId: verified!.id,
    audienceKind: "PUBLIC",
    audiencePath: swePublicPath,
    going: [],
  });
  await db.event.update({
    where: { id: cancelled.id },
    data: {
      status: "CANCELLED",
      cancelledAt: new Date(now - hours(2)),
      cancelReason: "The venue withdrew permission, so the parade is cancelled.",
    },
  });

  const updated = await createEvent({
    id: "seed-event-updated",
    title: "Updated: Design Systems Workshop",
    description: "A hands-on workshop moved to a larger room and a later start time.",
    category: "TECH",
    startsAt: new Date(now + hours(144)),
    endsAt: new Date(now + hours(147)),
    venue: "University Library",
    placeId: places[1]!.id,
    capacity: 60,
    organiserKind: "USER",
    creatorId: verified!.id,
    audienceKind: "PUBLIC",
    audiencePath: swePublicPath,
    going: [{ userId: verified!.id }, { userId: levelmate!.id }],
  });
  await db.event.update({
    where: { id: updated.id },
    data: {
      lastMaterialChangeAt: new Date(now - hours(1)),
      materialChanges: [
        {
          at: new Date(now - hours(1)).toISOString(),
          fields: ["time", "venue"],
          previous: { startsAt: new Date(now + hours(140)).toISOString(), venueName: "Main Auditorium" },
        },
      ],
    },
  });

  await createEvent({
    id: "seed-event-private",
    title: "Private: Committee Planning",
    description: "A private planning session that must not leak through a public share card.",
    category: "MEETUP",
    startsAt: new Date(now + hours(168)),
    endsAt: new Date(now + hours(170)),
    venue: "University Library",
    placeId: places[1]!.id,
    capacity: 20,
    organiserKind: "USER",
    creatorId: verified!.id,
    audienceKind: "PUBLIC",
    audiencePath: swePublicPath,
    allowOutsideSharing: false,
    going: [{ userId: verified!.id }],
  });

  const announcements = [
    {
      id: "seed-announcement-registration",
      accountId: registrar.id,
      authorId: input.adminId,
      category: "ACADEMIC" as const,
      title: "Course registration closes Friday at 5pm",
      body:
        "Registration for the second semester closes on Friday at 5pm. Courses you have not registered for will not appear on your result sheet.\n\nIf your portal shows a department change that you did not request, visit the Registry help desk in the Admin Block before Thursday.\n\nThere is no late registration window this semester.",
      critical: true,
      audiencePath: ["PUBLIC"],
      publishedAt: new Date(now - hours(6)),
    },
    {
      id: "seed-announcement-wifi",
      accountId: ict.id,
      authorId: input.reviewerId,
      category: "ICT" as const,
      title: "Campus Wi-Fi maintenance on Saturday",
      body:
        "The campus network will be offline from 6am to 10am on Saturday while we replace a core switch. Hostel and library access may drop intermittently.\n\nUse mobile data for urgent submissions and check back after 10am.",
      critical: false,
      audiencePath: ["PUBLIC"],
      publishedAt: new Date(now - hours(24)),
    },
    {
      id: "seed-announcement-scholarship",
      accountId: registrar.id,
      authorId: input.adminId,
      category: "STUDENT_AFFAIRS" as const,
      title: "Vice-Chancellor's scholarship applications are open",
      body:
        "Applications for the VC scholarship close on the 30th. You need a CGPA of 4.0 or above, a short statement and one academic reference.\n\nDownload the form from the student portal and submit it to Student Affairs.",
      critical: false,
      audiencePath: ["PUBLIC"],
      publishedAt: new Date(now - hours(48)),
    },
  ];
  for (const announcement of announcements) {
    await db.announcement.create({
      data: {
        id: announcement.id,
        universityId: input.universityId,
        officialAccountId: announcement.accountId,
        authorId: announcement.authorId,
        category: announcement.category,
        title: announcement.title,
        body: announcement.body,
        critical: announcement.critical,
        audienceKind: "PUBLIC",
        audiencePath: announcement.audiencePath,
        status: "PUBLISHED",
        publishAt: announcement.publishedAt,
        publishedAt: announcement.publishedAt,
      },
    });
  }

  // A critical notice must be downloadable, not just text.
  const attachment = await db.announcementAttachment.findFirst({
    where: { announcementId: "seed-announcement-registration" },
  });
  if (!attachment) {
    await db.announcementAttachment.create({
      data: {
        universityId: input.universityId,
        announcementId: "seed-announcement-registration",
        fileKey: "seed/registration-checklist.pdf",
        name: "Second-semester registration checklist.pdf",
        mimeType: "application/pdf",
        sizeBytes: 184_320,
      },
    });
  }

  // Varied covers: one shared category colour made every event look the same.
  const covers = [
    "/seed/tech-summit.svg",
    "/seed/lecture-hall.svg",
    "/seed/engineering-lab.svg",
    "/seed/football-pitch.svg",
    "/seed/study-group.svg",
    "/seed/campus-quad.svg",
  ];
  const seededEvents = await db.event.findMany({
    where: { universityId: input.universityId },
    select: { id: true },
    orderBy: { startsAt: "asc" },
  });
  for (const [index, event] of seededEvents.entries()) {
    await db.event.update({
      where: { id: event.id },
      data: { coverPublicId: covers[index % covers.length]! },
    });
  }
}
