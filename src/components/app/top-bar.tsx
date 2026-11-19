"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Bell, Search } from "lucide-react";
import type { SessionUser } from "@/lib/auth/guards";
import { cn } from "@/lib/utils";
import { UniversityShieldMark } from "@/components/brand/logo";
import { AccountMenu } from "./account-menu";

const iconLink =
  "relative inline-flex size-11 items-center justify-center rounded-full text-fg-muted transition hover:bg-surface-2 hover:text-fg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus";

export function TopBar({
  user,
  university,
  unreadNotifications = 0,
}: {
  user: Pick<SessionUser, "fullName" | "username" | "photoUrl" | "roles" | "status">;
  university: Pick<SessionUser["university"], "shortName" | "logoUrl" | "name">;
  unreadNotifications?: number;
}) {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 4);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={cn(
        "glass sticky top-0 z-40 border-x-0 border-t-0 border-b transition-colors duration-150",
        scrolled ? "border-border/80" : "border-transparent",
      )}
    >
      <div className="mx-auto flex h-14 max-w-[1160px] items-center justify-between gap-2 px-4">
        <Link
          href="/pulse"
          className="flex min-h-11 min-w-0 items-center gap-2.5 rounded-button pr-2"
          aria-label={`${university.name} home`}
        >
          <UniversityShieldMark logoUrl={university.logoUrl} shortName={university.shortName} className="size-7" />
          <span className="truncate font-display text-h2 font-bold text-fg">
            {university.shortName}
          </span>
        </Link>

        <div className="flex items-center gap-0.5">
          <Link href="/search" aria-label="Search Konnekt" title="Search" className={iconLink}>
            <Search aria-hidden="true" className="size-6" strokeWidth={2} />
          </Link>
          <Link href="/notifications" aria-label="Notifications" title="Notifications" className={iconLink}>
            <Bell aria-hidden="true" className="size-6" strokeWidth={2} />
            {unreadNotifications > 0 ? (
              <span className="absolute right-1 top-1 inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-chip bg-danger-btn px-1 text-[0.6875rem] font-semibold leading-none tabular-nums text-white ring-2 ring-surface">
                {unreadNotifications > 99 ? "99+" : unreadNotifications}
              </span>
            ) : null}
          </Link>
          <AccountMenu
            name={user.fullName}
            username={user.username}
            photoUrl={user.photoUrl}
            canAdminister={user.roles.some(
              (role) => role.role !== "PLATFORM_ADMIN" && role.role !== "OFFICIAL" && role.role !== "MODERATOR",
            )}
            isPlatformAdmin={user.roles.some((role) => role.role === "PLATFORM_ADMIN")}
          />
        </div>
      </div>
    </header>
  );
}
