import type { Metadata } from "next";
import { requireStudent } from "@/lib/auth/guards";
import { listDepartmentChoices } from "@/lib/services/academic";
import { INTEREST_CATALOG } from "@/lib/domain/interests";
import { SettingsNav } from "@/components/settings/settings-nav";
import { ProfileEditForm } from "@/components/settings/profile-edit-form";

export const metadata: Metadata = { title: "Edit profile" };

export default async function EditProfilePage() {
  const user = await requireStudent("/settings/profile");
  const departments = await listDepartmentChoices(user.universityId);

  return (
    <div>
      <SettingsNav />
      <div className="px-4 pt-5">
        <h1 className="text-h1 text-fg">Edit profile</h1>
        <p className="mt-1 text-small text-fg-muted">Changes are visible to verified students at your university.</p>
        <div className="mt-5">
          <ProfileEditForm
            initial={{
              fullName: user.fullName,
              bio: user.bio ?? "",
              departmentId: user.departmentNodeId ?? "",
              level: user.level,
              isPostgraduate: user.isPostgraduate,
              interests: user.interests,
              photoUrl: user.photoUrl,
            }}
            departments={departments}
            interests={[...INTEREST_CATALOG]}
          />
        </div>
      </div>
    </div>
  );
}
