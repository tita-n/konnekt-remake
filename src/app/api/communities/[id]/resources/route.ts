import type { NextRequest } from "next/server";
import { apiError, noStore, readJson, socialApi } from "@/lib/api/social";
import { COMMUNITY_CATEGORIES, type CommunityCategory } from "@/lib/domain/community";
import { createFileResource, createLinkResource, listCommunityResources } from "@/lib/services/communities";
import { deleteResourceFile, storeResourceFile } from "@/lib/media/resource-store";
import { MAX_RESOURCE_BYTES } from "@/lib/domain/community";

export const runtime = "nodejs";

function category(value: FormDataEntryValue | string | null): CommunityCategory {
  return typeof value === "string" && COMMUNITY_CATEGORIES.some((entry) => entry.value === value)
    ? (value as CommunityCategory)
    : "OTHER";
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const context = await socialApi(request);
  if ("response" in context) return context.response;
  try {
    const { id } = await params;
    const url = new URL(request.url);
    const categoryValue = category(url.searchParams.get("category"));
    return noStore({
      resources: await listCommunityResources(context.viewer, id, {
        category: url.searchParams.get("category") ? categoryValue : null,
        kind: url.searchParams.get("kind") === "LINK" ? "LINK" : url.searchParams.get("kind") === "FILE" ? "FILE" : null,
        q: url.searchParams.get("q") ?? undefined,
      }),
    });
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const context = await socialApi(request, { mutation: true });
  if ("response" in context) return context.response;
  try {
    const { id } = await params;
    if (!request.headers.get("content-type")?.includes("multipart/form-data")) {
      const body = await readJson(request);
      const resource = await createLinkResource(context.viewer, id, {
        title: typeof body.title === "string" ? body.title : "",
        description: typeof body.description === "string" ? body.description : undefined,
        category: category(typeof body.category === "string" ? body.category : null),
        url: typeof body.url === "string" ? body.url : "",
      });
      return noStore({ resource }, { status: 201 });
    }
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) return noStore({ error: "Choose a file." }, { status: 400 });
    if (file.size > MAX_RESOURCE_BYTES) return noStore({ error: "Files can be up to 10 MB." }, { status: 413 });
    let stored;
    try {
      stored = await storeResourceFile({
        filename: file.name,
        contentType: file.type,
        bytes: Buffer.from(await file.arrayBuffer()),
      });
    } catch (error) {
      return noStore(
        { error: error instanceof Error ? error.message : "That file isn't valid." },
        { status: 400 },
      );
    }
    try {
      const resource = await createFileResource(context.viewer, id, {
        title: typeof form.get("title") === "string" ? String(form.get("title")) : file.name,
        description: typeof form.get("description") === "string" ? String(form.get("description")) : undefined,
        category: category(form.get("category")),
        fileKey: stored.fileKey,
        mimeType: stored.mimeType,
        sizeBytes: stored.sizeBytes,
      });
      return noStore({ resource }, { status: 201 });
    } catch (error) {
      await deleteResourceFile(stored.fileKey).catch(() => undefined);
      throw error;
    }
  } catch (error) {
    return apiError(error);
  }
}
