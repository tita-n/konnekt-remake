/**
 * Minimal deterministic Playwright fixture. This is deliberately separate from
 * the Nova demo seed: e2e only gets the academic tree, accounts and one feed
 * post that the specs depend on. It refuses production and requires the
 * dedicated e2e database guard.
 */
import { createHash } from "node:crypto";
import { PrismaClient, type Prisma } from "@prisma/client";
import { hash } from "@node-rs/argon2";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { assertSeedAllowed, DEMO_PASSWORD } from "./seed-guard";
import { assertSafeE2EDatabase } from "../scripts/e2e-guard";

try {
  assertSeedAllowed();
  assertSafeE2EDatabase({
    e2eUrl: process.env.E2E_DATABASE_URL,
    devUrl: process.env.DEV_DATABASE_URL ?? process.env.DATABASE_URL,
    allowRemote: process.env.E2E_ALLOW_REMOTE === "1",
  });
} catch (error) {
  console.error(error instanceof Error ? error.message : "Refusing to seed e2e.");
  process.exit(1);
}

const db = new PrismaClient();
const ACCENT = "#4F46E5";
const FIXTURE_CREATED = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000);

interface NodeSeed {
  key: string;
  name: string;
  type: "COLLEGE" | "FACULTY" | "DEPARTMENT";
  levels?: number[];
  parent: string | null;
}

const NODES: NodeSeed[] = [
  { key: "engineering", name: "Engineering", type: "COLLEGE", parent: null },
  { key: "computing", name: "Computing and Technology", type: "FACULTY", parent: "engineering" },
  { key: "swe", name: "Software Engineering", type: "DEPARTMENT", parent: "computing", levels: [100, 200, 300, 400, 500] },
  { key: "mech", name: "Mechanical Engineering", type: "DEPARTMENT", parent: "computing", levels: [100, 200, 300, 400, 500] },
  { key: "law-college", name: "Law", type: "COLLEGE", parent: null },
  { key: "law-faculty", name: "Faculty of Law", type: "FACULTY", parent: "law-college" },
  { key: "law", name: "Law", type: "DEPARTMENT", parent: "law-faculty", levels: [100, 200, 300, 400, 500] },
];

function slugify(value: string): string {
  return value.toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

async function pendingIdImage(): Promise<string> {
  const dir = path.join(process.cwd(), ".private-media");
  await mkdir(dir, { recursive: true });
  const id = "e2e-emeka-id";
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="900" height="560">
    <rect width="900" height="560" fill="#eef0ff"/>
    <rect x="24" y="24" width="852" height="512" rx="24" fill="#ffffff" stroke="#d5d7e2" stroke-width="4"/>
    <rect x="24" y="24" width="852" height="128" rx="24" fill="#4f46e5"/>
    <text x="60" y="92" font-family="sans-serif" font-size="34" font-weight="700" fill="#ffffff">NOVA UNIVERSITY</text>
    <text x="60" y="128" font-family="sans-serif" font-size="20" fill="#e0e7ff">E2E VERIFICATION FIXTURE</text>
    <text x="284" y="232" font-family="sans-serif" font-size="28" font-weight="700" fill="#12141a">Emeka Nwosu</text>
    <text x="284" y="276" font-family="sans-serif" font-size="22" fill="#5b6270">Matric: ACC/2024/2210</text>
    <text x="284" y="316" font-family="sans-serif" font-size="22" fill="#5b6270">Accounting · 200 level</text>
  </svg>`;
  const jpeg = await sharp(Buffer.from(svg)).jpeg({ quality: 82 }).toBuffer();
  await writeFile(path.join(dir, `${id}.jpg`), jpeg, { mode: 0o600 });
  return `local:${id}`;
}

async function main() {
  const university = await db.university.upsert({
    where: { slug: "nova-university" },
    update: {
      name: "Nova University",
      shortName: "Nova",
      status: "ACTIVE",
      accentColor: ACCENT,
      studentEmailDomains: ["student.nova.edu.ng", "nova.edu.ng"],
      idCardEnabled: true,
      vouchingEnabled: true,
      matricPattern: "^[A-Z]{2,4}/\\d{4}/\\d{3,4}$",
      labels: { college: "College", faculty: "Faculty", department: "Department" },
      featureFlags: { campusVoice: false, communities: true, events: true, messaging: false },
    },
    create: {
      name: "Nova University",
      shortName: "Nova",
      slug: "nova-university",
      status: "ACTIVE",
      accentColor: ACCENT,
      studentEmailDomains: ["student.nova.edu.ng", "nova.edu.ng"],
      idCardEnabled: true,
      vouchingEnabled: true,
      matricPattern: "^[A-Z]{2,4}/\\d{4}/\\d{3,4}$",
      labels: { college: "College", faculty: "Faculty", department: "Department" },
      featureFlags: { campusVoice: false, communities: true, events: true, messaging: false },
    },
  });

  const nodes = new Map<string, { id: string; path: string }>();
  for (const node of NODES) {
    const parent = node.parent ? nodes.get(node.parent) : null;
    const parentPath = parent?.path ?? "";
    const slug = slugify(node.name);
    const record = await db.academicNode.upsert({
      where: {
        universityId_parentPath_slug: { universityId: university.id, parentPath, slug },
      },
      update: {
        name: node.name,
        type: node.type,
        levels: node.levels ?? [],
        isActive: true,
        path: parentPath,
        parentId: parent?.id ?? null,
      },
      create: {
        universityId: university.id,
        parentId: parent?.id ?? null,
        type: node.type,
        name: node.name,
        slug,
        path: parentPath,
        parentPath,
        levels: node.levels ?? [],
      },
    });
    nodes.set(node.key, { id: record.id, path: parentPath ? `${parentPath}/${record.id}` : record.id });
  }

  const swePath = [university.id, nodes.get("engineering")!.id, nodes.get("computing")!.id, nodes.get("swe")!.id];
  const lawPath = [university.id, nodes.get("law-college")!.id, nodes.get("law-faculty")!.id, nodes.get("law")!.id];
  const passwordHash = await hash(DEMO_PASSWORD, {
    algorithm: 2,
    memoryCost: 19456,
    timeCost: 2,
    parallelism: 1,
    outputLen: 32,
  });

  async function account(input: {
    email: string;
    username: string;
    fullName: string;
    status: "VERIFIED" | "PENDING";
    departmentKey: string;
    level: number;
    matric?: string;
    bio?: string;
    role?: "PLATFORM_ADMIN" | "UNIVERSITY_ADMIN" | "REVIEWER";
    roleUniversityId?: string | null;
  }) {
    const data: Prisma.UserUncheckedCreateInput = {
      universityId: university.id,
      email: input.email,
      emailVerified: true,
      username: input.username,
      passwordHash,
      fullName: input.fullName,
      status: input.status,
      bio: input.bio ?? null,
      matricNumber: input.matric ?? null,
      matricNormalized: input.matric?.toUpperCase() ?? null,
      departmentNodeId: nodes.get(input.departmentKey)!.id,
      level: input.level,
      interests: input.status === "VERIFIED" ? ["Coding", "Design"] : [],
      consentPolicyVersion: "2026-01-01",
      consentAcceptedAt: new Date(),
      // Deterministic account age: community creation requires 24 hours.
      createdAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
      onboardingCompletedAt: new Date(),
      verifiedAt: input.status === "VERIFIED" ? new Date() : null,
    };
    const user = await db.user.upsert({
      where: { email: input.email },
      update: {
        fullName: input.fullName,
        status: input.status,
        departmentNodeId: data.departmentNodeId,
        level: data.level,
        matricNumber: data.matricNumber,
        matricNormalized: data.matricNormalized,
        bio: data.bio,
        passwordHash,
        emailVerified: true,
        onboardingCompletedAt: data.onboardingCompletedAt,
      },
      create: data,
    });
    if (input.role) {
      const roleUniversityId = input.roleUniversityId === undefined ? university.id : input.roleUniversityId;
      const existing = await db.roleAssignment.findFirst({
        where: { userId: user.id, role: input.role, universityId: roleUniversityId ?? null },
      });
      if (!existing) {
        await db.roleAssignment.create({
          data: { userId: user.id, role: input.role, universityId: roleUniversityId ?? null, grantedBy: null },
        });
      }
    }
    return user;
  }

  const platform = await account({
    email: "admin@konnekt.ng",
    username: "konnekt_admin",
    fullName: "Platform Administrator",
    status: "VERIFIED",
    departmentKey: "swe",
    level: 500,
    role: "PLATFORM_ADMIN",
    roleUniversityId: null,
  });
  const admin = await account({
    email: "admin@nova.edu.ng",
    username: "nova_admin",
    fullName: "Funke Adebayo",
    status: "VERIFIED",
    departmentKey: "swe",
    level: 400,
    role: "UNIVERSITY_ADMIN",
  });
  const reviewer = await account({
    email: "reviewer@nova.edu.ng",
    username: "nova_reviewer",
    fullName: "Bola Ogunleye",
    status: "VERIFIED",
    departmentKey: "law",
    level: 400,
    role: "REVIEWER",
  });
  const student = await account({
    email: "student@nova.edu.ng",
    username: "chinedu_okafor",
    fullName: "Chinedu Okafor",
    status: "VERIFIED",
    departmentKey: "swe",
    level: 300,
    matric: "SWE/2023/0564",
    bio: "Software Engineering 300L at Nova University.",
  });
  const levelmate = await account({
    email: "levelmate@nova.edu.ng",
    username: "aisha_bello",
    fullName: "Aisha Bello",
    status: "VERIFIED",
    departmentKey: "swe",
    level: 300,
    matric: "SWE/2023/0021",
  });
  const otherDept = await account({
    email: "otherdept@nova.edu.ng",
    username: "ngozi_eze",
    fullName: "Ngozi Eze",
    status: "VERIFIED",
    departmentKey: "mech",
    level: 300,
    matric: "MEC/2023/0775",
  });
  const otherLevel = await account({
    email: "otherlevel@nova.edu.ng",
    username: "tunde_adeyemi",
    fullName: "Tunde Adeyemi",
    status: "VERIFIED",
    departmentKey: "swe",
    level: 400,
    matric: "SWE/2022/1187",
  });
  const otherCollege = await account({
    email: "othercollege@nova.edu.ng",
    username: "ibrahim_musa",
    fullName: "Ibrahim Musa",
    status: "VERIFIED",
    departmentKey: "law",
    level: 300,
    matric: "LAW/2023/0190",
  });
  const pending = await account({
    email: "pending@nova.edu.ng",
    username: "emeka_nwosu",
    fullName: "Emeka Nwosu",
    status: "PENDING",
    departmentKey: "swe",
    level: 200,
    matric: "ACC/2024/2210",
  });

  const pendingRequest = await db.verificationRequest.findFirst({
    where: { userId: pending.id, status: "PENDING" },
  });
  if (!pendingRequest) {
    await db.verificationRequest.create({
      data: {
        userId: pending.id,
        universityId: university.id,
        method: "ID_CARD",
        matricNumber: "ACC/2024/2210",
        matricNormalized: "ACC/2024/2210",
        idImageRef: await pendingIdImage(),
        status: "PENDING",
      },
    });
  }

  const welcomePost = await db.post.upsert({
    where: { idempotencyKey: "e2e-feed-welcome" },
    update: {},
    create: {
      universityId: university.id,
      authorId: levelmate.id,
      type: "POST",
      body: "Welcome to the deterministic e2e campus feed. Everything here is test data. #NovaWelcome",
      audiencePath: swePath,
      audienceKind: "DEPARTMENT",
      status: "ACTIVE",
      idempotencyKey: "e2e-feed-welcome",
    },
  });

  // The Pulse shell renders the trending strip only when visible posts carry
  // hashtags in the last 48 hours, so seed one deterministic tag.
  const hashtag = await db.hashtag.upsert({
    where: { universityId_tag: { universityId: university.id, tag: "novawelcome" } },
    update: {},
    create: { universityId: university.id, tag: "novawelcome" },
  });
  await db.postHashtag.upsert({
    where: { postId_hashtagId: { postId: welcomePost.id, hashtagId: hashtag.id } },
    update: {},
    create: { universityId: university.id, postId: welcomePost.id, hashtagId: hashtag.id },
  });

  await db.post.upsert({
    where: { idempotencyKey: "e2e-public-preview" },
    update: {},
    create: {
      universityId: university.id,
      authorId: student.id,
      type: "POST",
      body: "A public line that may be blurred on a share card, never attributed.",
      audiencePath: ["PUBLIC"],
      audienceKind: "PUBLIC",
      status: "ACTIVE",
      idempotencyKey: "e2e-public-preview",
    },
  });

  // Phase 3 fixtures: one event the student already joined and one open event,
  // plus an official critical notice the student has not acknowledged.
  const e2ePlace = await db.campusPlace.upsert({
    where: { universityId_name: { universityId: university.id, name: "E2E Main Hall" } },
    update: {},
    create: { universityId: university.id, name: "E2E Main Hall", latitude: 6.52, longitude: 3.37 },
  });
  const e2eEvent = await db.event.upsert({
    where: { id: "e2e-event-robotics" },
    update: {},
    create: {
      id: "e2e-event-robotics",
      universityId: university.id,
      createdById: student.id,
      organiserKind: "USER",
      audienceKind: "PUBLIC",
      audiencePath: ["PUBLIC"],
      title: "E2E Robotics Night",
      createdAt: FIXTURE_CREATED,
      description: "Deterministic event fixture for check-in and ticket flows.",
      category: "TECH",
      startsAt: new Date(Date.now() - 30 * 60 * 1000),
      endsAt: new Date(Date.now() + 2 * 60 * 60 * 1000),
      timezone: "Africa/Lagos",
      venueName: "E2E Main Hall",
      placeId: e2ePlace.id,
      capacity: 50,
      waitlistEnabled: true,
      checkInEnabled: true,
      goingCount: 3,
    },
  });
  await db.eventRsvp.upsert({
    where: { eventId_userId: { eventId: e2eEvent.id, userId: student.id } },
    update: {},
    create: { universityId: university.id, eventId: e2eEvent.id, userId: student.id, status: "GOING" },
  });
  // Two more attendees with fixed ticket codes let the scanner spec prove a
  // real, idempotent check-in and an offline replay without reading a QR image.
  const checkinHash = createHash("sha256").update("E2E_CHECKIN_TICKET_ALPHA_0001").digest("hex");
  const offlineHash = createHash("sha256").update("E2E_OFFLINE_TICKET_BRAVO_0001").digest("hex");
  for (const [attendee, codeHash] of [
    [levelmate, checkinHash],
    [otherLevel, offlineHash],
  ] as const) {
    await db.eventRsvp.upsert({
      where: { eventId_userId: { eventId: e2eEvent.id, userId: attendee.id } },
      update: {},
      create: { universityId: university.id, eventId: e2eEvent.id, userId: attendee.id, status: "GOING" },
    });
    await db.eventTicket.upsert({
      where: { codeHash },
      update: {},
      create: { universityId: university.id, eventId: e2eEvent.id, userId: attendee.id, codeHash },
    });
  }
  await db.event.upsert({
    where: { id: "e2e-event-full" },
    update: {},
    create: {
      id: "e2e-event-full",
      universityId: university.id,
      createdById: levelmate.id,
      organiserKind: "USER",
      audienceKind: "PUBLIC",
      audiencePath: ["PUBLIC"],
      title: "E2E Full Workshop",
      description: "One seat only, with a waitlist, for the capacity flow.",
      category: "ACADEMIC",
      startsAt: new Date(Date.now() + 48 * 60 * 60 * 1000),
      endsAt: new Date(Date.now() + 50 * 60 * 60 * 1000),
      timezone: "Africa/Lagos",
      venueName: "E2E Main Hall",
      placeId: e2ePlace.id,
      capacity: 1,
      waitlistEnabled: true,
      goingCount: 1,
      waitlistCount: 1,
    },
  });
  await db.eventRsvp.upsert({
    where: { eventId_userId: { eventId: "e2e-event-full", userId: student.id } },
    update: {},
    create: { universityId: university.id, eventId: "e2e-event-full", userId: student.id, status: "GOING" },
  });
  await db.eventRsvp.upsert({
    where: { eventId_userId: { eventId: "e2e-event-full", userId: levelmate.id } },
    update: {},
    create: {
      universityId: university.id,
      eventId: "e2e-event-full",
      userId: levelmate.id,
      status: "WAITLISTED",
      waitlistPosition: 1,
    },
  });
  await db.event.upsert({
    where: { id: "e2e-event-updated" },
    update: {},
    create: {
      id: "e2e-event-updated",
      universityId: university.id,
      createdById: student.id,
      organiserKind: "USER",
      audienceKind: "PUBLIC",
      audiencePath: ["PUBLIC"],
      title: "E2E Updated Event",
      createdAt: FIXTURE_CREATED,
      description: "An event with a visible material change log.",
      category: "TECH",
      startsAt: new Date(Date.now() + 72 * 60 * 60 * 1000),
      endsAt: new Date(Date.now() + 74 * 60 * 60 * 1000),
      timezone: "Africa/Lagos",
      venueName: "E2E New Hall",
      placeId: e2ePlace.id,
      capacity: 40,
      lastMaterialChangeAt: new Date(Date.now() - 30 * 60 * 1000),
      materialChanges: [
        {
          at: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
          fields: ["time", "venue"],
          previous: { startsAt: new Date(Date.now() + 70 * 60 * 60 * 1000).toISOString(), venueName: "E2E Old Hall" },
        },
      ],
    },
  });
  await db.event.upsert({
    where: { id: "e2e-event-cancel" },
    update: {},
    create: {
      id: "e2e-event-cancel",
      universityId: university.id,
      createdById: student.id,
      organiserKind: "USER",
      audienceKind: "PUBLIC",
      audiencePath: ["PUBLIC"],
      title: "E2E Cancellable Event",
      createdAt: FIXTURE_CREATED,
      description: "An event the student organiser can cancel end-to-end.",
      category: "MEETUP",
      startsAt: new Date(Date.now() + 96 * 60 * 60 * 1000),
      endsAt: new Date(Date.now() + 98 * 60 * 60 * 1000),
      timezone: "Africa/Lagos",
      venueName: "E2E Main Hall",
      placeId: e2ePlace.id,
      capacity: 25,
    },
  });
  await db.event.upsert({
    where: { id: "e2e-event-private" },
    update: {},
    create: {
      id: "e2e-event-private",
      universityId: university.id,
      createdById: levelmate.id,
      organiserKind: "USER",
      audienceKind: "PUBLIC",
      audiencePath: ["PUBLIC"],
      title: "E2E Private Share Event",
      description: "This description must not leak through the public share card.",
      category: "MEETUP",
      startsAt: new Date(Date.now() + 120 * 60 * 60 * 1000),
      endsAt: new Date(Date.now() + 122 * 60 * 60 * 1000),
      timezone: "Africa/Lagos",
      venueName: "E2E Secret Hall",
      placeId: e2ePlace.id,
      capacity: 20,
      allowOutsideSharing: false,
    },
  });
  const community = await db.community.upsert({
    where: { universityId_slug: { universityId: university.id, slug: "e2e-robotics-club" } },
    update: {},
    create: {
      universityId: university.id,
      name: "E2E Robotics Club",
      nameNormalized: "e2eroboticsclub",
      slug: "e2e-robotics-club",
      description: "A deterministic community fixture.",
      category: "TECH",
      privacy: "REQUEST",
      status: "ACTIVE",
      createdById: admin.id,
      createdAt: FIXTURE_CREATED,
      allowMemberEvents: true,
      memberCount: 2,
    },
  });
  for (const member of [admin, student] as const) {
    await db.communityMember.upsert({
      where: { communityId_userId: { communityId: community.id, userId: member.id } },
      update: { status: "ACTIVE" },
      create: {
        universityId: university.id,
        communityId: community.id,
        userId: member.id,
        role: member.id === admin.id ? "OWNER" : "MEMBER",
        status: "ACTIVE",
      },
    });
  }
  await db.event.upsert({
    where: { id: "e2e-event-community" },
    update: {},
    create: {
      id: "e2e-event-community",
      universityId: university.id,
      createdById: admin.id,
      organiserKind: "COMMUNITY",
      communityId: community.id,
      audienceKind: "COMMUNITY",
      audiencePath: [],
      title: "E2E Community Meetup",
      description: "Members of the robotics club can see this; outsiders cannot.",
      category: "TECH",
      startsAt: new Date(Date.now() + 144 * 60 * 60 * 1000),
      endsAt: new Date(Date.now() + 146 * 60 * 60 * 1000),
      timezone: "Africa/Lagos",
      venueName: "E2E Main Hall",
      placeId: e2ePlace.id,
      capacity: 30,
    },
  });
  await db.event.upsert({
    where: { id: "e2e-event-open" },
    update: {},
    create: {
      id: "e2e-event-open",
      universityId: university.id,
      createdById: levelmate.id,
      organiserKind: "USER",
      audienceKind: "PUBLIC",
      audiencePath: ["PUBLIC"],
      title: "E2E Open Mic",
      description: "A deterministic event the student can RSVP to in e2e.",
      allowOutsideSharing: true,
      category: "CULTURAL",
      startsAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      endsAt: new Date(Date.now() + 26 * 60 * 60 * 1000),
      timezone: "Africa/Lagos",
      venueName: "E2E Main Hall",
      placeId: e2ePlace.id,
      capacity: 30,
      waitlistEnabled: true,
      checkInEnabled: true,
    },
  });
  const e2eOfficial = await db.officialAccount.upsert({
    where: { universityId_slug: { universityId: university.id, slug: "e2e-registrar" } },
    update: {},
    create: {
      universityId: university.id,
      name: "E2E Registrar",
      nameNormalized: "e2eregistrar",
      slug: "e2e-registrar",
      category: "REGISTRY",
      description: "E2E official account.",
      status: "ACTIVE",
    },
  });
  await db.officialAccountStaff.upsert({
    where: { officialAccountId_userId: { officialAccountId: e2eOfficial.id, userId: admin.id } },
    update: {},
    create: { universityId: university.id, officialAccountId: e2eOfficial.id, userId: admin.id, canPublishCritical: true },
  });
  await db.announcement.upsert({
    where: { id: "e2e-announcement-critical" },
    update: {},
    create: {
      id: "e2e-announcement-critical",
      universityId: university.id,
      officialAccountId: e2eOfficial.id,
      authorId: admin.id,
      category: "ACADEMIC",
      title: "E2E registration closes Friday",
      body: "A deterministic critical notice used to prove acknowledgement clears the banner.",
      critical: true,
      audienceKind: "PUBLIC",
      audiencePath: ["PUBLIC"],
      status: "PUBLISHED",
      publishAt: new Date(Date.now() - 60 * 60 * 1000),
      publishedAt: new Date(Date.now() - 60 * 60 * 1000),
    },
  });
  await db.announcement.upsert({
    where: { id: "e2e-announcement-swe" },
    update: {},
    create: {
      id: "e2e-announcement-swe",
      universityId: university.id,
      officialAccountId: e2eOfficial.id,
      authorId: admin.id,
      category: "ACADEMIC",
      title: "E2E Software Engineering departmental notice",
      body: "Only Software Engineering students should see this notice.",
      audienceKind: "DEPARTMENT",
      audiencePath: swePath,
      status: "PUBLISHED",
      publishAt: new Date(Date.now() - 60 * 60 * 1000),
      publishedAt: new Date(Date.now() - 60 * 60 * 1000),
    },
  });

  // Platform audit needs an actor; keep one harmless bootstrap entry.
  const audit = await db.auditLog.findFirst({
    where: { universityId: university.id, action: "e2e.seed" },
  });
  if (!audit) {
    await db.auditLog.create({
      data: {
        actorId: platform.id,
        universityId: university.id,
        action: "e2e.seed",
        targetType: "University",
        targetId: university.id,
        metadata: { fixture: true },
      },
    });
  }

  void admin;
  void reviewer;
  void lawPath;
  void otherDept;
  void otherCollege;
  console.log(`Seeded minimal e2e fixtures (${NODES.length} nodes, 8 students/staff, 2 feed posts).`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.$disconnect();
  });
