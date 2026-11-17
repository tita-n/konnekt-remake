import { NextResponse } from "next/server";
import { rateLimit } from "@/lib/security/rate-limit";
import { assertSameOrigin } from "@/lib/security/request";
import { getSignupDraft, saveIdCardProof } from "@/lib/services/signup";
import { preparePrivateImage, ImageValidationError } from "@/lib/media/images";
import { deletePrivateImage, putPrivateImage } from "@/lib/media/private-store";
import { platformDb } from "@/lib/db/platform";
import { writeAudit } from "@/lib/audit";

export const runtime = "nodejs";

const MAX_IMAGE_BYTES = 6 * 1024 * 1024;

export async function POST(request: Request): Promise<NextResponse> {
  if (!(await assertSameOrigin())) {
    return NextResponse.json({ error: "Request blocked." }, { status: 403 });
  }

  const draft = await getSignupDraft();
  if (!draft) {
    return NextResponse.json({ error: "Your signup session expired. Start again." }, { status: 401 });
  }

  const limit = await rateLimit("upload", draft.id);
  if (!limit.success) {
    return NextResponse.json(
      { error: "Too many uploads. Try again later." },
      { status: 429, headers: { "Retry-After": String(limit.resetSeconds) } },
    );
  }

  const form = await request.formData();
  const file = form.get("file");
  const matricNumber = form.get("matricNumber");
  if (!(file instanceof File) || typeof matricNumber !== "string" || !matricNumber.trim()) {
    return NextResponse.json({ error: "Add your matric number and choose a photo of your ID." }, { status: 400 });
  }
  if (file.size > MAX_IMAGE_BYTES) {
    return NextResponse.json({ error: "That photo is too large. Choose one under 6 MB." }, { status: 413 });
  }

  let image;
  try {
    image = await preparePrivateImage(Buffer.from(await file.arrayBuffer()), file.type);
  } catch (error) {
    const message = error instanceof ImageValidationError ? error.message : "That photo could not be read.";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  const publicId = await putPrivateImage(image.buffer, `verification/${draft.universityId}`);
  const saved = await saveIdCardProof(draft, { matricNumber, idImageRef: publicId });
  if (!saved.ok) {
    await deletePrivateImage(publicId);
    return NextResponse.json({ error: saved.error, field: saved.field }, { status: 400 });
  }

  if (draft.idImageRef && draft.idImageRef !== publicId) {
    await deletePrivateImage(draft.idImageRef);
  }

  const university = await platformDb.university.findUnique({
    where: { id: draft.universityId },
    select: { id: true, shortName: true },
  });
  await writeAudit({
    actorId: null,
    universityId: draft.universityId,
    action: "signup.id_card_uploaded",
    targetType: "SignupDraft",
    targetId: draft.id,
    metadata: { bytes: image.buffer.byteLength, matricSubmitted: Boolean(matricNumber) },
  }).catch(() => undefined);

  return NextResponse.json({ ok: true, university: university?.shortName ?? null });
}
