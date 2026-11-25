import type { NextRequest } from "next/server";
import { apiError, noStore, readJson, socialApi } from "@/lib/api/social";
import { isOfficialCategory } from "@/lib/domain/official";
import { updateOfficialAccount } from "@/lib/services/official";

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const context = await socialApi(request, { mutation: true });
  if ("response" in context) return context.response;
  try {
    const { id } = await params;
    const body = await readJson(request);
    return noStore(
      await updateOfficialAccount(context.viewer, id, {
        name: typeof body.name === "string" ? body.name : undefined,
        category: isOfficialCategory(body.category) ? body.category : undefined,
        description: typeof body.description === "string" ? body.description : undefined,
        avatarPublicId: body.avatarPublicId === null ? null : typeof body.avatarPublicId === "string" ? body.avatarPublicId : undefined,
        status: body.status === "ACTIVE" || body.status === "SUSPENDED" ? body.status : undefined,
      }),
    );
  } catch (error) {
    return apiError(error);
  }
}
