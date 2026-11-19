"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Activity, CalendarDays, Inbox, Plus, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { CreateSheet } from "./create-sheet";

const tabs = [
  { href: "/pulse", label: "Pulse", icon: Activity },
  { href: "/communities", label: "Communities", icon: Users },
  { href: "/events", label: "Events", icon: CalendarDays },
  { href: "/inbox", label: "Inbox", icon: Inbox },
] as const;

export function BottomTabBar() {
  const pathname = usePathname();
  const [createOpen, setCreateOpen] = useState(false);

  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`);

  return (
    <>
      <nav
        aria-label="Main"
        className="glass fixed inset-x-0 bottom-0 z-40 border-t border-x-0 border-b-0 pb-[env(safe-area-inset-bottom)]"
      >
        <ul className="mx-auto flex h-[64px] max-w-2xl items-stretch justify-between px-2">
          {tabs.slice(0, 2).map((tab) => (
            <TabLink key={tab.href} tab={tab} active={isActive(tab.href)} />
          ))}
          <li className="flex w-16 flex-col items-center justify-center">
            <button
              type="button"
              onClick={() => setCreateOpen(true)}
              aria-label="Create"
              aria-haspopup="dialog"
              className="-mt-6 flex size-12 items-center justify-center rounded-full bg-accent text-accent-fg shadow-[0_8px_22px_-6px_var(--accent)] transition duration-200 ease-out hover:brightness-105 active:scale-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
            >
              <Plus aria-hidden="true" className="size-6 transition-transform duration-300 ease-spring" strokeWidth={2.4} />
            </button>
            <span className="mt-0.5 text-[0.6875rem] font-semibold text-fg-muted">Create</span>
          </li>
          {tabs.slice(2).map((tab) => (
            <TabLink key={tab.href} tab={tab} active={isActive(tab.href)} />
          ))}
        </ul>
      </nav>
      <CreateSheet open={createOpen} onClose={() => setCreateOpen(false)} />
    </>
  );
}

function TabLink({
  tab,
  active,
}: {
  tab: (typeof tabs)[number];
  active: boolean;
}) {
  const Icon = tab.icon;
  return (
    <li className="flex-1">
      <Link
        href={tab.href}
        aria-current={active ? "page" : undefined}
        className={cn(
          "flex h-full flex-col items-center justify-center gap-1 rounded-button px-1 text-[0.6875rem] font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-focus",
          active ? "text-accent" : "text-fg-muted hover:text-fg",
        )}
      >
        <Icon aria-hidden="true" className="size-[22px]" strokeWidth={active ? 2.4 : 2} />
        <span>{tab.label}</span>
      </Link>
    </li>
  );
}
