import type { NextRequest } from "next/server";
import { apiError, noStore, readJson, socialApi } from "@/lib/api/social";
import { addOfficialStaff, listOfficialStaff, searchVerifiedStudents } from "@/lib/services/official";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const context = await socialApi(request);
  if ("response" in context) return context.response;
  try {
    const { id } = await params;
    const q = new URL(request.url).searchParams.get("q");
    const [staff, candidates] = await Promise.all([
      listOfficialStaff(context.viewer, id),
      q ? searchVerifiedStudents(context.viewer, q) : Promise.resolve([]),
    ]);
    return noStore({ staff, candidates });
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
    return noStore(await addOfficialStaff(context.viewer, id, body.userId, body.canPublishCritical === true), { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}
