"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ArrowLeft,
  ClipboardCheck,
  Flag,
  LayoutDashboard,
  Network,
  Settings2,
  ShieldCheck,
  Users,
  type LucideIcon,
} from "lucide-react";
import { cn, initials } from "@/lib/utils";
import { CountPill } from "@/components/ui/display";

interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  adminOnly?: boolean;
  moderatorOnly?: boolean;
  badge?: number;
}

export function AdminShell({
  children,
  university,
  user,
  pendingCount,
  isAdmin,
  canModerate,
  reportCount,
}: {
  children: React.ReactNode;
  university: { name: string; shortName: string; logoUrl: string | null; accentColor: string; status: string };
  user: { fullName: string; photoUrl: string | null };
  pendingCount: number;
  isAdmin: boolean;
  canModerate: boolean;
  reportCount: number;
}) {
  const pathname = usePathname();
  const nav: NavItem[] = [
    { href: "/admin", label: "Overview", icon: LayoutDashboard },
    { href: "/admin/verification", label: "Verification", icon: ClipboardCheck, badge: pendingCount },
    { href: "/admin/reports", label: "Reports", icon: Flag, moderatorOnly: true, badge: reportCount },
    { href: "/admin/students", label: "Students", icon: Users, adminOnly: true },
    { href: "/admin/academic", label: "Academic tree", icon: Network, adminOnly: true },
    { href: "/admin/team", label: "Team", icon: ShieldCheck, adminOnly: true },
    { href: "/admin/settings", label: "University", icon: Settings2, adminOnly: true },
  ];
  const visible = nav.filter(
    (item) => (!item.adminOnly || isAdmin) && (!item.moderatorOnly || canModerate),
  );

  return (
    <div className="min-h-dvh bg-bg text-fg md:flex">
      {/* Mobile top bar */}
      <header className="sticky top-0 z-30 border-b border-border bg-surface md:hidden">
        <div className="flex h-14 items-center gap-3 px-4">
          <Link href="/pulse" className="flex size-9 items-center justify-center rounded-full hover:bg-surface-2" aria-label="Back to Konnekt">
            <ArrowLeft aria-hidden="true" className="size-5" />
          </Link>
          <div className="min-w-0 flex-1">
            <p className="truncate text-small font-semibold text-fg">{university.shortName} admin</p>
            <p className="truncate text-[0.6875rem] text-fg-subtle">{university.name}</p>
          </div>
          <span className="flex size-8 items-center justify-center rounded-full bg-accent-soft text-xs font-bold text-accent-soft-fg">
            {initials(user.fullName)}
          </span>
        </div>
        <nav aria-label="Admin sections" className="flex gap-1 overflow-x-auto px-2 pb-2">
          {visible.map((item) => {
            const active = pathname === item.href || (item.href !== "/admin" && pathname.startsWith(item.href));
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-small font-semibold transition",
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

      {/* Desktop sidebar */}
      <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col border-r border-border bg-surface px-3 py-5 md:flex">
        <Link href="/pulse" className="mx-2 mb-6 flex items-center gap-2.5 text-fg">
          <span className="flex size-9 items-center justify-center rounded-[10px] bg-accent text-sm font-bold text-accent-fg">
            {university.shortName.slice(0, 2).toUpperCase()}
          </span>
          <span className="min-w-0">
            <span className="block truncate text-small font-bold">{university.name}</span>
            <span className="block text-[0.6875rem] text-fg-subtle">University console</span>
          </span>
        </Link>
        <nav aria-label="Admin sections" className="flex-1 space-y-1">
          {visible.map((item) => {
            const active = pathname === item.href || (item.href !== "/admin" && pathname.startsWith(item.href));
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex items-center gap-2.5 rounded-button px-3 py-2 text-small font-semibold transition",
                  active ? "bg-accent-soft text-accent-soft-fg" : "text-fg-muted hover:bg-surface-2 hover:text-fg",
                )}
              >
                <item.icon aria-hidden="true" className="size-[18px]" />
                <span className="flex-1">{item.label}</span>
                {item.badge ? <CountPill count={item.badge} label="Pending reviews" /> : null}
              </Link>
            );
          })}
        </nav>
        <div className="border-t border-border pt-3">
          <p className="px-3 text-[0.6875rem] font-semibold uppercase tracking-wide text-fg-subtle">Signed in</p>
          <p className="truncate px-3 pt-1 text-small font-semibold">{user.fullName}</p>
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
