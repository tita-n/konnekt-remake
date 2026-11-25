import "server-only";
import { writeAudit } from "@/lib/audit";
import { tenantDb } from "@/lib/db/tenant";
import {
  normalizeOfficialName,
  officialDescriptionError,
  officialNameError,
  officialSlugError,
  slugifyOfficialName,
  type OfficialAccountCategory,
} from "@/lib/domain/official";
import { SocialError } from "@/lib/posts/errors";
import type { SocialViewer } from "./social";

export interface OfficialAccountView {
  id: string;
  name: string;
  slug: string;
  category: string;
  avatarPublicId: string | null;
  description: string;
  status: string;
  staffCount: number;
  canPost: boolean;
  canCritical: boolean;
}

export async function listOfficialAccountsForViewer(viewer: SocialViewer): Promise<OfficialAccountView[]> {
  const db = tenantDb(viewer.universityId);
  const rows = await db.officialAccount.findMany({
    where: viewer.isUniversityAdmin ? {} : { status: "ACTIVE" },
    orderBy: [{ name: "asc" }],
    select: {
      id: true,
      name: true,
      slug: true,
      category: true,
      avatarPublicId: true,
      description: true,
      status: true,
      _count: { select: { staff: true } },
      staff: { where: { userId: viewer.userId }, select: { canPublishCritical: true } },
    },
  });
  return rows.map((row) => {
    const staff = row.staff[0];
    return {
      id: row.id,
      name: row.name,
      slug: row.slug,
      category: row.category,
      avatarPublicId: row.avatarPublicId,
      description: row.description,
      status: row.status,
      staffCount: row._count.staff,
      canPost: viewer.isUniversityAdmin || (row.status === "ACTIVE" && Boolean(staff)),
      canCritical: viewer.isUniversityAdmin || Boolean(staff?.canPublishCritical),
    };
  });
}

export async function getOfficialAccountBySlug(viewer: SocialViewer, slug: string) {
  const db = tenantDb(viewer.universityId);
  const row = await db.officialAccount.findFirst({
    where: { slug, status: "ACTIVE" },
    select: {
      id: true,
      name: true,
      slug: true,
      category: true,
      avatarPublicId: true,
      description: true,
      status: true,
    },
  });
  return row;
}

export async function getOfficialPostingContext(viewer: SocialViewer): Promise<{
  accounts: OfficialAccountView[];
  defaultAccountId: string | null;
}> {
  const accounts = (await listOfficialAccountsForViewer(viewer)).filter((account) => account.canPost);
  return { accounts, defaultAccountId: accounts[0]?.id ?? null };
}

export interface CreateOfficialAccountInput {
  name: string;
  slug?: string;
  category: OfficialAccountCategory;
  description: string;
  avatarPublicId?: string | null;
}

export async function createOfficialAccount(
  viewer: SocialViewer,
  input: CreateOfficialAccountInput,
): Promise<{ id: string; slug: string }> {
  if (!viewer.isUniversityAdmin) throw new SocialError("Only university admins can create official accounts.", 403, "forbidden");
  const nameError = officialNameError(input.name);
  if (nameError) throw new SocialError(nameError);
  const descriptionError = officialDescriptionError(input.description);
  if (descriptionError) throw new SocialError(descriptionError);
  const slug = (input.slug?.trim() || slugifyOfficialName(input.name)).toLowerCase();
  const slugError = officialSlugError(slug);
  if (slugError) throw new SocialError(slugError);
  const db = tenantDb(viewer.universityId);
  const normalized = normalizeOfficialName(input.name);
  const existing = await db.officialAccount.findFirst({
    where: { OR: [{ slug }, { nameNormalized: normalized }] },
    select: { id: true },
  });
  if (existing) throw new SocialError("An official account already uses that name or link.", 409, "duplicate");
  const created = await db.officialAccount.create({
    data: {
      universityId: viewer.universityId,
      name: input.name.trim(),
      nameNormalized: normalized,
      slug,
      category: input.category,
      description: input.description.trim(),
      avatarPublicId: input.avatarPublicId ?? null,
    },
    select: { id: true, slug: true },
  });
  await writeAudit({
    actorId: viewer.userId,
    universityId: viewer.universityId,
    action: "official_account.create",
    targetType: "OfficialAccount",
    targetId: created.id,
    metadata: { category: input.category, slug },
  });
  return created;
}

export async function updateOfficialAccount(
  viewer: SocialViewer,
  accountId: string,
  input: {
    name?: string;
    category?: OfficialAccountCategory;
    description?: string;
    avatarPublicId?: string | null;
    status?: "ACTIVE" | "SUSPENDED";
  },
): Promise<{ id: string }> {
  if (!viewer.isUniversityAdmin) throw new SocialError("Only university admins can change official accounts.", 403, "forbidden");
  const db = tenantDb(viewer.universityId);
  const row = await db.officialAccount.findFirst({
    where: { id: accountId },
    select: { id: true, name: true, nameNormalized: true, description: true },
  });
  if (!row) throw new SocialError("That official account isn't available.", 404, "not_available");
  const name = input.name ?? row.name;
  const description = input.description ?? row.description;
  const nameError = officialNameError(name);
  if (nameError) throw new SocialError(nameError);
  const descriptionError = officialDescriptionError(description);
  if (descriptionError) throw new SocialError(descriptionError);
  const normalized = normalizeOfficialName(name);
  if (normalized !== row.nameNormalized) {
    const duplicate = await db.officialAccount.findFirst({
      where: { nameNormalized: normalized, NOT: { id: accountId } },
      select: { id: true },
    });
    if (duplicate) throw new SocialError("An official account already uses that name.", 409, "duplicate");
  }
  await db.officialAccount.update({
    where: { id: accountId },
    data: {
      name: name.trim(),
      nameNormalized: normalized,
      category: input.category,
      description: description.trim(),
      avatarPublicId: input.avatarPublicId === undefined ? undefined : input.avatarPublicId,
      status: input.status,
    },
  });
  await writeAudit({
    actorId: viewer.userId,
    universityId: viewer.universityId,
    action: "official_account.edit",
    targetType: "OfficialAccount",
    targetId: accountId,
    metadata: { status: input.status ?? null },
  });
  return { id: accountId };
}

export async function listOfficialStaff(viewer: SocialViewer, accountId: string) {
  if (!viewer.isUniversityAdmin) throw new SocialError("Only university admins can manage official staff.", 403, "forbidden");
  const db = tenantDb(viewer.universityId);
  const rows = await db.officialAccountStaff.findMany({
    where: { officialAccountId: accountId },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      canPublishCritical: true,
      user: { select: { id: true, username: true, fullName: true, photoUrl: true, level: true } },
    },
  });
  return rows;
}

export async function addOfficialStaff(
  viewer: SocialViewer,
  accountId: string,
  userId: string,
  canPublishCritical: boolean,
): Promise<{ id: string }> {
  if (!viewer.isUniversityAdmin) throw new SocialError("Only university admins can manage official staff.", 403, "forbidden");
  const db = tenantDb(viewer.universityId);
  const [account, user] = await Promise.all([
    db.officialAccount.findFirst({ where: { id: accountId }, select: { id: true, status: true } }),
    db.user.findFirst({ where: { id: userId, status: "VERIFIED" }, select: { id: true } }),
  ]);
  if (!account) throw new SocialError("That official account isn't available.", 404, "not_available");
  if (!user) throw new SocialError("Choose a verified student or staff member.", 404, "not_available");
  const existing = await db.officialAccountStaff.findUnique({
    where: { officialAccountId_userId: { officialAccountId: accountId, userId } },
    select: { id: true },
  });
  if (existing) {
    await db.officialAccountStaff.update({
      where: { id: existing.id },
      data: { canPublishCritical },
    });
    await writeAudit({
      actorId: viewer.userId,
      universityId: viewer.universityId,
      action: "official_account.staff.update",
      targetType: "OfficialAccount",
      targetId: accountId,
      metadata: { userId, canPublishCritical },
    });
    return existing;
  }
  const created = await db.officialAccountStaff.create({
    data: {
      universityId: viewer.universityId,
      officialAccountId: accountId,
      userId,
      canPublishCritical,
    },
    select: { id: true },
  });
  await writeAudit({
    actorId: viewer.userId,
    universityId: viewer.universityId,
    action: "official_account.staff.add",
    targetType: "OfficialAccount",
    targetId: accountId,
    metadata: { userId, canPublishCritical },
  });
  return created;
}

export async function removeOfficialStaff(
  viewer: SocialViewer,
  accountId: string,
  userId: string,
): Promise<{ removed: true }> {
  if (!viewer.isUniversityAdmin) throw new SocialError("Only university admins can manage official staff.", 403, "forbidden");
  const db = tenantDb(viewer.universityId);
  const existing = await db.officialAccountStaff.findUnique({
    where: { officialAccountId_userId: { officialAccountId: accountId, userId } },
    select: { id: true },
  });
  if (!existing) throw new SocialError("That staff member wasn't found.", 404, "not_available");
  await db.officialAccountStaff.delete({ where: { id: existing.id } });
  await writeAudit({
    actorId: viewer.userId,
    universityId: viewer.universityId,
    action: "official_account.staff.remove",
    targetType: "OfficialAccount",
    targetId: accountId,
    metadata: { userId },
  });
  return { removed: true };
}

export async function searchVerifiedStudents(viewer: SocialViewer, query: string) {
  if (!viewer.isUniversityAdmin) throw new SocialError("Only university admins can search staff candidates.", 403, "forbidden");
  const q = query.trim();
  if (q.length < 2) return [];
  const db = tenantDb(viewer.universityId);
  return db.user.findMany({
    where: {
      status: "VERIFIED",
      OR: [
        { fullName: { contains: q, mode: "insensitive" } },
        { username: { contains: q, mode: "insensitive" } },
        { email: { contains: q, mode: "insensitive" } },
      ],
    },
    take: 10,
    select: { id: true, username: true, fullName: true, photoUrl: true, level: true, email: true },
  });
}
