import type { Metadata } from "next";
import { requireUniversityRole } from "@/lib/auth/guards";
import { listCampusPlaces } from "@/lib/services/event-admin";
import { loadSocialViewer } from "@/lib/services/social";
import { PlacesConsole } from "@/components/admin/places-console";

export const metadata: Metadata = { title: "Campus places" };
export const dynamic = "force-dynamic";

export default async function AdminPlacesPage() {
  const user = await requireUniversityRole(["UNIVERSITY_ADMIN"]);
  const viewer = await loadSocialViewer(user);
  if (!viewer) return null;
  const places = await listCampusPlaces(viewer);
  return (
    <div className="px-4 py-5">
      <PlacesConsole initialPlaces={places} />
    </div>
  );
}
