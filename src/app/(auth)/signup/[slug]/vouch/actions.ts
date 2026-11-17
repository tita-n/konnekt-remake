"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { findActiveUniversityBySlug } from "@/lib/services/universities";
import { getSignupDraft, saveVouchProof, startSignupDraft } from "@/lib/services/signup";
import { rateLimit } from "@/lib/security/rate-limit";
import { requestContext } from "@/lib/security/request";
import { hashIp } from "@/lib/crypto";
import type { FormState } from "@/lib/action-state";

const schema = z.object({
  slug: z.string().min(1).max(80),
  matricNumber: z.string().trim().min(3).max(32),
  voucherId: z.string().min(1, "Choose someone to vouch for you."),
});

export async function requestVouchAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = schema.safeParse({
    slug: formData.get("slug"),
    matricNumber: formData.get("matricNumber"),
    voucherId: formData.get("voucherId"),
  });
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return { error: issue?.message ?? "Check your details.", field: String(issue?.path[0] ?? "") };
  }

  const university = await findActiveUniversityBySlug(parsed.data.slug);
  if (!university) return { error: "That university is not available." };
  if (!university.vouchingEnabled) return { error: "Vouching is not available for this university." };

  const context = await requestContext();
  const limit = await rateLimit("vouchRequest", hashIp(context.ip) ?? "unknown");
  if (!limit.success) return { error: "Too many vouch requests. Try again tomorrow." };

  const draft = await startSignupDraft(university.id, "VOUCH");
  const saved = await saveVouchProof(draft, {
    matricNumber: parsed.data.matricNumber,
    voucherId: parsed.data.voucherId,
  });
  if (!saved.ok) return { error: saved.error, field: saved.field };

  const current = await getSignupDraft();
  if (!current) return { error: "Your signup session expired. Start again." };

  redirect(`/signup/${university.slug}/account`);
}
