import type { Metadata } from "next";
import { requirePlatformAdmin } from "@/lib/auth/guards";
import { PlatformShell } from "@/components/platform/platform-shell";

export const metadata: Metadata = {
  title: { default: "Platform console", template: "%s · Konnekt platform" },
  robots: { index: false, follow: false },
};

export default async function PlatformLayout({ children }: { children: React.ReactNode }) {
  const admin = await requirePlatformAdmin();
  return <PlatformShell email={admin.email}>{children}</PlatformShell>;
}
