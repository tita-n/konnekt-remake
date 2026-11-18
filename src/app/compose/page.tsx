import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireStudent } from "@/lib/auth/guards";
import { composerAudiences, listDrafts } from "@/lib/services/posts";
import { loadSocialViewer } from "@/lib/services/social";
import { Composer } from "@/components/pulse/composer";

export const metadata: Metadata = { title: "Create" };
export const dynamic = "force-dynamic";

export default async function ComposePage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string; draft?: string }>;
}) {
  const user = await requireStudent("/compose");
  const viewer = await loadSocialViewer(user);
  if (!viewer) redirect("/onboarding");
  const params = await searchParams;
  const type = params.type === "question" ? "QUESTION" : params.type === "poll" ? "POLL" : "POST";
  const draft = params.draft ? (await listDrafts(viewer)).find((item) => item.id === params.draft) ?? null : null;

  return (
    <Composer
      viewer={{
        id: viewer.userId,
        fullName: viewer.fullName,
        username: viewer.username,
        photoUrl: viewer.photoUrl,
        level: viewer.level,
        departmentName: viewer.lineage.department ?? viewer.labels.department,
      }}
      audiences={composerAudiences(viewer)}
      initialType={type}
      initialDraft={draft}
    />
  );
}
