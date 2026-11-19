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
    <rect width="900" height="560" fill="#eef2ef"/>
    <rect x="24" y="24" width="852" height="512" rx="24" fill="#ffffff" stroke="#c3cec8" stroke-width="4"/>
    <text x="60" y="110" font-family="sans-serif" font-size="34" font-weight="700" fill="#0c1411">DEMO UNIVERSITY</text>
    <text x="60" y="152" font-family="sans-serif" font-size="22" fill="#55645c">Student identity card · sample for local development</text>
    <rect x="60" y="200" width="180" height="220" rx="16" fill="#dce3df"/>
    <circle cx="150" cy="280" r="46" fill="#a5b3aa"/>
    <rect x="96" y="342" width="108" height="52" rx="26" fill="#a5b3aa"/>
    <text x="290" y="230" font-family="sans-serif" font-size="26" font-weight="700" fill="#0c1411">Adaeze N. Okonkwo</text>
    <text x="290" y="272" font-family="sans-serif" font-size="21" fill="#26332c">Matric: CSC/2022/1041</text>
    <text x="290" y="310" font-family="sans-serif" font-size="21" fill="#26332c">Computer Science · 300 level</text>
    <text x="290" y="348" font-family="sans-serif" font-size="21" fill="#26332c">Faculty of Physical Sciences</text>
    <text x="60" y="490" font-family="monospace" font-size="20" fill="#55645c">SAMPLE DOCUMENT — NOT A REAL ID</text>
  </svg>`;
  const jpeg = await sharp(Buffer.from(svg)).jpeg({ quality: 80 }).toBuffer();
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
    key: "college-sciences",
    name: "College of Natural and Applied Sciences",
    type: "COLLEGE",
    children: [
      {
        key: "faculty-physical",
        name: "Faculty of Physical Sciences",
        type: "FACULTY",
        children: [
          { key: "dept-computer", name: "Computer Science", type: "DEPARTMENT", levels: [100, 200, 300, 400, 500] },
          { key: "dept-mathematics", name: "Mathematics", type: "DEPARTMENT", levels: [100, 200, 300, 400] },
          { key: "dept-physics", name: "Physics", type: "DEPARTMENT", levels: [100, 200, 300, 400] },
        ],
      },
      {
        key: "faculty-biological",
        name: "Faculty of Biological Sciences",
        type: "FACULTY",
        children: [
          { key: "dept-microbiology", name: "Microbiology", type: "DEPARTMENT", levels: [100, 200, 300, 400] },
          { key: "dept-biochemistry", name: "Biochemistry", type: "DEPARTMENT", levels: [100, 200, 300, 400] },
        ],
      },
    ],
  },
  {
    key: "college-humanities",
    name: "College of Humanities and Social Sciences",
    type: "COLLEGE",
    children: [
      {
        key: "faculty-arts",
        name: "Faculty of Arts",
        type: "FACULTY",
        children: [
          { key: "dept-english", name: "English and Literature", type: "DEPARTMENT", levels: [100, 200, 300, 400] },
          { key: "dept-history", name: "History and International Studies", type: "DEPARTMENT", levels: [100, 200, 300, 400] },
        ],
      },
      {
        key: "faculty-social",
        name: "Faculty of Social Sciences",
        type: "FACULTY",
        children: [
          { key: "dept-economics", name: "Economics", type: "DEPARTMENT", levels: [100, 200, 300, 400] },
          { key: "dept-masscomm", name: "Mass Communication", type: "DEPARTMENT", levels: [100, 200, 300, 400] },
          { key: "dept-law", name: "Law", type: "DEPARTMENT", levels: [100, 200, 300, 400, 500, 600] },
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

  const university = await db.university.upsert({
    where: { slug: "demo-university" },
    update: {
      status: "ACTIVE",
      accentColor: ACCENT,
      studentEmailDomains: ["student.demo.edu.ng", "demo.edu.ng"],
      idCardEnabled: true,
      vouchingEnabled: true,
      matricPattern: "^[A-Z]{2,4}/\\d{4}/\\d{3,4}$",
      labels: { college: "College", faculty: "Faculty", department: "Department" },
      featureFlags: { campusVoice: false, communities: false, events: false, messaging: false },
    },
    create: {
      name: "Demo University",
      shortName: "Demo",
      slug: "demo-university",
      accentColor: ACCENT,
      status: "ACTIVE",
      studentEmailDomains: ["student.demo.edu.ng", "demo.edu.ng"],
      idCardEnabled: true,
      vouchingEnabled: true,
      matricPattern: "^[A-Z]{2,4}/\\d{4}/\\d{3,4}$",
      labels: { college: "College", faculty: "Faculty", department: "Department" },
      featureFlags: { campusVoice: false, communities: false, events: false, messaging: false },
    },
  });

  // Build the academic tree, reusing nodes whose slug already exists.
  const nodeIds = new Map<string, string>();
  async function createNodes(nodes: NodeSeed[], parentId: string | null, parentPath: string, depth: number) {
    let order = 0;
    for (const node of nodes) {
      const slug = slugify(node.name);
      const existing = await db.academicNode.findFirst({
        where: { universityId: university.id, parentId, slug },
      });
      const record =
        existing ??
        (await db.academicNode.create({
          data: {
            universityId: university.id,
            parentId,
            type: node.type,
            name: node.name,
            slug,
            path: parentPath,
            sortOrder: order,
            levels: node.levels ?? [],
          },
        }));
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
      verifiedAt: input.status === "VERIFIED" || input.status === "ALUMNI" ? new Date() : null,
    };
    const user = await db.user.upsert({
      where: { email: input.email },
      update: {
        status: input.status,
        departmentNodeId: data.departmentNodeId,
        level: data.level,
        matricNumber: data.matricNumber,
        matricNormalized: data.matricNormalized,
        bio: data.bio,
        interests: data.interests,
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
    departmentKey: "dept-computer",
    level: 500,
    roles: [{ role: "PLATFORM_ADMIN", universityId: null }],
  });

  const uniAdmin = await upsertUser({
    email: "admin@demo.edu.ng",
    username: "demo_admin",
    fullName: "Bola Adewale",
    status: "VERIFIED",
    departmentKey: "dept-computer",
    level: 400,
    roles: [{ role: "UNIVERSITY_ADMIN" }],
  });

  const reviewer = await upsertUser({
    email: "reviewer@demo.edu.ng",
    username: "demo_reviewer",
    fullName: "Ngozi Umeh",
    status: "VERIFIED",
    departmentKey: "dept-microbiology",
    level: 400,
    roles: [{ role: "REVIEWER" }],
  });

  const courseRep = await upsertUser({
    email: "courserep@demo.edu.ng",
    username: "csc_rep",
    fullName: "Tunde Bakare",
    status: "VERIFIED",
    departmentKey: "dept-computer",
    level: 400,
    bio: "Course rep for Computer Science. Ask me about classes before you ask me about life.",
    interests: ["Coding", "Football", "Music"],
    roles: [{ role: "OFFICIAL" }],
  });

  const verified = await upsertUser({
    email: "student@demo.edu.ng",
    username: "adaeze",
    fullName: "Adaeze Okonkwo",
    status: "VERIFIED",
    departmentKey: "dept-computer",
    level: 300,
    matric: "CSC/2022/1041",
    bio: "300 level Computer Science. Building small things for fun and pretending to study.",
    interests: ["Coding", "Afrobeats", "Basketball", "Design"],
  });

  // Fixed accounts for the audience matrix in end-to-end tests.
  await upsertUser({
    email: "levelmate@demo.edu.ng",
    username: "adaeze_levelmate",
    fullName: "Kamsi Eze",
    status: "VERIFIED",
    departmentKey: "dept-computer",
    level: 300,
    matric: "CSC/2022/1088",
    bio: "Same department, same level. Usually in the lab.",
  });
  await upsertUser({
    email: "otherlevel@demo.edu.ng",
    username: "obi_400",
    fullName: "Obi Nwankwo",
    status: "VERIFIED",
    departmentKey: "dept-computer",
    level: 400,
    matric: "CSC/2021/0921",
  });
  await upsertUser({
    email: "otherdept@demo.edu.ng",
    username: "maths_300",
    fullName: "Sade Ogun",
    status: "VERIFIED",
    departmentKey: "dept-mathematics",
    level: 300,
    matric: "MTH/2022/3301",
  });
  await upsertUser({
    email: "othercollege@demo.edu.ng",
    username: "law_300",
    fullName: "Bello Amina",
    status: "VERIFIED",
    departmentKey: "dept-law",
    level: 300,
    matric: "LAW/2022/7710",
  });

  const pending = await upsertUser({
    email: "pending@demo.edu.ng",
    username: "emeka_pending",
    fullName: "Emeka Nwachukwu",
    status: "PENDING",
    departmentKey: "dept-mathematics",
    level: 200,
    matric: "MTH/2024/2210",
  });

  const rejected = await upsertUser({
    email: "rejected@demo.edu.ng",
    username: "halima",
    fullName: "Halima Bello",
    status: "REJECTED",
    departmentKey: "dept-economics",
    level: 100,
    matric: "ECO/2025/3311",
  });

  await upsertUser({
    email: "suspended@demo.edu.ng",
    username: "suspended_demo",
    fullName: "Chinedu Obi",
    status: "SUSPENDED",
    departmentKey: "dept-physics",
    level: 300,
    matric: "PHY/2023/5521",
  });

  await upsertUser({
    email: "alumni@demo.edu.ng",
    username: "alumni_demo",
    fullName: "Yetunde Alabi",
    status: "ALUMNI",
    departmentKey: "dept-law",
    level: 600,
    matric: "LAW/2019/8801",
    bio: "Law alumna. Still lurking because campus gossip is undefeated.",
  });

  await upsertUser({
    email: "newstudent@demo.edu.ng",
    username: "unverified_demo",
    fullName: "Sadiq Yusuf",
    status: "UNVERIFIED",
    departmentKey: "dept-english",
    level: 100,
  });

  // Pending ID request for the pending student.
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
        matricNumber: "MTH/2024/2210",
        matricNormalized: "MTH/2024/2210",
        idImageRef: imageRef,
        status: "PENDING",
      },
    });
  }

  // Rejected request with a fixed reason.
  const existingRejected = await db.verificationRequest.findFirst({
    where: { userId: rejected.id, status: "REJECTED" },
  });
  if (!existingRejected) {
    await db.verificationRequest.create({
      data: {
        userId: rejected.id,
        universityId: university.id,
        method: "ID_CARD",
        matricNumber: "ECO/2025/3311",
        matricNormalized: "ECO/2025/3311",
        status: "REJECTED",
        reviewerId: reviewer.id,
        decisionReason: "MATRIC_MISMATCH",
        decisionNote: "The matric number on the ID does not match the one submitted. Please resubmit with a clear photo.",
        decidedAt: new Date(),
      },
    });
  }

  // Waitlist entries (real people would create these).
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

  await seedSocialContent(db, {
    universityId: university.id,
    nodeIds,
    passwordHash: hashValue,
    moderatorId: uniAdmin.id,
    demoAuthors: [
      { id: verified.id, fullName: "Adaeze Okonkwo", username: "adaeze", deptKey: "dept-computer", level: 300 },
      { id: courseRep.id, fullName: "Tunde Bakare", username: "csc_rep", deptKey: "dept-computer", level: 400 },
      { id: reviewer.id, fullName: "Ngozi Umeh", username: "demo_reviewer", deptKey: "dept-microbiology", level: 400 },
    ],
  });

  // A welcome audit entry proves the append-only log is wired up.
  const auditExists = await db.auditLog.findFirst({ where: { action: "seed.completed" } });
  if (!auditExists) {
    await db.auditLog.create({
      data: {
        actorId: platformAdmin.id,
        universityId: university.id,
        action: "seed.completed",
        targetType: "University",
        targetId: university.id,
        metadata: { students: 7, reviewers: 2 },
      },
    });
  }

  console.log("Seeded Konnekt development data");
  console.table({
    university: university.name,
    slug: university.slug,
    students: 7,
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
