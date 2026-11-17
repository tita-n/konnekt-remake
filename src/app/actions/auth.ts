"use server";

import { redirect } from "next/navigation";
import { clearSessionCookies, getSession, revokeAllSessions, revokeCurrentSession } from "@/lib/auth/session";
import { writeAudit } from "@/lib/audit";

export async function signOutAction(): Promise<void> {
  const current = await getSession();
  await revokeCurrentSession();
  if (current) {
    await writeAudit({
      actorId: current.user.id,
      universityId: current.user.universityId,
      action: "auth.logout",
      targetType: "Session",
      targetId: current.session.id,
    }).catch(() => undefined);
  }
  redirect("/login");
}

export async function signOutEverywhereAction(): Promise<void> {
  const current = await getSession();
  if (current) {
    await revokeAllSessions(current.user.id);
    await clearSessionCookies();
    await writeAudit({
      actorId: current.user.id,
      universityId: current.user.universityId,
      action: "auth.logout_all",
      targetType: "User",
      targetId: current.user.id,
    }).catch(() => undefined);
  }
  redirect("/login");
}
