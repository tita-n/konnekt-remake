"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { findActiveUniversityBySlug } from "@/lib/services/universities";
import { rateLimit } from "@/lib/security/rate-limit";
import { requestContext } from "@/lib/security/request";
import { hashIp, sha256 } from "@/lib/crypto";
import { issueEmailCode, verifyEmailCode } from "@/lib/services/email-codes";
import {
  getSignupDraft,
  markStudentEmailVerified,
  stageStudentEmail,
  startSignupDraft,
} from "@/lib/services/signup";
import { emailSchema, codeSchema } from "@/lib/validation/schemas";
import { writeAudit } from "@/lib/audit";
import type { FormState } from "@/lib/action-state";

const inputSchema = z.object({
  slug: z.string().min(1).max(80),
  email: emailSchema,
  code: z.string().optional(),
});

export async function studentEmailAction(prev: FormState, formData: FormData): Promise<FormState> {
  const intent = formData.get("intent") === "verify" ? "verify" : "send";
  const parsed = inputSchema.safeParse({
    slug: formData.get("slug"),
    email: formData.get("email"),
    code: (formData.get("code") as string | null) ?? undefined,
  });
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return { error: issue?.message ?? "Check your email address.", field: String(issue?.path[0] ?? "email") };
  }

  const university = await findActiveUniversityBySlug(parsed.data.slug);
  if (!university) return { error: "That university is not available." };

  const context = await requestContext();
  const ipKey = hashIp(context.ip) ?? "unknown";
  const emailKey = sha256(`${university.id}:${parsed.data.email}`);

  if (intent === "send") {
    const [perEmail, perIp] = await Promise.all([
      rateLimit("emailCodeSend", emailKey),
      rateLimit("emailCodeSendIp", ipKey),
    ]);
    if (!perEmail.success || !perIp.success) {
      return { error: "Too many codes requested. Wait a few minutes and try again.", retryAfter: 60 };
    }

    const draft = await startSignupDraft(university.id, "STUDENT_EMAIL");
    const staged = await stageStudentEmail(draft, parsed.data.email);
    if (!staged.ok) return { error: staged.error, field: staged.field };

    try {
      await issueEmailCode({
        email: parsed.data.email,
        purpose: "STUDENT_EMAIL",
        universityId: university.id,
      });
    } catch {
      return { error: "We couldn't send that email right now. Try again in a moment." };
    }

    return { ok: true, step: "code", email: parsed.data.email, sentAt: Date.now() };
  }

  const code = formData.get("code");
  const parsedCode = codeSchema.safeParse(code);
  if (!parsedCode.success) return { error: "Enter the 6-digit code from your email.", step: "code", email: parsed.data.email };

  const verifyLimit = await rateLimit("emailCodeVerify", emailKey);
  if (!verifyLimit.success) return { error: "Too many attempts. Wait a few minutes.", step: "code", email: parsed.data.email };

  const draft = await getSignupDraft();
  if (!draft || draft.universityId !== university.id || draft.studentEmail !== parsed.data.email) {
    return { error: "That code does not match this signup. Start again.", step: "email" };
  }

  const result = await verifyEmailCode({
    email: parsed.data.email,
    purpose: "STUDENT_EMAIL",
    code: parsedCode.data,
  });
  if (result !== "OK") {
    return {
      error:
        result === "EXPIRED"
          ? "That code has expired. Request a new one."
          : result === "TOO_MANY"
            ? "Too many wrong attempts. Request a new code."
            : "That code is not correct. Check and try again.",
      step: "code",
      email: parsed.data.email,
    };
  }

  await markStudentEmailVerified(draft);
  await writeAudit({
    actorId: null,
    universityId: university.id,
    action: "signup.student_email_verified",
    targetType: "SignupDraft",
    targetId: draft.id,
    metadata: { domain: parsed.data.email.split("@")[1] ?? null },
  }).catch(() => undefined);

  redirect(`/signup/${university.slug}/account`);
}
