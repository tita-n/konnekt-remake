import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { accentCssVars } from "@/lib/domain/color";
import { getTrendingTags } from "@/lib/services/posts";
import { loadSocialViewer } from "@/lib/services/social";
import { getOfficialPostingContext } from "@/lib/services/official";
import { hasRole, isPlatformAdmin } from "@/lib/auth/guards";
import { TopBar } from "@/components/app/top-bar";
import { BottomTabBar, DesktopLeftRail, DesktopTrendingRail } from "@/components/app/bottom-tab-bar";
import { InstallPrompt } from "@/components/pwa/pwa-provider";

export default async function ShellLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) redirect("/login");
  const { user } = session;

  if (user.status === "SUSPENDED") redirect("/suspended");
  if (user.status === "DELETED_PENDING") redirect("/account/deleted");
  if (user.status !== "VERIFIED" && user.status !== "ALUMNI") redirect("/status");
  if (!user.departmentNodeId || !user.level || !user.onboardingCompletedAt) redirect("/onboarding");

  const viewer = await loadSocialViewer(user).catch(() => null);
  const trending = viewer ? await getTrendingTags(viewer, "all").catch(() => []) : [];
  const official = viewer ? await getOfficialPostingContext(viewer).catch(() => null) : null;
  const canAnnounce =
    isPlatformAdmin(user) ||
    hasRole(user, "UNIVERSITY_ADMIN") ||
    hasRole(user, "MODERATOR") ||
    hasRole(user, "OFFICIAL") ||
    Boolean(official?.defaultAccountId);

  return (
    <div style={accentCssVars(user.university.accentColor) as React.CSSProperties} className="min-h-dvh bg-bg">
      <TopBar user={user} university={user.university} />
      <div className="mx-auto w-full max-w-[1160px] px-0 sm:px-4 lg:grid lg:grid-cols-[220px_minmax(0,640px)_280px] lg:justify-center lg:gap-5 lg:pt-2">
        <DesktopLeftRail canAnnounce={canAnnounce} />
        <main id="main" className="mx-auto w-full max-w-feed pb-[calc(5.75rem+env(safe-area-inset-bottom))] lg:pb-12">
          {children}
        </main>
        <DesktopTrendingRail tags={trending} />
      </div>
      <InstallPrompt />
      <BottomTabBar canAnnounce={canAnnounce} />
    </div>
  );
}
