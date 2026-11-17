import { NextResponse } from "next/server";
import { getSession, assertCsrf } from "@/lib/auth/session";
import { rateLimit } from "@/lib/security/rate-limit";
import { assertSameOrigin } from "@/lib/security/request";
import { prepareAvatar } from "@/lib/media/images";
import { putPublicAvatar } from "@/lib/media/avatar-store";
import { tenantDb } from "@/lib/db/tenant";
import { writeAudit } from "@/lib/audit";

export const runtime = "nodejs";

export async function POST(request: Request): Promise<NextResponse> {
  const current = await getSession();
  if (!current) return NextResponse.json({ error: "Log in first." }, { status: 401 });
  if (!(await assertSameOrigin()) || !(await assertCsrf(request))) {
    return NextResponse.json({ error: "Request blocked." }, { status: 403 });
  }

  const limit = await rateLimit("upload", current.user.id);
  if (!limit.success) {
    return NextResponse.json({ error: "Too many uploads. Try again later." }, { status: 429 });
  }

  const form = await request.formData();
  const file = form.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "Choose a photo." }, { status: 400 });
  if (file.size > 6 * 1024 * 1024) return NextResponse.json({ error: "That photo is too large." }, { status: 413 });

  let avatar: Buffer;
  try {
    avatar = await prepareAvatar(Buffer.from(await file.arrayBuffer()));
  } catch {
    return NextResponse.json({ error: "That photo is not readable. Try another." }, { status: 400 });
  }

  let photoUrl: string;
  try {
    photoUrl = await putPublicAvatar(avatar);
  } catch {
    return NextResponse.json({ error: "Upload failed. Try again." }, { status: 502 });
  }

  const db = tenantDb(current.user.universityId);
  await db.user.update({ where: { id: current.user.id }, data: { photoUrl } });
  await writeAudit({
    actorId: current.user.id,
    universityId: current.user.universityId,
    action: "profile.photo_updated",
    targetType: "User",
    targetId: current.user.id,
  }).catch(() => undefined);

  return NextResponse.json({ ok: true, photoUrl });
}
