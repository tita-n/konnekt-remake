import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { requireStudent } from "@/lib/auth/guards";
import { loadSocialViewer } from "@/lib/services/social";
import { getEventDetail } from "@/lib/services/events";
import { EventDetail } from "@/components/events/event-detail";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  return { title: "Event", alternates: { canonical: `/events/${id}` } };
}

export default async function EventDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireStudent(`/events/${id}`);
  const viewer = await loadSocialViewer(user);
  if (!viewer) redirect("/onboarding");
  const detail = await getEventDetail(viewer, id).catch(() => null);
  if (!detail) notFound();

  return (
    <div className="mx-auto w-full max-w-2xl">
      <EventDetail
        detail={detail}
        currentUser={{ id: viewer.userId, fullName: viewer.fullName, photoUrl: viewer.photoUrl }}
      />
    </div>
  );
}
