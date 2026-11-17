import Link from "next/link";
import { Bell, Search } from "lucide-react";
import type { SessionUser } from "@/lib/auth/guards";
import { AccountMenu } from "./account-menu";

const iconLink =
  "inline-flex size-10 items-center justify-center rounded-full text-fg transition hover:bg-surface-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus";

export function TopBar({
  user,
  university,
}: {
  user: Pick<SessionUser, "fullName" | "username" | "photoUrl" | "roles" | "status">;
  university: Pick<SessionUser["university"], "shortName" | "logoUrl" | "name">;
}) {
  return (
    <header className="glass sticky top-0 z-40 border-b border-x-0 border-t-0">
      <div className="mx-auto flex h-14 max-w-2xl items-center justify-between gap-2 px-3">
        <Link href="/pulse" className="flex min-w-0 items-center gap-2.5 rounded-button pr-2" aria-label={`${university.name} home`}>
          {university.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={university.logoUrl} alt="" width={30} height={30} className="size-[30px] rounded-[9px] object-cover" />
          ) : (
            <span className="flex size-[30px] items-center justify-center rounded-[9px] bg-accent text-small font-bold text-accent-fg">
              {university.shortName.slice(0, 2).toUpperCase()}
            </span>
          )}
          <span className="truncate font-display text-[1.0625rem] font-bold tracking-tight text-fg">
            {university.shortName}
          </span>
        </Link>

        <div className="flex items-center gap-0.5">
          <Link href="/search" aria-label="Search Konnekt" title="Search" className={iconLink}>
            <Search aria-hidden="true" className="size-[22px]" strokeWidth={2} />
          </Link>
          <Link href="/notifications" aria-label="Notifications" title="Notifications" className={iconLink}>
            <Bell aria-hidden="true" className="size-[22px]" strokeWidth={2} />
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
