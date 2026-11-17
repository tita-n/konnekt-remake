"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { findActiveUniversityBySlug } from "@/lib/services/universities";
import {
  completeSignup,
  getSignupDraft,
  saveAccountDetails,
} from "@/lib/services/signup";
import { issueEmailCode, verifyEmailCode } from "@/lib/services/email-codes";
import { isPasswordBreached } from "@/lib/auth/password";
import { createSession } from "@/lib/auth/session";
import { rateLimit } from "@/lib/security/rate-limit";
import { requestContext, turnstileToken } from "@/lib/security/request";
import { verifyTurnstile } from "@/lib/security/turnstile";
import { hashIp, sha256 } from "@/lib/crypto";
import {
  codeSchema,
  emailSchema,
  fullNameSchema,
  passwordSchema,
  usernameSchema,
} from "@/lib/validation/schemas";
import { writeAudit } from "@/lib/audit";
import { platformDb } from "@/lib/db/platform";
import type { FormState } from "@/lib/action-state";

const accountSchema = z.object({
  slug: z.string().min(1).max(80),
  fullName: fullNameSchema,
  username: usernameSchema,
  email: emailSchema,
  password: passwordSchema,
  consent: z.literal("on", { message: "Accept the Terms and Privacy Policy to continue." }),
});

async function afterComplete(draftId: string, universityId: string, universitySlug: string): Promise<never> {
  const completed = await completeSignup(draftId, true);
  if (!completed.ok) {
    redirect(`/signup/${universitySlug}/account?error=${encodeURIComponent(completed.error)}`);
  }
  await createSession(completed.data.userId, universityId);
  redirect("/onboarding");
}

export async function createAccountAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = accountSchema.safeParse({
    slug: formData.get("slug"),
    fullName: formData.get("fullName"),
    username: formData.get("username"),
    email: formData.get("email"),
    password: formData.get("password"),
    consent: formData.get("consent"),
  });
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return { error: issue?.message ?? "Check your details.", field: String(issue?.path[0] ?? "") };
  }

  const university = await findActiveUniversityBySlug(parsed.data.slug);
  if (!university) return { error: "That university is no longer available." };

  const context = await requestContext();
  const ipKey = hashIp(context.ip) ?? "unknown";
  const signupLimit = await rateLimit("signup", ipKey);
  if (!signupLimit.success) {
    return { error: "Too many sign-up attempts. Please try again later." };
  }

  const turnstile = await verifyTurnstile(turnstileToken(formData), context.ip);
  if (!turnstile.success) {
    return { error: "The human check didn't pass. Please try again." };
  }

  const draft = await getSignupDraft();
  if (!draft || draft.universityId !== university.id) {
    return { error: "Your signup session expired. Start again from the university page." };
  }

  if (await isPasswordBreached(parsed.data.password)) {
    return {
      error: "That password appears in known data breaches. Choose a different one.",
      field: "password",
    };
  }

  const email = draft.studentEmailVerifiedAt ? draft.studentEmail! : parsed.data.email;
  const saved = await saveAccountDetails(draft, {
    fullName: parsed.data.fullName,
    username: parsed.data.username,
    email,
    password: parsed.data.password,
  });
  if (!saved.ok) return { error: saved.error, field: saved.field };

  await writeAudit({
    actorId: null,
    universityId: university.id,
    action: "signup.account_details_saved",
    targetType: "SignupDraft",
    targetId: draft.id,
    metadata: { method: draft.method, emailDomain: email.split("@")[1] ?? null },
  }).catch(() => undefined);

  if (draft.studentEmailVerifiedAt) {
    await afterComplete(draft.id, university.id, university.slug);
  }

  const sendLimit = await rateLimit("emailCodeSend", sha256(`${university.id}:${email}`));
  if (!sendLimit.success) {
    return { error: "Too many codes requested. Wait a few minutes and try again." };
  }

  try {
    await issueEmailCode({
      email,
      purpose: "SIGNUP_EMAIL",
      universityId: university.id,
    });
  } catch {
    return { error: "We couldn't send the confirmation email. Try again in a moment." };
  }

  redirect(`/signup/${university.slug}/account/verify`);
}

export async function resendSignupCodeAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const draft = await getSignupDraft();
  if (!draft || !draft.pendingEmail) return { error: "Your signup session expired. Start again." };

  const context = await requestContext();
  const limit = await rateLimit("emailCodeSend", sha256(`${draft.universityId}:${draft.pendingEmail}`));
  if (!limit.success) return { error: "Wait a minute before requesting another code." };

  try {
    await issueEmailCode({
      email: draft.pendingEmail,
      purpose: "SIGNUP_EMAIL",
      universityId: draft.universityId,
    });
  } catch {
    return { error: "We couldn't resend that code. Try again." };
  }
  return { ok: true, message: "New code sent. It expires in 10 minutes.", sentAt: Date.now() };
}

export async function confirmAccountCodeAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsedCode = codeSchema.safeParse(formData.get("code"));
  if (!parsedCode.success) return { error: "Enter the 6-digit code from your email." };

  const draft = await getSignupDraft();
  if (!draft || !draft.pendingEmail) return { error: "Your signup session expired. Start again." };

  const context = await requestContext();
  const limit = await rateLimit("emailCodeVerify", hashIp(context.ip) ?? draft.id);
  if (!limit.success) return { error: "Too many attempts. Wait a few minutes and try again." };

  const result = await verifyEmailCode({
    email: draft.pendingEmail,
    purpose: "SIGNUP_EMAIL",
    code: parsedCode.data,
  });
  if (result !== "OK") {
    return {
      error:
        result === "EXPIRED"
          ? "That code expired. Request a new one."
          : result === "TOO_MANY"
            ? "Too many wrong attempts. Request a new code."
            : "That code is not correct. Check and try again.",
    };
  }

  const university = await platformDb.university.findUnique({
    where: { id: draft.universityId },
    select: { slug: true },
  });
  await afterComplete(draft.id, draft.universityId, university?.slug ?? "");
  // Unreachable: afterComplete always redirects. Keeps the return contract explicit.
  return { error: "Something went wrong. Try again." };
}
