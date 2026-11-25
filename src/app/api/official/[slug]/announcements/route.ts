import type { NextRequest } from "next/server";
import { apiError, noStore, readJson, socialApi } from "@/lib/api/social";
import { isAnnouncementCategory } from "@/lib/domain/announcements";
import { getOfficialAccountBySlug } from "@/lib/services/official";
import { createAnnouncement, listOfficialFeed } from "@/lib/services/announcements";
import type { EventAudienceKind } from "@/lib/domain/events";

const AUDIENCES: EventAudienceKind[] = ["PUBLIC", "COLLEGE", "FACULTY", "DEPARTMENT", "LEVEL"];

export async function GET(request: NextRequest) {
  const context = await socialApi(request);
  if ("response" in context) return context.response;
  try {
    const params = new URL(request.url).searchParams;
    return noStore(
      await listOfficialFeed(context.viewer, {
        category: isAnnouncementCategory(params.get("category")) ? params.get("category") as never : null,
        unreadOnly: params.get("unread") === "1",
        cursor: params.get("cursor"),
      }),
    );
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const context = await socialApi(request, { mutation: true });
  if ("response" in context) return context.response;
  try {
    const { slug } = await params;
    const account = await getOfficialAccountBySlug(context.viewer, slug);
    if (!account) return noStore({ error: "This official account isn't available." }, { status: 404 });
    const body = await readJson(request);
    if (!isAnnouncementCategory(body.category)) return noStore({ error: "Choose a category." }, { status: 400 });
    const audienceKind = AUDIENCES.includes(body.audienceKind as EventAudienceKind)
      ? (body.audienceKind as EventAudienceKind)
      : null;
    if (!audienceKind) return noStore({ error: "Choose an audience." }, { status: 400 });
    const attachments = Array.isArray(body.attachments)
      ? body.attachments.flatMap((entry) => {
          if (!entry || typeof entry !== "object") return [];
          const row = entry as Record<string, unknown>;
          return typeof row.fileKey === "string" &&
            typeof row.name === "string" &&
            typeof row.mimeType === "string" &&
            typeof row.sizeBytes === "number"
            ? [{ fileKey: row.fileKey, name: row.name, mimeType: row.mimeType, sizeBytes: row.sizeBytes }]
            : [];
        })
      : [];
    const publishNow = body.publishNow !== false;
    const publishAt = typeof body.publishAt === "string" ? new Date(body.publishAt) : new Date();
    const result = await createAnnouncement(context.viewer, {
      officialAccountId: account.id,
      category: body.category,
      title: typeof body.title === "string" ? body.title : "",
      body: typeof body.body === "string" ? body.body : "",
      critical: body.critical === true,
      audienceKind,
      audiencePath: Array.isArray(body.audiencePath)
        ? body.audiencePath.filter((value): value is string => typeof value === "string")
        : [],
      publishNow,
      publishAt,
      attachments,
      saveDraft: body.saveDraft === true,
    });
    return noStore(result, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}
