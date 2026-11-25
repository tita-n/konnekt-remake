/**
 * Development/staging seed. Refuses to run in production.
 *
 * Every account uses the password below and is clearly demo data:
 *   KonnektDemo123!
 */
import { PrismaClient, type Prisma } from "@prisma/client";
import { hash } from "@node-rs/argon2";
import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { assertSeedAllowed } from "./seed-guard";
import { seedSocialContent } from "./seed-social";
import { seedCommunities } from "./seed-communities";
import { seedEvents } from "./seed-events";

try {
  assertSeedAllowed();
} catch (error) {
  console.error(error instanceof Error ? error.message : "Refusing to seed.");
  process.exit(1);
}

const db = new PrismaClient();
const PASSWORD = "KonnektDemo123!";
const ACCENT = "#4F46E5";

async function passwordHash() {
  return hash(PASSWORD, { algorithm: 2, memoryCost: 19456, timeCost: 2, parallelism: 1, outputLen: 32 });
}

async function sampleIdImage(): Promise<string> {
  const dir = path.join(process.cwd(), ".private-media");
  await mkdir(dir, { recursive: true });
  const filename = `${randomUUID()}.jpg`;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="900" height="560">
    <rect width="900" height="560" fill="#eef0ff"/>
    <rect x="24" y="24" width="852" height="512" rx="24" fill="#ffffff" stroke="#d5d7e2" stroke-width="4"/>
    <rect x="24" y="24" width="852" height="128" rx="24" fill="#4f46e5"/>
    <text x="60" y="92" font-family="sans-serif" font-size="34" font-weight="700" fill="#ffffff">NOVA UNIVERSITY</text>
    <text x="60" y="128" font-family="sans-serif" font-size="20" fill="#e0e7ff">Verified Student Identity Card · Sample Document</text>
    <rect x="60" y="196" width="180" height="220" rx="16" fill="#eceef2"/>
    <circle cx="150" cy="276" r="46" fill="#b1a6ff"/>
    <rect x="96" y="338" width="108" height="52" rx="26" fill="#8e7cff"/>
    <text x="284" y="232" font-family="sans-serif" font-size="28" font-weight="700" fill="#12141a">Chinedu Okafor</text>
    <text x="284" y="276" font-family="sans-serif" font-size="22" fill="#5b6270">Matric: SWE/2023/0564</text>
    <text x="284" y="316" font-family="sans-serif" font-size="22" fill="#5b6270">Software Engineering · 300 level</text>
    <text x="284" y="356" font-family="sans-serif" font-size="22" fill="#5b6270">College of Engineering</text>
    <text x="60" y="492" font-family="monospace" font-size="20" fill="#6b7280">SAMPLE DOCUMENT — FOR DEVELOPMENT VERIFICATION</text>
  </svg>`;
  const jpeg = await sharp(Buffer.from(svg)).jpeg({ quality: 82 }).toBuffer();
  await writeFile(path.join(dir, filename), jpeg, { mode: 0o600 });
  return `local:${filename.replace(".jpg", "")}`;
}

interface NodeSeed {
  key: string;
  name: string;
  type: "COLLEGE" | "FACULTY" | "DEPARTMENT";
  levels?: number[];
  children?: NodeSeed[];
}

const tree: NodeSeed[] = [
  {
    key: "college-engineering",
    name: "Engineering",
    type: "COLLEGE",
    children: [
      {
        key: "faculty-computing",
        name: "Computing and Technology",
        type: "FACULTY",
        children: [
          { key: "dept-swe", name: "Software Engineering", type: "DEPARTMENT", levels: [100, 200, 300, 400, 500] },
          { key: "dept-mech", name: "Mechanical Engineering", type: "DEPARTMENT", levels: [100, 200, 300, 400, 500] },
          { key: "dept-arch", name: "Architecture", type: "DEPARTMENT", levels: [100, 200, 300, 400, 500] },
        ],
      },
    ],
  },
  {
    key: "college-law",
    name: "Law",
    type: "COLLEGE",
    children: [
      {
        key: "faculty-law",
        name: "Faculty of Law",
        type: "FACULTY",
        children: [
          { key: "dept-law", name: "Law", type: "DEPARTMENT", levels: [100, 200, 300, 400, 500] },
        ],
      },
    ],
  },
  {
    key: "college-medicine",
    name: "Medicine",
    type: "COLLEGE",
    children: [
      {
        key: "faculty-clinical",
        name: "Clinical Sciences",
        type: "FACULTY",
        children: [
          { key: "dept-medicine", name: "Medicine", type: "DEPARTMENT", levels: [100, 200, 300, 400, 500, 600] },
        ],
      },
    ],
  },
  {
    key: "college-management",
    name: "Management",
    type: "COLLEGE",
    children: [
      {
        key: "faculty-social",
        name: "Social and Management Sciences",
        type: "FACULTY",
        children: [
          { key: "dept-masscomm", name: "Mass Communication", type: "DEPARTMENT", levels: [100, 200, 300, 400] },
          { key: "dept-accounting", name: "Accounting", type: "DEPARTMENT", levels: [100, 200, 300, 400] },
        ],
      },
    ],
  },
];

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

async function main() {
  const hashValue = await passwordHash();
  const platformAdminEmail = process.env.SEED_PLATFORM_ADMIN_EMAIL ?? "admin@konnekt.ng";
  // Demo accounts represent established students. A fixed age keeps rules
  // such as the 24-hour community-creation delay deterministic on fresh DBs.
  const demoAccountCreatedAt = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

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
      featureFlags: { campusVoice: false, communities: true, events: false, messaging: false },
    },
    create: {
      name: "Nova University",
      shortName: "Nova",
      slug: "nova-university",
      accentColor: ACCENT,
      status: "ACTIVE",
      studentEmailDomains: ["student.nova.edu.ng", "nova.edu.ng"],
      idCardEnabled: true,
      vouchingEnabled: true,
      matricPattern: "^[A-Z]{2,4}/\\d{4}/\\d{3,4}$",
      labels: { college: "College", faculty: "Faculty", department: "Department" },
      featureFlags: { campusVoice: false, communities: true, events: false, messaging: false },
    },
  });

  const nodeIds = new Map<string, string>();
  async function createNodes(nodes: NodeSeed[], parentId: string | null, parentPath: string, depth: number) {
    let order = 0;
    for (const node of nodes) {
      const slug = slugify(node.name);
      const existing = await db.academicNode.findFirst({
        where: { universityId: university.id, parentId, slug },
      });
      const record = existing
        ? await db.academicNode.update({
            where: { id: existing.id },
            data: { path: parentPath, parentPath, sortOrder: order, levels: node.levels ?? [] },
          })
        : await db.academicNode.create({
            data: {
              universityId: university.id,
              parentId,
              type: node.type,
              name: node.name,
              slug,
              path: parentPath,
              parentPath,
              sortOrder: order,
              levels: node.levels ?? [],
            },
          });
      nodeIds.set(node.key, record.id);
      order += 1;
      if (node.children?.length) {
        const childPath = parentPath ? `${parentPath}/${record.id}` : record.id;
        await createNodes(node.children, record.id, childPath, depth + 1);
      }
    }
  }
  await createNodes(tree, null, "", 0);

  const departmentId = (key: string) => nodeIds.get(key)!;

  async function upsertUser(input: {
    email: string;
    username: string;
    fullName: string;
    status: "UNVERIFIED" | "PENDING" | "VERIFIED" | "REJECTED" | "SUSPENDED" | "ALUMNI";
    departmentKey?: string;
    level?: number;
    matric?: string;
    bio?: string;
    interests?: string[];
    isPostgraduate?: boolean;
    roles?: Array<{ role: "PLATFORM_ADMIN" | "UNIVERSITY_ADMIN" | "REVIEWER" | "MODERATOR" | "OFFICIAL"; universityId?: string | null }>;
  }) {
    const data: Prisma.UserUncheckedCreateInput = {
      universityId: university.id,
      email: input.email,
      emailVerified: true,
      username: input.username,
      passwordHash: hashValue,
      fullName: input.fullName,
      status: input.status,
      bio: input.bio ?? null,
      matricNumber: input.matric ?? null,
      matricNormalized: input.matric?.toUpperCase() ?? null,
      departmentNodeId: input.departmentKey ? departmentId(input.departmentKey) : null,
      level: input.level ?? null,
      isPostgraduate: input.isPostgraduate ?? false,
      interests: input.interests ?? [],
      consentPolicyVersion: "2026-01-01",
      consentAcceptedAt: new Date(),
      createdAt: demoAccountCreatedAt,
      verifiedAt: input.status === "VERIFIED" || input.status === "ALUMNI" ? new Date() : null,
      onboardingCompletedAt:
        (input.status === "VERIFIED" || input.status === "ALUMNI") && input.departmentKey && input.level
          ? new Date()
          : null,
    };
    const user = await db.user.upsert({
      where: { email: input.email },
      update: {
        universityId: university.id,
        fullName: input.fullName,
        status: input.status,
        departmentNodeId: data.departmentNodeId,
        level: data.level,
        matricNumber: data.matricNumber,
        matricNormalized: data.matricNormalized,
        bio: data.bio,
        interests: data.interests,
        onboardingCompletedAt: data.onboardingCompletedAt,
        passwordHash: hashValue,
        emailVerified: true,
      },
      create: data,
    });
    for (const role of input.roles ?? []) {
      const roleUniversityId = role.universityId === undefined ? university.id : role.universityId;
      const existing = await db.roleAssignment.findFirst({
        where: { userId: user.id, role: role.role, universityId: roleUniversityId ?? null },
      });
      if (!existing) {
        await db.roleAssignment.create({
          data: { userId: user.id, role: role.role, universityId: roleUniversityId ?? null, grantedBy: null },
        });
      }
    }
    return user;
  }

  const platformAdmin = await upsertUser({
    email: platformAdminEmail,
    username: "konnekt_admin",
    fullName: "Platform Administrator",
    status: "VERIFIED",
    departmentKey: "dept-swe",
    level: 500,
    roles: [{ role: "PLATFORM_ADMIN", universityId: null }],
  });

  const uniAdmin = await upsertUser({
    email: "admin@nova.edu.ng",
    username: "nova_admin",
    fullName: "Funke Adebayo",
    status: "VERIFIED",
    departmentKey: "dept-swe",
    level: 400,
    roles: [{ role: "UNIVERSITY_ADMIN" }],
  });

  const reviewer = await upsertUser({
    email: "reviewer@nova.edu.ng",
    username: "nova_reviewer",
    fullName: "Bola Ogunleye",
    status: "VERIFIED",
    departmentKey: "dept-law",
    level: 400,
    roles: [{ role: "REVIEWER" }],
  });

  const courseRep = await upsertUser({
    email: "courserep@nova.edu.ng",
    username: "swe_rep",
    fullName: "Igwe Kalu",
    status: "VERIFIED",
    departmentKey: "dept-swe",
    level: 400,
    bio: "Course rep for Software Engineering. Reach out before exam week gets chaotic.",
    interests: ["Coding", "Design", "Football"],
    roles: [{ role: "OFFICIAL" }],
  });

  const verified = await upsertUser({
    email: "student@nova.edu.ng",
    username: "chinedu_okafor",
    fullName: "Chinedu Okafor",
    status: "VERIFIED",
    departmentKey: "dept-swe",
    level: 300,
    matric: "SWE/2023/0564",
    bio: "Software Engineering 300L at Nova University. Building campus tools and trying to finish CSC 204 labs before 11pm.",
    interests: ["Coding", "Design", "TechSummit", "Afrobeats"],
  });

  const levelmate = await upsertUser({
    email: "levelmate@nova.edu.ng",
    username: "aisha_bello",
    fullName: "Aisha Bello",
    status: "VERIFIED",
    departmentKey: "dept-swe",
    level: 300,
    matric: "SWE/2023/0021",
    bio: "300L Software Engineering. Product design, robotics club, and late-night library sessions.",
    interests: ["Design", "Coding", "Photography"],
  });

  const otherLevel = await upsertUser({
    email: "otherlevel@nova.edu.ng",
    username: "tunde_adeyemi",
    fullName: "Tunde Adeyemi",
    status: "VERIFIED",
    departmentKey: "dept-swe",
    level: 400,
    matric: "SWE/2022/1187",
    bio: "400L Software Engineering. Building distributed campus systems and mentoring 200L students.",
  });

  const otherDept = await upsertUser({
    email: "otherdept@nova.edu.ng",
    username: "ngozi_eze",
    fullName: "Ngozi Eze",
    status: "VERIFIED",
    departmentKey: "dept-mech",
    level: 300,
    matric: "MEC/2023/0775",
    bio: "300L Mechanical Engineering. Formula student chassis team and football Sundays.",
  });

  const otherCollege = await upsertUser({
    email: "othercollege@nova.edu.ng",
    username: "ibrahim_musa",
    fullName: "Ibrahim Musa",
    status: "VERIFIED",
    departmentKey: "dept-law",
    level: 300,
    matric: "LAW/2023/0190",
    bio: "Law 300L. Moot court society and legal clinics.",
  });

  const pending = await upsertUser({
    email: "pending@nova.edu.ng",
    username: "emeka_nwosu",
    fullName: "Emeka Nwosu",
    status: "PENDING",
    departmentKey: "dept-accounting",
    level: 200,
    matric: "ACC/2024/2210",
  });

  const rejected = await upsertUser({
    email: "rejected@nova.edu.ng",
    username: "zainab_yusuf",
    fullName: "Zainab Yusuf",
    status: "REJECTED",
    departmentKey: "dept-masscomm",
    level: 100,
    matric: "MAC/2025/3311",
  });

  await upsertUser({
    email: "suspended@nova.edu.ng",
    username: "suspended_nova",
    fullName: "Kelechi Okafor",
    status: "SUSPENDED",
    departmentKey: "dept-mech",
    level: 300,
    matric: "MEC/2023/5521",
  });

  await upsertUser({
    email: "alumni@nova.edu.ng",
    username: "alumni_nova",
    fullName: "Yetunde Alabi",
    status: "ALUMNI",
    departmentKey: "dept-law",
    level: 500,
    matric: "LAW/2020/8801",
    bio: "Law alumna. Still checking Nova campus updates.",
  });

  await upsertUser({
    email: "newstudent@nova.edu.ng",
    username: "unverified_nova",
    fullName: "Sadiq Yusuf",
    status: "UNVERIFIED",
    departmentKey: "dept-arch",
    level: 100,
  });

  const existingPending = await db.verificationRequest.findFirst({
    where: { userId: pending.id, status: "PENDING" },
  });
  if (!existingPending) {
    const imageRef = await sampleIdImage();
    await db.verificationRequest.create({
      data: {
        userId: pending.id,
        universityId: university.id,
        method: "ID_CARD",
        matricNumber: "ACC/2024/2210",
        matricNormalized: "ACC/2024/2210",
        idImageRef: imageRef,
        status: "PENDING",
      },
    });
  }

  const existingRejected = await db.verificationRequest.findFirst({
    where: { userId: rejected.id, status: "REJECTED" },
  });
  if (!existingRejected) {
    await db.verificationRequest.create({
      data: {
        userId: rejected.id,
        universityId: university.id,
        method: "ID_CARD",
        matricNumber: "MAC/2025/3311",
        matricNormalized: "MAC/2025/3311",
        status: "REJECTED",
        reviewerId: reviewer.id,
        decisionReason: "MATRIC_MISMATCH",
        decisionNote: "The matric number on the ID card is blurry and doesn't match what you entered. Please retake in bright light.",
        decidedAt: new Date(),
      },
    });
  }

  const waitlistCount = await db.waitlistEntry.count();
  if (waitlistCount === 0) {
    await db.waitlistEntry.createMany({
      data: [
        { kind: "UNIVERSITY", universityName: "Federal University of Technology, Akure", email: "registrar@futa-example.edu.ng" },
        { kind: "STUDENT", email: "student@unlisted-example.edu.ng" },
        { kind: "STUDENT", email: "another@unlisted-example.edu.ng" },
      ],
    });
  }

  const demoAuthors = [
    { id: verified.id, fullName: "Chinedu Okafor", username: "chinedu_okafor", deptKey: "dept-swe", level: 300 },
    { id: levelmate.id, fullName: "Aisha Bello", username: "aisha_bello", deptKey: "dept-swe", level: 300 },
    { id: otherLevel.id, fullName: "Tunde Adeyemi", username: "tunde_adeyemi", deptKey: "dept-swe", level: 400 },
    { id: otherDept.id, fullName: "Ngozi Eze", username: "ngozi_eze", deptKey: "dept-mech", level: 300 },
    { id: otherCollege.id, fullName: "Ibrahim Musa", username: "ibrahim_musa", deptKey: "dept-law", level: 300 },
    { id: courseRep.id, fullName: "Igwe Kalu", username: "swe_rep", deptKey: "dept-swe", level: 400 },
    { id: reviewer.id, fullName: "Bola Ogunleye", username: "nova_reviewer", deptKey: "dept-law", level: 400 },
  ];

  await seedSocialContent(db, {
    universityId: university.id,
    nodeIds,
    passwordHash: hashValue,
    moderatorId: uniAdmin.id,
    demoAuthors,
  });

  await seedCommunities(db, {
    universityId: university.id,
    moderatorId: uniAdmin.id,
    demoAuthors,
  });

  await seedEvents(db, {
    universityId: university.id,
    adminId: uniAdmin.id,
    reviewerId: reviewer.id,
    demoAuthors,
  });

  const auditExists = await db.auditLog.findFirst({ where: { action: "seed.completed" } });
  if (!auditExists) {
    await db.auditLog.create({
      data: {
        actorId: platformAdmin.id,
        universityId: university.id,
        action: "seed.completed",
        targetType: "University",
        targetId: university.id,
        metadata: { university: "Nova University", students: 55 },
      },
    });
  }

  console.log("Seeded Konnekt Nova University development data");
  console.table({
    university: university.name,
    slug: university.slug,
    password: PASSWORD,
    platformAdmin: platformAdminEmail,
    universityAdmin: uniAdmin.email,
    reviewer: reviewer.email,
    courseRep: courseRep.email,
    verifiedStudent: verified.email,
    pendingStudent: pending.email,
    rejectedStudent: rejected.email,
  });
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.$disconnect();
  });
