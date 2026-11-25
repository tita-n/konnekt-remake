import type { NextRequest } from "next/server";
import { apiError, noStore, socialApi } from "@/lib/api/social";
import { getOfficialAccountBySlug } from "@/lib/services/official";

export async function GET(request: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const context = await socialApi(request);
  if ("response" in context) return context.response;
  try {
    const { slug } = await params;
    const account = await getOfficialAccountBySlug(context.viewer, slug);
    if (!account) return noStore({ error: "This official account isn't available." }, { status: 404 });
    return noStore({ account });
  } catch (error) {
    return apiError(error);
  }
}
