"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { completePasswordReset } from "@/lib/services/password-reset";
import { passwordSchema } from "@/lib/validation/schemas";
import { rateLimit } from "@/lib/security/rate-limit";
import { requestContext } from "@/lib/security/request";
import { hashIp } from "@/lib/crypto";
import type { FormState } from "@/lib/action-state";

const schema = z
  .object({
    token: z.string().min(10).max(200),
    password: passwordSchema,
    confirm: z.string(),
  })
  .refine((value) => value.password === value.confirm, {
    message: "Those passwords don't match.",
    path: ["confirm"],
  });

export async function resetPasswordAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = schema.safeParse({
    token: formData.get("token"),
    password: formData.get("password"),
    confirm: formData.get("confirm"),
  });
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return { error: issue?.message ?? "Check your new password.", field: String(issue?.path[0] ?? "") };
  }

  const context = await requestContext();
  const limit = await rateLimit("passwordResetComplete", hashIp(context.ip) ?? "unknown");
  if (!limit.success) return { error: "Too many attempts. Try again later." };

  const result = await completePasswordReset(parsed.data.token, parsed.data.password);
  if (!result.ok) {
    return {
      error:
        result.reason === "EXPIRED"
          ? "That reset link has expired. Request a new one."
          : result.reason === "BREACHED"
            ? "That password appears in known data breaches. Choose a different one."
            : "That reset link is not valid. Request a new one.",
      field: result.reason === "BREACHED" ? "password" : undefined,
    };
  }

  redirect("/login?reset=1");
}
