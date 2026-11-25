import type { NextRequest } from "next/server";
import { apiError, noStore, readJson, socialApi } from "@/lib/api/social";
import { deleteCampusPlace, updateCampusPlace } from "@/lib/services/event-admin";

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const context = await socialApi(request, { mutation: true });
  if ("response" in context) return context.response;
  try {
    const { id } = await params;
    const body = await readJson(request);
    return noStore(
      await updateCampusPlace(context.viewer, id, {
        name: typeof body.name === "string" ? body.name : undefined,
        active: typeof body.active === "boolean" ? body.active : undefined,
        latitude: body.latitude === null ? null : body.latitude === undefined ? undefined : Number(body.latitude),
        longitude: body.longitude === null ? null : body.longitude === undefined ? undefined : Number(body.longitude),
      }),
    );
  } catch (error) {
    return apiError(error);
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const context = await socialApi(request, { mutation: true });
  if ("response" in context) return context.response;
  try {
    const { id } = await params;
    return noStore(await deleteCampusPlace(context.viewer, id));
  } catch (error) {
    return apiError(error);
  }
}
