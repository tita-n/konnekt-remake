import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireStudent } from "@/lib/auth/guards";
import { loadSocialViewer } from "@/lib/services/social";
import { NewCommunityForm } from "@/components/communities/new-community-form";

export const metadata: Metadata = { title: "New community" };
export const dynamic = "force-dynamic";

export default async function NewCommunityPage() {
  const user = await requireStudent("/communities/new");
  const viewer = await loadSocialViewer(user);
  if (!viewer) redirect("/onboarding");
  return <NewCommunityForm />;
}
