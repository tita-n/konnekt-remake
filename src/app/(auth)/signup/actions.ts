"use server";

import { z } from "zod";
import { headers } from "next/headers";
import { platformDb } from "@/lib/db/platform";
import { rateLimit } from "@/lib/security/rate-limit";
import { emailSchema } from "@/lib/validation/schemas";
import { hashIp } from "@/lib/crypto";
import { writeAudit } from "@/lib/audit";
import type { FormState } from "@/lib/action-state";

const waitlistSchema = z.object({
  kind: z.enum(["UNIVERSITY", "STUDENT"]),
  email: emailSchema,
  universityName: z.string().trim().max(120).optional(),
});

export async function joinWaitlistAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = waitlistSchema.safeParse({
    kind: formData.get("kind"),
    email: formData.get("email"),
    universityName: formData.get("universityName") || undefined,
  });
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return { error: issue?.message ?? "Check your details.", field: String(issue?.path[0] ?? "") };
  }
  if (parsed.data.kind === "UNIVERSITY" && !parsed.data.universityName) {
    return { error: "Tell us which university you want to see.", field: "universityName" };
  }

  const headerStore = await headers();
  const ip = headerStore.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const limit = await rateLimit("waitlist", hashIp(ip) ?? "unknown");
  if (!limit.success) {
    return { error: "Too many requests. Please try again a little later." };
  }

  await platformDb.waitlistEntry.create({
    data: {
      kind: parsed.data.kind,
      email: parsed.data.email,
      universityName: parsed.data.universityName ?? null,
    },
  });

  await writeAudit({
    actorId: null,
    universityId: null,
    action: "waitlist.joined",
    targetType: "WaitlistEntry",
    metadata: { kind: parsed.data.kind },
    ip,
  }).catch(() => undefined);

  return {
    ok: true,
    message:
      parsed.data.kind === "UNIVERSITY"
        ? "Thanks — we'll let you know when that university opens on Konnekt."
        : "You're on the list. We'll email you when your university joins Konnekt.",
  };
}
