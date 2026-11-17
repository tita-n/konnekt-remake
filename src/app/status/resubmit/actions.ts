"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { requireSessionUser } from "@/lib/auth/guards";
import { submitVouchVerification } from "@/lib/services/verification";
import { rateLimit } from "@/lib/security/rate-limit";
import { hashIp } from "@/lib/crypto";
import { requestContext } from "@/lib/security/request";
import type { FormState } from "@/lib/action-state";

const schema = z.object({
  matricNumber: z.string().trim().min(3).max(32),
  voucherId: z.string().min(1, "Choose someone to vouch for you."),
});

export async function requestVouchAgainAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireSessionUser("/status/resubmit");
  const parsed = schema.safeParse({
    matricNumber: formData.get("matricNumber"),
    voucherId: formData.get("voucherId"),
  });
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return { error: issue?.message ?? "Check your details.", field: String(issue?.path[0] ?? "") };
  }

  const context = await requestContext();
  const limit = await rateLimit("vouchRequest", hashIp(context.ip) ?? "unknown");
  if (!limit.success) return { error: "Too many requests. Try again tomorrow." };

  const result = await submitVouchVerification({
    userId: user.id,
    universityId: user.universityId,
    userStatus: user.status,
    userFullName: user.fullName,
    userUsername: user.username,
    matricNumber: parsed.data.matricNumber,
    voucherId: parsed.data.voucherId,
  });
  if (!result.ok) return { error: result.error, field: result.field };

  redirect("/status");
}
