import type { NextRequest } from "next/server";
import { apiError, noStore, readJson, socialApi } from "@/lib/api/social";
import { createCommunityInvite, listCommunityInvites } from "@/lib/services/communities";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const context = await socialApi(request);
  if ("response" in context) return context.response;
  try {
    const { id } = await params;
    return noStore({ invites: await listCommunityInvites(context.viewer, id) });
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const context = await socialApi(request, { mutation: true });
  if ("response" in context) return context.response;
  try {
    const { id } = await params;
    const body = await readJson(request);
    const kind = body.kind === "USER" ? "USER" : "LINK";
    const invite = await createCommunityInvite(context.viewer, id, {
      kind,
      username: typeof body.username === "string" ? body.username : undefined,
      days: typeof body.days === "number" ? body.days : undefined,
      maxUses: typeof body.maxUses === "number" ? body.maxUses : null,
    });
    return noStore({ invite }, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}
