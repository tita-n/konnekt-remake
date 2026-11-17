"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { authenticate } from "@/lib/services/login";
import { createSession, revokeCurrentSession } from "@/lib/auth/session";
import { landingPath, safeNextPath } from "@/lib/auth/landing";
import { rateLimit } from "@/lib/security/rate-limit";
import { requestContext, turnstileToken } from "@/lib/security/request";
import { verifyTurnstile } from "@/lib/security/turnstile";
import { hashIp, sha256 } from "@/lib/crypto";
import { writeAudit } from "@/lib/audit";
import type { FormState } from "@/lib/action-state";

const loginSchema = z.object({
  identifier: z.string().trim().min(3, "Enter your email or username.").max(254),
  password: z.string().min(1, "Enter your password.").max(128),
  next: z.string().optional(),
});

const GENERIC = "That email/username and password don't match.";

export async function loginAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = loginSchema.safeParse({
    identifier: formData.get("identifier"),
    password: formData.get("password"),
    next: (formData.get("next") as string | null) ?? undefined,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check your details.", field: "identifier" };
  }

  const context = await requestContext();
  const ipKey = hashIp(context.ip) ?? "unknown";
  const identifierKey = sha256(parsed.data.identifier.toLowerCase());

  const [perIp, perIdentifier] = await Promise.all([
    rateLimit("login", ipKey),
    rateLimit("loginIdentifier", identifierKey),
  ]);
  if (!perIp.success || !perIdentifier.success) {
    return { error: "Too many attempts. Wait a few minutes and try again." };
  }

  const turnstile = await verifyTurnstile(turnstileToken(formData), context.ip);
  if (!turnstile.success) {
    return { error: "The human check didn't pass. Please try again." };
  }

  const result = await authenticate(parsed.data.identifier, parsed.data.password);
  if (!result.ok) {
    await writeAudit({
      actorId: null,
      universityId: null,
      action: "auth.login_failed",
      targetType: "User",
      metadata: { identifierHash: identifierKey.slice(0, 12), reason: result.reason },
      ip: context.ip,
    }).catch(() => undefined);
    return {
      error:
        result.reason === "UNIVERSITY_OFF"
          ? "Your university's Konnekt space is temporarily unavailable. Contact your university admin."
          : GENERIC,
    };
  }

  // Session rotation: any existing session on this browser is destroyed first.
  await revokeCurrentSession().catch(() => undefined);
  await createSession(result.user.id, result.user.universityId);

  await writeAudit({
    actorId: result.user.id,
    universityId: result.user.universityId,
    action: "auth.login",
    targetType: "User",
    targetId: result.user.id,
    ip: context.ip,
  }).catch(() => undefined);

  const next = safeNextPath(parsed.data.next);
  redirect(next ?? landingPath({
    status: result.user.status as "VERIFIED",
    departmentNodeId: result.user.departmentNodeId,
    level: result.user.level,
  }));
}
