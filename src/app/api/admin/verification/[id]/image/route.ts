import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { tenantDb } from "@/lib/db/tenant";
import { readLocalPrivateImage, signedPrivateUrl } from "@/lib/media/private-store";
import { hasRole } from "@/lib/auth/guards";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Authorised ID image access. The image reference never leaves the server:
 * reviewers get either the local dev file or a 120-second signed URL.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const current = await getSession();
  if (!current) return NextResponse.json({ error: "Log in first." }, { status: 401 });
  const { user } = current;
  const canReview = hasRole(user, "REVIEWER") || hasRole(user, "UNIVERSITY_ADMIN");
  if (!canReview) return NextResponse.json({ error: "Not found." }, { status: 404 });

  const { id } = await params;
  const request = await tenantDb(user.universityId).verificationRequest.findFirst({
    where: { id },
    select: { id: true, idImageRef: true, status: true, userId: true },
  });
  if (!request || !request.idImageRef) return NextResponse.json({ error: "No image." }, { status: 404 });

  const local = await readLocalPrivateImage(request.idImageRef);
  if (local) {
    return new NextResponse(new Uint8Array(local), {
      headers: {
        "Content-Type": "image/jpeg",
        "Cache-Control": "private, no-store, max-age=0",
        "X-Content-Type-Options": "nosniff",
      },
    });
  }

  const signed = signedPrivateUrl(request.idImageRef, 120);
  if (!signed) return NextResponse.json({ error: "Image unavailable." }, { status: 404 });
  return NextResponse.redirect(signed, {
    headers: { "Cache-Control": "private, no-store, max-age=0" },
  });
}
