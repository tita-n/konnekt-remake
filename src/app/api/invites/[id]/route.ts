import type { NextRequest } from "next/server";
import { apiError, noStore, socialApi } from "@/lib/api/social";
import { declineInvitation } from "@/lib/services/communities";

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const context = await socialApi(request, { mutation: true });
  if ("response" in context) return context.response;
  try {
    const { id } = await params;
    await declineInvitation(context.viewer, id);
    return noStore({ ok: true });
  } catch (error) {
    return apiError(error);
  }
}
