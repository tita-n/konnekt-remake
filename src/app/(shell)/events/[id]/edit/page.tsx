import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { requireStudent } from "@/lib/auth/guards";
import { loadSocialViewer } from "@/lib/services/social";
import { getEventDetail } from "@/lib/services/events";
import { getEventComposerOptions } from "@/lib/services/event-options";
import { EventForm } from "@/components/events/event-form";

export const metadata: Metadata = { title: "Edit event" };
export const dynamic = "force-dynamic";

export default async function EditEventPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireStudent(`/events/${id}/edit`);
  const viewer = await loadSocialViewer(user);
  if (!viewer) redirect("/onboarding");
  const [detail, options] = await Promise.all([
    getEventDetail(viewer, id, { recordView: false }).catch(() => null),
    getEventComposerOptions(viewer),
  ]);
  if (!detail || !detail.permissions.canEdit) notFound();

  return (
    <div className="mx-auto w-full max-w-2xl">
      <EventForm mode="edit" timezone={viewer.timezone} options={options} event={detail.event} />
    </div>
  );
}
