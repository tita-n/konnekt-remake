"use server";

import { z } from "zod";
import { requestPasswordReset } from "@/lib/services/password-reset";
import { rateLimit } from "@/lib/security/rate-limit";
import { requestContext, turnstileToken } from "@/lib/security/request";
import { verifyTurnstile } from "@/lib/security/turnstile";
import { hashIp, sha256 } from "@/lib/crypto";
import { emailSchema } from "@/lib/validation/schemas";
import type { FormState } from "@/lib/action-state";

const schema = z.object({ email: emailSchema });

export async function forgotPasswordAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = schema.safeParse({ email: formData.get("email") });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Enter your email address.", field: "email" };
  }

  const context = await requestContext();
  const limit = await rateLimit("passwordResetRequest", `${sha256(parsed.data.email)}:${hashIp(context.ip) ?? ""}`);
  if (!limit.success) {
    return { error: "Too many reset requests. Try again in an hour." };
  }

  const turnstile = await verifyTurnstile(turnstileToken(formData), context.ip);
  if (!turnstile.success) {
    return { error: "The human check didn't pass. Please try again." };
  }

  await requestPasswordReset(parsed.data.email);

  // Deliberately identical whether or not the address exists.
  return {
    ok: true,
    message: "If an account exists for that email, a reset link is on its way. It expires in 30 minutes.",
  };
}
