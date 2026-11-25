import type { Metadata } from "next";
import { requireStudent } from "@/lib/auth/guards";
import { SettingsNav } from "@/components/settings/settings-nav";
import { PrivacyForm } from "@/components/settings/privacy-form";

export const metadata: Metadata = { title: "Privacy" };

export default async function PrivacySettingsPage() {
  const user = await requireStudent("/settings/privacy");

  return (
    <div>
      <SettingsNav />
      <div className="px-4 pt-5">
        <h1 className="text-h1 text-fg">Privacy</h1>
        <p className="mt-1 text-small text-fg-muted">
          You are in control of what other students can see. We never share data across universities.
        </p>
        <div className="mt-5">
          <PrivacyForm
            departmentVisibility={user.departmentVisibility}
            levelVisibility={user.levelVisibility}
            showEventAttendance={user.showEventAttendance}
          />
        </div>
        <p className="mt-5 text-tiny leading-relaxed text-fg-subtle">
          Under the Nigeria Data Protection Act 2023 you can export or delete your data at any time. Both options live in
          Settings → About.
        </p>
      </div>
    </div>
  );
}
