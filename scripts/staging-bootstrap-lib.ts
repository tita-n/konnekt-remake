import { createHash, randomBytes } from "node:crypto";
import { hash } from "@node-rs/argon2";
import type { PrismaClient } from "@prisma/client";

/**
 * Staging-only bootstrap. The caller supplies the database and the email
 * sender, so the operation is testable without touching a deployed service.
 * No generated password is returned or logged; the account starts with a
 * random unusable hash and is activated only through the emailed reset link.
 */

export const NOVA_SLUG = "nova-university";
const RESET_TTL_MINUTES = 30;

interface NodeSeed {
  name: string;
  type: "COLLEGE" | "FACULTY" | "DEPARTMENT";
  levels?: number[];
  children?: NodeSeed[];
}

const NOVA_TREE: NodeSeed[] = [
  {
    name: "Engineering",
    type: "COLLEGE",
    children: [
      {
        name: "Computing and Technology",
        type: "FACULTY",
        children: [
          { name: "Software Engineering", type: "DEPARTMENT", levels: [100, 200, 300, 400, 500] },
          { name: "Mechanical Engineering", type: "DEPARTMENT", levels: [100, 200, 300, 400, 500] },
          { name: "Architecture", type: "DEPARTMENT", levels: [100, 200, 300, 400, 500] },
        ],
      },
    ],
  },
  {
    name: "Law",
    type: "COLLEGE",
    children: [
      {
        name: "Faculty of Law",
        type: "FACULTY",
        children: [{ name: "Law", type: "DEPARTMENT", levels: [100, 200, 300, 400, 500] }],
      },
    ],
  },
  {
    name: "Medicine",
    type: "COLLEGE",
    children: [
      {
        name: "Clinical Sciences",
        type: "FACULTY",
        children: [{ name: "Medicine", type: "DEPARTMENT", levels: [100, 200, 300, 400, 500, 600] }],
      },
    ],
  },
  {
    name: "Management",
    type: "COLLEGE",
    children: [
      {
        name: "Social and Management Sciences",
        type: "FACULTY",
        children: [
          { name: "Mass Communication", type: "DEPARTMENT", levels: [100, 200, 300, 400] },
          { name: "Accounting", type: "DEPARTMENT", levels: [100, 200, 300, 400] },
        ],
      },
    ],
  },
];

export interface BootstrapResult {
  universityId: string;
  universityCreated: boolean;
  academicNodesCreated: number;
  adminId: string;
  adminCreated: boolean;
  resetLinkSent: boolean;
}

interface BootstrapInput {
  platformAdminEmail: string;
  appUrl: string;
  sendPasswordSetLink: (input: { to: string; resetUrl: string }) => Promise<void>;
  now?: Date;
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function productionMarker(env: Record<string, string | undefined>): string | null {
  const keys = ["VERCEL_ENV", "APP_ENV", "KONNEKT_ENV", "ENVIRONMENT"] as const;
  for (const key of keys) {
    const value = env[key]?.trim().toLowerCase();
    if (value === "production" || value === "prod") return key;
  }
  return null;
}

/** The CLI refuses unless GitHub selected the staging environment explicitly. */
export function assertStagingBootstrapEnvironment(env: Record<string, string | undefined>): void {
  if (env.DEPLOY_ENVIRONMENT !== "staging") {
    throw new Error("Refusing staging bootstrap: DEPLOY_ENVIRONMENT must be exactly 'staging'.");
  }
  const marker = productionMarker(env);
  if (marker) {
    throw new Error(`Refusing staging bootstrap: ${marker} indicates production.`);
  }
  for (const name of ["APP_URL", "DATABASE_URL", "SEED_PLATFORM_ADMIN_EMAIL", "RESEND_API_KEY", "EMAIL_FROM"]) {
    if (!env[name]?.trim()) throw new Error(`Refusing staging bootstrap: ${name} is required.`);
  }
  if (!/^https:\/\//i.test(env.APP_URL!.trim())) {
    throw new Error("Refusing staging bootstrap: APP_URL must be an https:// URL.");
  }
  if (!env.SEED_PLATFORM_ADMIN_EMAIL!.includes("@")) {
    throw new Error("Refusing staging bootstrap: SEED_PLATFORM_ADMIN_EMAIL must contain an email address.");
  }
}

async function ensureUniversity(db: PrismaClient) {
  const existing = await db.university.findUnique({ where: { slug: NOVA_SLUG } });
  if (existing) return { university: existing, created: false };
  const university = await db.university.create({
    data: {
      name: "Nova University",
      shortName: "Nova",
      slug: NOVA_SLUG,
      accentColor: "#4F46E5",
      status: "ACTIVE",
      studentEmailDomains: ["student.nova.edu.ng", "nova.edu.ng"],
      idCardEnabled: true,
      vouchingEnabled: true,
      matricPattern: "^[A-Z]{2,4}/\\d{4}/\\d{3,4}$",
      labels: { college: "College", faculty: "Faculty", department: "Department" },
      featureFlags: { campusVoice: false, communities: true, events: true, messaging: false },
    },
  });
  return { university, created: true };
}

async function ensureAcademicTree(db: PrismaClient, universityId: string): Promise<number> {
  let created = 0;
  async function walk(nodes: NodeSeed[], parentId: string | null, parentPath: string) {
    let order = 0;
    for (const node of nodes) {
      const slug = slugify(node.name);
      const existing = await db.academicNode.findFirst({
        where: { universityId, parentId, slug },
        select: { id: true },
      });
      const record =
        existing ??
        (await db.academicNode.create({
          data: {
            universityId,
            parentId,
            type: node.type,
            name: node.name,
            slug,
            path: parentPath,
            parentPath,
            sortOrder: order,
            levels: node.levels ?? [],
          },
          select: { id: true },
        }));
      if (!existing) created += 1;
      order += 1;
      if (node.children?.length) {
        await walk(node.children, record.id, parentPath ? `${parentPath}/${record.id}` : record.id);
      }
    }
  }
  await walk(NOVA_TREE, null, "");
  return created;
}

async function availableUsername(db: PrismaClient, email: string): Promise<string> {
  const local = email.split("@")[0]?.toLowerCase().replace(/[^a-z0-9_]/g, "_").slice(0, 20) || "platform";
  const base = local.length >= 3 ? local : `admin_${local}`;
  for (let suffix = 0; suffix < 50; suffix += 1) {
    const candidate = suffix === 0 ? base : `${base}_${suffix + 1}`;
    const taken = await db.user.findUnique({ where: { username: candidate }, select: { id: true } });
    if (!taken) return candidate;
  }
  throw new Error("Could not allocate a unique platform administrator username.");
}

export async function bootstrapStaging(db: PrismaClient, input: BootstrapInput): Promise<BootstrapResult> {
  const now = input.now ?? new Date();
  const email = input.platformAdminEmail.trim().toLowerCase();
  const appUrl = input.appUrl.replace(/\/+$/, "");
  const { university, created: universityCreated } = await ensureUniversity(db);
  const academicNodesCreated = await ensureAcademicTree(db, university.id);

  let admin = await db.user.findUnique({ where: { email } });
  let adminCreated = false;
  if (!admin) {
    const passwordHash = await hash(randomBytes(48).toString("base64url"), {
      algorithm: 2,
      memoryCost: 19456,
      timeCost: 2,
      parallelism: 1,
      outputLen: 32,
    });
    admin = await db.user.create({
      data: {
        universityId: university.id,
        email,
        emailVerified: true,
        username: await availableUsername(db, email),
        passwordHash,
        fullName: "Platform Administrator",
        status: "VERIFIED",
        onboardingCompletedAt: now,
        consentAcceptedAt: now,
        consentPolicyVersion: university.policyVersion,
      },
    });
    adminCreated = true;
  }

  const role = await db.roleAssignment.findFirst({
    where: { userId: admin.id, role: "PLATFORM_ADMIN", universityId: null },
    select: { id: true },
  });
  if (!role) {
    await db.roleAssignment.create({
      data: { userId: admin.id, universityId: null, role: "PLATFORM_ADMIN" },
    });
  }

  const completedReset = await db.passwordResetToken.findFirst({
    where: { userId: admin.id, usedAt: { not: null } },
    select: { id: true },
  });
  const activeReset = await db.passwordResetToken.findFirst({
    where: { userId: admin.id, usedAt: null, expiresAt: { gt: now } },
    select: { id: true },
  });
  let resetLinkSent = false;
  if (!completedReset && !activeReset) {
    const token = randomBytes(32).toString("base64url");
    const tokenHash = createHash("sha256").update(token).digest("hex");
    await db.passwordResetToken.create({
      data: {
        userId: admin.id,
        tokenHash,
        expiresAt: new Date(now.getTime() + RESET_TTL_MINUTES * 60 * 1000),
      },
    });
    try {
      await input.sendPasswordSetLink({
        to: email,
        resetUrl: `${appUrl}/reset-password?token=${encodeURIComponent(token)}`,
      });
      resetLinkSent = true;
    } catch (error) {
      // A failed send must not leave a live token that blocks the next run.
      await db.passwordResetToken.deleteMany({ where: { tokenHash } });
      throw error;
    }
  }

  await db.auditLog.create({
    data: {
      actorId: admin.id,
      universityId: university.id,
      action: "staging.bootstrap",
      targetType: "University",
      targetId: university.id,
      metadata: {
        universityCreated,
        academicNodesCreated,
        adminCreated,
        resetLinkSent,
      },
    },
  });

  return {
    universityId: university.id,
    universityCreated,
    academicNodesCreated,
    adminId: admin.id,
    adminCreated,
    resetLinkSent,
  };
}
