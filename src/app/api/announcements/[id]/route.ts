import type { NextRequest } from "next/server";
import { apiError, noStore, readJson, socialApi } from "@/lib/api/social";
import { isAnnouncementCategory } from "@/lib/domain/announcements";
import type { EventAudienceKind } from "@/lib/domain/events";
import { getAnnouncementDetail, updateAnnouncement } from "@/lib/services/announcements";

const AUDIENCES: EventAudienceKind[] = ["PUBLIC", "COLLEGE", "FACULTY", "DEPARTMENT", "LEVEL"];

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const context = await socialApi(request);
  if ("response" in context) return context.response;
  try {
    const { id } = await params;
    return noStore(await getAnnouncementDetail(context.viewer, id));
  } catch (error) {
    return apiError(error);
  }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const context = await socialApi(request, { mutation: true });
  if ("response" in context) return context.response;
  try {
    const { id } = await params;
    const body = await readJson(request);
    return noStore(
      await updateAnnouncement(context.viewer, id, {
        title: typeof body.title === "string" ? body.title : undefined,
        body: typeof body.body === "string" ? body.body : undefined,
        category: isAnnouncementCategory(body.category) ? body.category : undefined,
        critical: typeof body.critical === "boolean" ? body.critical : undefined,
        audienceKind: AUDIENCES.includes(body.audienceKind as EventAudienceKind)
          ? (body.audienceKind as EventAudienceKind)
          : undefined,
        audiencePath: Array.isArray(body.audiencePath)
          ? body.audiencePath.filter((value): value is string => typeof value === "string")
          : undefined,
        publishNow: typeof body.publishNow === "boolean" ? body.publishNow : undefined,
        publishAt: typeof body.publishAt === "string" ? new Date(body.publishAt) : undefined,
        saveDraft: typeof body.saveDraft === "boolean" ? body.saveDraft : undefined,
        archive: body.archive === true,
      }),
    );
  } catch (error) {
    return apiError(error);
  }
}
