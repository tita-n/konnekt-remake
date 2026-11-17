"use server";

import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { cancelAccountDeletion } from "@/lib/services/verification";

export async function cancelDeletionAction(): Promise<void> {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.user.status !== "DELETED_PENDING") redirect("/pulse");
  await cancelAccountDeletion(session.user.id, session.user.universityId);
  redirect("/pulse");
}
