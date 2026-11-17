import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { accentCssVars } from "@/lib/domain/color";
import { TopBar } from "@/components/app/top-bar";
import { BottomTabBar } from "@/components/app/bottom-tab-bar";
import { InstallPrompt } from "@/components/pwa/pwa-provider";

export default async function ShellLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) redirect("/login");
  const { user } = session;

  if (user.status === "SUSPENDED") redirect("/suspended");
  if (user.status === "DELETED_PENDING") redirect("/account/deleted");
  if (user.status !== "VERIFIED" && user.status !== "ALUMNI") redirect("/status");
  if (!user.departmentNodeId || !user.level) redirect("/onboarding");

  return (
    <div style={accentCssVars(user.university.accentColor) as React.CSSProperties} className="min-h-dvh bg-bg">
      <TopBar user={user} university={user.university} />
      <main id="main" className="mx-auto w-full max-w-2xl px-0 pb-[calc(5.5rem+env(safe-area-inset-bottom))] pt-0 sm:px-4">
        {children}
      </main>
      <InstallPrompt />
      <BottomTabBar />
    </div>
  );
}
