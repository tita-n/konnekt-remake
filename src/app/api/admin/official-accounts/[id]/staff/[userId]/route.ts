import type { NextRequest } from "next/server";
import { apiError, noStore, socialApi } from "@/lib/api/social";
import { removeOfficialStaff } from "@/lib/services/official";

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; userId: string }> },
) {
  const context = await socialApi(request, { mutation: true });
  if ("response" in context) return context.response;
  try {
    const { id, userId } = await params;
    return noStore(await removeOfficialStaff(context.viewer, id, userId));
  } catch (error) {
    return apiError(error);
  }
}
