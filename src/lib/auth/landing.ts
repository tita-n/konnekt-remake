import type { UserStatus } from "@prisma/client";

/** Where a signed-in user belongs right now. */
export function landingPath(user: { status: UserStatus; departmentNodeId: string | null; level: number | null }): string {
  if (user.status === "SUSPENDED") return "/suspended";
  if (user.status === "DELETED_PENDING") return "/account/deleted";
  if (user.status === "VERIFIED" || user.status === "ALUMNI") {
    return user.departmentNodeId && user.level ? "/pulse" : "/onboarding";
  }
  return "/status";
}

export function safeNextPath(next: string | null | undefined): string | null {
  if (!next) return null;
  if (!next.startsWith("/") || next.startsWith("//") || next.includes("\\")) return null;
  return next;
}
