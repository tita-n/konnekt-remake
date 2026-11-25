import type { NextRequest } from "next/server";
import { apiError, noStore, readJson, socialApi } from "@/lib/api/social";
import { isOfficialCategory } from "@/lib/domain/official";
import { createOfficialAccount, getOfficialPostingContext } from "@/lib/services/official";

export async function GET(request: NextRequest) {
  const context = await socialApi(request);
  if ("response" in context) return context.response;
  try {
    return noStore(await getOfficialPostingContext(context.viewer));
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: NextRequest) {
  const context = await socialApi(request, { mutation: true });
  if ("response" in context) return context.response;
  try {
    const body = await readJson(request);
    if (!isOfficialCategory(body.category)) return noStore({ error: "Choose a category." }, { status: 400 });
    return noStore(
      await createOfficialAccount(context.viewer, {
        name: typeof body.name === "string" ? body.name : "",
        slug: typeof body.slug === "string" ? body.slug : undefined,
        category: body.category,
        description: typeof body.description === "string" ? body.description : "",
        avatarPublicId: typeof body.avatarPublicId === "string" ? body.avatarPublicId : null,
      }),
      { status: 201 },
    );
  } catch (error) {
    return apiError(error);
  }
}
