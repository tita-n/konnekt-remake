/**
 * Minimal deterministic Playwright fixture. This is deliberately separate from
 * the Nova demo seed: e2e only gets the academic tree, accounts and one feed
 * post that the specs depend on. It refuses production and requires the
 * dedicated e2e database guard.
 */
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
      featureFlags: { campusVoice: false, communities: false, events: false, messaging: false },
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
      featureFlags: { campusVoice: false, communities: false, events: false, messaging: false },
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
  await account({
    email: "otherlevel@nova.edu.ng",
    username: "tunde_adeyemi",
    fullName: "Tunde Adeyemi",
    status: "VERIFIED",
    departmentKey: "swe",
    level: 400,
    matric: "SWE/2022/1187",
  });
  await account({
    email: "otherdept@nova.edu.ng",
    username: "ngozi_eze",
    fullName: "Ngozi Eze",
    status: "VERIFIED",
    departmentKey: "mech",
    level: 300,
    matric: "MEC/2023/0775",
  });
  await account({
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
