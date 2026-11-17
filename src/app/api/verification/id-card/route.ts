import { NextResponse } from "next/server";
import { assertCsrf, getSession } from "@/lib/auth/session";
import { rateLimit } from "@/lib/security/rate-limit";
import { assertSameOrigin } from "@/lib/security/request";
import { preparePrivateImage, ImageValidationError } from "@/lib/media/images";
import { putPrivateImage } from "@/lib/media/private-store";
import { submitIdVerification } from "@/lib/services/verification";

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
  const matricNumber = form.get("matricNumber");
  if (!(file instanceof File) || typeof matricNumber !== "string" || !matricNumber.trim()) {
    return NextResponse.json({ error: "Add your matric number and a photo of your ID." }, { status: 400 });
  }

  let image;
  try {
    image = await preparePrivateImage(Buffer.from(await file.arrayBuffer()), file.type);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof ImageValidationError ? error.message : "That photo could not be read." },
      { status: 400 },
    );
  }

  const publicId = await putPrivateImage(image.buffer, `verification/${current.user.universityId}`);
  const result = await submitIdVerification({
    userId: current.user.id,
    universityId: current.user.universityId,
    userStatus: current.user.status,
    matricNumber,
    idImageRef: publicId,
  });
  if (!result.ok) {
    return NextResponse.json({ error: result.error, field: result.field }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
