"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Bookmark, CalendarDays, FileText, Home, Mail, Plus, Settings, TrendingUp, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { CreateSheet } from "./create-sheet";

const tabs = [
  { href: "/pulse", label: "Pulse", icon: Home, fillOnActive: true },
  { href: "/communities", label: "Communities", icon: Users, fillOnActive: false },
  { href: "/events", label: "Events", icon: CalendarDays, fillOnActive: false },
  { href: "/inbox", label: "Inbox", icon: Mail, fillOnActive: false },
] as const;

export function BottomTabBar({ unreadInbox = 0, canAnnounce = false }: { unreadInbox?: number; canAnnounce?: boolean }) {
  const pathname = usePathname();
  const [createOpen, setCreateOpen] = useState(false);

  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`);

  return (
    <>
      <nav
        aria-label="Main"
        className="glass fixed inset-x-0 bottom-0 z-40 rounded-t-card border-x-0 border-b-0 border-t border-border/80 pb-[env(safe-area-inset-bottom)] lg:hidden"
      >
        <ul className="mx-auto flex h-16 max-w-feed items-stretch justify-between px-2">
          {tabs.slice(0, 2).map((tab) => (
            <TabLink key={tab.href} tab={tab} active={isActive(tab.href)} />
          ))}
          <li className="flex w-[72px] flex-col items-center justify-center pb-1">
            <button
              type="button"
              onClick={() => setCreateOpen(true)}
              aria-label="Create"
              aria-haspopup="dialog"
              className="-mt-5 flex size-14 items-center justify-center rounded-full bg-accent text-accent-fg shadow-create transition duration-150 ease-out hover:bg-accent-hover active:translate-y-[2px] active:brightness-90 active:shadow-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
            >
              <Plus aria-hidden="true" className="size-7" strokeWidth={2.4} />
            </button>
          </li>
          {tabs.slice(2).map((tab) => (
            <TabLink
              key={tab.href}
              tab={tab}
              active={isActive(tab.href)}
              count={tab.href === "/inbox" ? unreadInbox : 0}
            />
          ))}
        </ul>
      </nav>
      <CreateSheet open={createOpen} onClose={() => setCreateOpen(false)} canAnnounce={canAnnounce} />
    </>
  );
}

function TabLink({
  tab,
  active,
  count = 0,
}: {
  tab: (typeof tabs)[number];
  active: boolean;
  count?: number;
}) {
  const Icon = tab.icon;
  return (
    <li className="flex-1">
      <Link
        href={tab.href}
        aria-current={active ? "page" : undefined}
        className={cn(
          "relative flex h-full min-w-[44px] flex-col items-center justify-center gap-0.5 rounded-button px-1 text-[0.6875rem] leading-[14px] font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-focus",
          active ? "text-accent-ink" : "text-fg-muted hover:text-fg",
        )}
      >
        <span className="relative inline-flex">
          <Icon
            aria-hidden="true"
            className="size-6"
            strokeWidth={active ? 2.2 : 1.9}
            fill={active && tab.fillOnActive ? "currentColor" : "none"}
          />
          {count > 0 ? (
            <span className="absolute -right-2 -top-1 inline-flex h-[16px] min-w-[16px] items-center justify-center rounded-chip bg-danger-btn px-1 text-[0.625rem] font-semibold leading-none tabular-nums text-white">
              {count > 99 ? "99+" : count}
            </span>
          ) : null}
        </span>
        <span>{tab.label}</span>
        {active ? (
          <span className="size-1 rounded-full bg-accent-ink" aria-hidden="true" />
        ) : (
          <span className="size-1" aria-hidden="true" />
        )}
      </Link>
    </li>
  );
}

/**
 * Desktop left navigation rail & right trending rail (Spec Section 7.R).
 */
export function DesktopLeftRail({ unreadInbox = 0, canAnnounce = false }: { unreadInbox?: number; canAnnounce?: boolean }) {
  const pathname = usePathname();
  const [createOpen, setCreateOpen] = useState(false);

  const items = [
    ...tabs,
    { href: "/bookmarks", label: "Bookmarks", icon: Bookmark, fillOnActive: false },
    { href: "/drafts", label: "Drafts", icon: FileText, fillOnActive: false },
    { href: "/settings", label: "Settings", icon: Settings, fillOnActive: false },
  ];

  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`);

  return (
    <aside className="hidden lg:block">
      <div className="sticky top-[72px] space-y-4">
        <nav aria-label="Primary campus navigation" className="rounded-card border border-border bg-surface p-2">
          <ul className="space-y-1">
            {items.map((item) => {
              const Icon = item.icon;
              const active = isActive(item.href);
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "flex min-h-11 items-center gap-3 rounded-button px-3 text-[0.9375rem] font-semibold transition-colors",
                      active
                        ? "bg-accent-soft text-accent-ink"
                        : "text-fg-muted hover:bg-surface-2 hover:text-fg",
                    )}
                  >
                    <Icon
                      aria-hidden="true"
                      className="size-5 shrink-0"
                      fill={active && item.fillOnActive ? "currentColor" : "none"}
                    />
                    <span className="flex-1 truncate">{item.label}</span>
                    {item.href === "/inbox" && unreadInbox > 0 ? (
                      <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-chip bg-danger-btn px-1.5 text-[0.6875rem] font-semibold tabular-nums text-white">
                        {unreadInbox > 99 ? "99+" : unreadInbox}
                      </span>
                    ) : null}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        <button
          type="button"
          onClick={() => setCreateOpen(true)}
          aria-haspopup="dialog"
          className="flex h-12 w-full items-center justify-center gap-2 rounded-button bg-accent px-4 text-[0.9375rem] font-semibold text-accent-fg shadow-create transition duration-150 ease-out hover:bg-accent-hover active:translate-y-[2px] active:shadow-none"
        >
          <Plus aria-hidden="true" className="size-5" strokeWidth={2.4} />
          Create post
        </button>
      </div>
      <CreateSheet open={createOpen} onClose={() => setCreateOpen(false)} canAnnounce={canAnnounce} />
    </aside>
  );
}

export function DesktopTrendingRail({
  tags,
}: {
  tags: Array<{ tag: string; postCount?: number; count?: number }>;
}) {
  return (
    <aside className="hidden lg:block" aria-label="Campus highlights">
      <div className="sticky top-[72px] space-y-4">
        <section className="rounded-card bg-accent-soft p-4">
          <div className="flex items-center gap-2 text-accent-ink">
            <TrendingUp aria-hidden="true" className="size-5" />
            <h2 className="font-display text-h3 font-semibold text-fg">Trending on campus</h2>
          </div>
          {tags.length > 0 ? (
            <ul className="mt-3 space-y-1.5">
              {tags.slice(0, 8).map((item) => {
                const n = item.postCount ?? item.count ?? 0;
                return (
                  <li key={item.tag}>
                    <Link
                      href={`/hashtag/${encodeURIComponent(item.tag)}`}
                      className="flex min-h-11 items-center justify-between gap-2 rounded-button bg-surface px-3 py-2 text-small transition hover:border-border-strong"
                    >
                      <span className="truncate font-semibold text-accent-ink">#{item.tag}</span>
                      {n > 0 ? <span className="shrink-0 text-tiny tabular-nums text-fg-muted">{n}</span> : null}
                    </Link>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="mt-2.5 text-small text-fg-muted">Tags from campus discussions appear here.</p>
          )}
        </section>
      </div>
    </aside>
  );
}
