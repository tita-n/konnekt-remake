import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireUniversityRole } from "@/lib/auth/guards";
import { getUniversitySettings } from "@/lib/services/admin";
import { UniversitySettingsForm } from "@/components/admin/university-settings-form";

export const metadata: Metadata = { title: "University settings" };

export default async function UniversitySettingsPage() {
  const user = await requireUniversityRole(["UNIVERSITY_ADMIN"]);
  const settings = await getUniversitySettings(user.universityId);
  if (!settings) notFound();

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-h1 text-fg">University settings</h1>
        <p className="mt-1 max-w-2xl text-small text-fg-muted">
          The accent becomes the brand colour for every student here. It must pass contrast in both themes before it
          can be saved.
        </p>
      </header>
      <UniversitySettingsForm settings={settings} />
    </div>
  );
}
