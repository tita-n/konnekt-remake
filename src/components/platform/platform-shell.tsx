"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Activity, ArrowLeft, Building2, ClipboardList, ScrollText } from "lucide-react";
import { LogoMark } from "@/components/brand/logo";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/platform", label: "Overview", icon: Activity },
  { href: "/platform/universities", label: "Universities", icon: Building2 },
  { href: "/platform/waitlist", label: "Waitlist", icon: ClipboardList },
  { href: "/platform/audit", label: "Audit log", icon: ScrollText },
];

export function PlatformShell({ children, email }: { children: React.ReactNode; email: string }) {
  const pathname = usePathname();

  return (
    <div className="min-h-dvh bg-bg text-fg md:flex">
      <header className="sticky top-0 z-30 border-b border-border bg-surface md:hidden">
        <div className="flex h-14 items-center gap-2.5 px-4">
          <LogoMark className="size-8" />
          <p className="flex-1 text-small font-bold">Konnekt platform</p>
          <Link href="/pulse" className="inline-flex min-h-11 items-center text-[0.75rem] font-semibold text-accent-ink">Back to app</Link>
        </div>
        <nav aria-label="Platform sections" className="flex gap-1 overflow-x-auto px-4 pb-2">
          {NAV.map((item) => {
            const active = pathname === item.href || (item.href !== "/platform" && pathname.startsWith(item.href));
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex min-h-9 shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-small font-semibold",
                  active ? "bg-accent text-accent-fg" : "text-fg-muted hover:bg-surface-2",
                )}
              >
                <item.icon aria-hidden="true" className="size-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>
      </header>

      <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col border-r border-border bg-surface px-3 py-5 md:flex">
        <div className="mx-2 mb-6 flex min-h-11 items-center gap-2.5">
          <LogoMark className="size-9" />
          <span>
            <span className="block font-display text-small font-bold">Konnekt</span>
            <span className="block text-[0.6875rem] text-fg-subtle">Platform console</span>
          </span>
        </div>
        <nav aria-label="Platform sections" className="flex-1 space-y-1">
          {NAV.map((item) => {
            const active = pathname === item.href || (item.href !== "/platform" && pathname.startsWith(item.href));
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex items-center gap-2.5 rounded-button px-3 py-2 text-small font-semibold transition",
                  active ? "bg-accent-soft text-accent-ink" : "text-fg-muted hover:bg-surface-2 hover:text-fg",
                )}
              >
                <item.icon aria-hidden="true" className="size-[18px]" />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="border-t border-border pt-3">
          <p className="px-3 text-[0.6875rem] font-semibold uppercase tracking-wide text-fg-subtle">Platform admin</p>
          <p className="truncate px-3 pt-1 text-small font-semibold">{email}</p>
          <Link href="/pulse" className="mt-2 flex items-center gap-2 rounded-button px-3 py-2 text-small text-fg-muted hover:bg-surface-2">
            <ArrowLeft aria-hidden="true" className="size-4" /> Back to app
          </Link>
        </div>
      </aside>

      <main id="main" className="min-w-0 flex-1">
        <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 lg:px-8">{children}</div>
      </main>
    </div>
  );
}
