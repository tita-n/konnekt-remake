import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight, Info, Lock, Palette, ShieldCheck, UserRound } from "lucide-react";
import { requireStudent } from "@/lib/auth/guards";
import { SettingsNav } from "@/components/settings/settings-nav";

export const metadata: Metadata = { title: "Settings" };

const sections = [
  {
    href: "/settings/account",
    icon: Lock,
    title: "Account",
    description: "Email, username, password, devices and account deletion.",
  },
  {
    href: "/settings/profile",
    icon: UserRound,
    title: "Profile",
    description: "Photo, bio, department, level and interests.",
  },
  {
    href: "/settings/privacy",
    icon: ShieldCheck,
    title: "Privacy",
    description: "Choose who sees your department and level.",
  },
  {
    href: "/settings/appearance",
    icon: Palette,
    title: "Appearance",
    description: "Light, dark or system, plus Data saver.",
  },
  {
    href: "/settings/about",
    icon: Info,
    title: "About & legal",
    description: "Terms, Privacy Policy, Community Rules and your data.",
  },
];

export default async function SettingsPage() {
  await requireStudent("/settings");
  return (
    <div>
      <SettingsNav />
      <div className="px-4 pt-5">
        <h1 className="text-h1 text-fg">Settings</h1>
        <p className="mt-1 text-small text-fg-muted">Your account, your data, your call.</p>

        <ul className="mt-5 divide-y divide-border overflow-hidden rounded-card border border-border bg-surface">
          {sections.map((section) => (
            <li key={section.href}>
              <Link href={section.href} className="flex items-center gap-3 px-4 py-3.5 transition hover:bg-surface-2">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-[11px] bg-accent-soft text-accent-ink">
                  <section.icon aria-hidden="true" className="size-[18px]" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[0.9375rem] font-semibold text-fg">{section.title}</span>
                  <span className="block text-small text-fg-subtle">{section.description}</span>
                </span>
                <ChevronRight aria-hidden="true" className="size-4 shrink-0 text-fg-subtle" />
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
