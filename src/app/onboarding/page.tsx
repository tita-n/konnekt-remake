import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { listDepartmentChoices } from "@/lib/services/academic";
import { INTEREST_CATALOG } from "@/lib/domain/interests";
import { accentCssVars } from "@/lib/domain/color";
import { OnboardingWizard } from "@/components/student/onboarding-wizard";
import { Wordmark } from "@/components/brand/logo";

export const metadata: Metadata = { title: "Finish your profile" };

export default async function OnboardingPage() {
  const session = await getSession();
  if (!session) redirect("/login?next=/onboarding");
  const { user } = session;
  if (user.status === "SUSPENDED") redirect("/suspended");
  if (user.status === "DELETED_PENDING") redirect("/account/deleted");
  if ((user.status === "VERIFIED" || user.status === "ALUMNI") && user.departmentNodeId && user.level) {
    redirect("/pulse");
  }

  const departments = await listDepartmentChoices(user.universityId);
  const style = accentCssVars(user.university.accentColor) as React.CSSProperties;

  return (
    <div style={style} className="min-h-dvh bg-bg">
      <header className="mx-auto flex w-full max-w-lg items-center justify-between px-5 pt-6">
        <Wordmark className="text-[1.125rem]" />
        <span className="text-small text-fg-subtle">{user.university.shortName}</span>
      </header>
      <main id="main" className="mx-auto w-full max-w-lg px-5 pb-12 pt-6">
        <OnboardingWizard
          departments={departments}
          interests={[...INTEREST_CATALOG]}
          labels={user.university.labels as { college?: string; faculty?: string; department?: string }}
          initial={{
            bio: user.bio ?? "",
            departmentId: user.departmentNodeId ?? "",
            level: user.level ?? null,
            isPostgraduate: user.isPostgraduate,
            interests: user.interests,
            photoUrl: user.photoUrl,
            fullName: user.fullName,
          }}
        />
      </main>
    </div>
  );
}
