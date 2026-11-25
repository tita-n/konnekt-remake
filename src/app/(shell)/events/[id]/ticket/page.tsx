import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { requireStudent } from "@/lib/auth/guards";
import { loadSocialViewer } from "@/lib/services/social";
import { getTicketMeta } from "@/lib/services/events";
import { TicketCard } from "@/components/events/ticket-card";

export const metadata: Metadata = { title: "My ticket", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function TicketPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireStudent(`/events/${id}/ticket`);
  const viewer = await loadSocialViewer(user);
  if (!viewer) redirect("/onboarding");
  const meta = await getTicketMeta(viewer, id).catch(() => null);
  if (!meta) notFound();

  return (
    <div className="mx-auto w-full max-w-sm px-2 pt-4">
      <TicketCard meta={meta} />
    </div>
  );
}
