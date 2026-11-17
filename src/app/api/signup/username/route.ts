import { NextResponse } from "next/server";
import { usernameSchema } from "@/lib/validation/schemas";
import { platformDb } from "@/lib/db/platform";
import { rateLimit } from "@/lib/security/rate-limit";
import { hashIp } from "@/lib/crypto";
import { requestContext } from "@/lib/security/request";

export async function GET(request: Request): Promise<NextResponse> {
  const context = await requestContext();
  const limit = await rateLimit("usernameCheck", hashIp(context.ip) ?? "unknown");
  if (!limit.success) {
    return NextResponse.json({ available: false, reason: "RATE_LIMITED" }, { status: 429 });
  }

  const value = new URL(request.url).searchParams.get("username") ?? "";
  const parsed = usernameSchema.safeParse(value);
  if (!parsed.success) {
    return NextResponse.json({ available: false, reason: parsed.error.issues[0]?.message ?? "Invalid username." });
  }

  const existing = await platformDb.user.findUnique({
    where: { username: parsed.data },
    select: { id: true },
  });
  if (existing) return NextResponse.json({ available: false, reason: "That username is taken." });

  return NextResponse.json({ available: true, username: parsed.data });
}
