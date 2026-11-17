import type { Metadata } from "next";
import { requireStudent } from "@/lib/auth/guards";
import { SettingsNav } from "@/components/settings/settings-nav";
import { AppearanceSettings } from "@/components/settings/appearance-settings";

export const metadata: Metadata = { title: "Appearance" };

export default async function AppearanceSettingsPage() {
  await requireStudent("/settings/appearance");
  return (
    <div>
      <SettingsNav />
      <div className="px-4 pt-5">
        <h1 className="text-h1 text-fg">Appearance</h1>
        <p className="mt-1 text-small text-fg-muted">Make Konnekt comfortable for your eyes and your data plan.</p>
        <div className="mt-5">
          <AppearanceSettings />
        </div>
      </div>
    </div>
  );
}
