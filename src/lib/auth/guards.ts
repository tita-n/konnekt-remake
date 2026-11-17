import "server-only";
import { notFound, redirect } from "next/navigation";
import type { Role } from "@prisma/client";
import { getSession, type SessionUser } from "./session";

export type { SessionUser };

/** Any signed-in user, including suspended and pending accounts. */
export async function requireSessionUser(nextPath?: string): Promise<SessionUser> {
  const current = await getSession();
  if (!current) {
    redirect(nextPath ? `/login?next=${encodeURIComponent(nextPath)}` : "/login");
  }
  return current.user;
}

export function hasRole(user: SessionUser, role: Role, universityId?: string): boolean {
  return user.roles.some(
    (assignment) =>
      assignment.role === role && assignment.universityId === (universityId ?? user.universityId),
  );
}

export function isPlatformAdmin(user: SessionUser): boolean {
  return user.roles.some((assignment) => assignment.role === "PLATFORM_ADMIN" && assignment.universityId === null);
}

/** A verified (or alumni) student who finished onboarding. */
export async function requireStudent(nextPath?: string): Promise<SessionUser> {
  const user = await requireSessionUser(nextPath);
  if (user.status === "SUSPENDED") redirect("/suspended");
  if (user.status === "DELETED_PENDING") redirect("/account/deleted");
  if (user.status !== "VERIFIED" && user.status !== "ALUMNI") redirect("/status");
  if (!user.departmentNodeId || !user.level) redirect("/onboarding");
  return user;
}

/** University console: admin or reviewer, scoped to their own university. */
export async function requireUniversityRole(allowed: readonly Role[]): Promise<SessionUser> {
  const user = await requireSessionUser("/admin");
  const granted = user.roles.some(
    (assignment) => assignment.universityId === user.universityId && allowed.includes(assignment.role as Role),
  );
  if (!granted) notFound();
  if (user.university.status === "OFF") notFound();
  return user;
}

export async function requirePlatformAdmin(): Promise<SessionUser> {
  const user = await requireSessionUser("/platform");
  if (!isPlatformAdmin(user)) notFound();
  return user;
}

export interface ApiActor {
  user: SessionUser;
}

/** For route handlers: returns null instead of redirecting. */
export async function getApiActor(): Promise<ApiActor | null> {
  const current = await getSession();
  if (!current) return null;
  return { user: current.user };
}
