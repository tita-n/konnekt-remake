import type { NextRequest } from "next/server";
import { apiError, noStore, readJson, socialApi } from "@/lib/api/social";
import { addEventStaff, listEventStaff, removeEventStaff } from "@/lib/services/events";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const context = await socialApi(request);
  if ("response" in context) return context.response;
  try {
    const { id } = await params;
    return noStore({ staff: await listEventStaff(context.viewer, id) });
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
    if (typeof body.userId !== "string") return noStore({ error: "Choose a student." }, { status: 400 });
    const role = body.role === "HOST" ? "HOST" : "CHECKIN";
    return noStore(await addEventStaff(context.viewer, id, body.userId, role), { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const context = await socialApi(request, { mutation: true });
  if ("response" in context) return context.response;
  try {
    const { id } = await params;
    const body = await readJson(request);
    if (typeof body.userId !== "string") return noStore({ error: "Choose a staff member." }, { status: 400 });
    return noStore(await removeEventStaff(context.viewer, id, body.userId));
  } catch (error) {
    return apiError(error);
  }
}
