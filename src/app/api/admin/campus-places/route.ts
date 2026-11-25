import type { NextRequest } from "next/server";
import { apiError, noStore, readJson, socialApi } from "@/lib/api/social";
import { createCampusPlace, listCampusPlaces } from "@/lib/services/event-admin";

export async function GET(request: NextRequest) {
  const context = await socialApi(request);
  if ("response" in context) return context.response;
  try {
    return noStore({ places: await listCampusPlaces(context.viewer) });
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: NextRequest) {
  const context = await socialApi(request, { mutation: true });
  if ("response" in context) return context.response;
  try {
    const body = await readJson(request);
    return noStore(
      await createCampusPlace(context.viewer, {
        name: typeof body.name === "string" ? body.name : "",
        latitude: body.latitude === null || body.latitude === undefined ? null : Number(body.latitude),
        longitude: body.longitude === null || body.longitude === undefined ? null : Number(body.longitude),
      }),
      { status: 201 },
    );
  } catch (error) {
    return apiError(error);
  }
}
