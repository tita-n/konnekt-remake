import { NextResponse } from "next/server";
import { getSession, assertCsrf } from "@/lib/auth/session";
import { hasRole } from "@/lib/auth/guards";
import { assertSameOrigin } from "@/lib/security/request";
import { rateLimit } from "@/lib/security/rate-limit";
import { prepareAvatar } from "@/lib/media/images";
import { putPublicAvatar } from "@/lib/media/avatar-store";
import { platformDb } from "@/lib/db/platform";
import { writeAudit } from "@/lib/audit";

export const runtime = "nodejs";

/** University logos are public brand images; uploads are admin-only and audited. */
export async function POST(request: Request): Promise<NextResponse> {
  const current = await getSession();
  if (!current) return NextResponse.json({ error: "Log in first." }, { status: 401 });
  const { user } = current;
  if (!hasRole(user, "UNIVERSITY_ADMIN")) return NextResponse.json({ error: "Not found." }, { status: 404 });
  if (!(await assertSameOrigin()) || !(await assertCsrf(request))) {
    return NextResponse.json({ error: "Request blocked." }, { status: 403 });
  }
  const limit = await rateLimit("upload", `logo:${user.id}`);
  if (!limit.success) return NextResponse.json({ error: "Too many uploads. Try again later." }, { status: 429 });

  const form = await request.formData();
  const file = form.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "Choose an image." }, { status: 400 });
  if (file.size > 6 * 1024 * 1024) return NextResponse.json({ error: "That image is too large." }, { status: 413 });

  let logo: Buffer;
  try {
    logo = await prepareAvatar(Buffer.from(await file.arrayBuffer()));
  } catch {
    return NextResponse.json({ error: "That image is not readable. Try a PNG or JPG." }, { status: 400 });
  }

  let logoUrl: string;
  try {
    logoUrl = await putPublicAvatar(logo);
  } catch {
    return NextResponse.json({ error: "Upload failed. Try again." }, { status: 502 });
  }

  await platformDb.university.update({ where: { id: user.universityId }, data: { logoUrl } });
  await writeAudit({
    actorId: user.id,
    universityId: user.universityId,
    action: "university.logo_updated",
    targetType: "University",
    targetId: user.universityId,
  });
  return NextResponse.json({ url: logoUrl });
}
