import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireStudent } from "@/lib/auth/guards";
import { loadSocialViewer } from "@/lib/services/social";
import { getEventComposerOptions } from "@/lib/services/event-options";
import { EventForm } from "@/components/events/event-form";

export const metadata: Metadata = { title: "Create event" };
export const dynamic = "force-dynamic";

export default async function NewEventPage() {
  const user = await requireStudent("/events/new");
  const viewer = await loadSocialViewer(user);
  if (!viewer) redirect("/onboarding");
  const options = await getEventComposerOptions(viewer);

  return (
    <div className="mx-auto w-full max-w-2xl">
      <EventForm mode="create" timezone={viewer.timezone} options={options} />
    </div>
  );
}
