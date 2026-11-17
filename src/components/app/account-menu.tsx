"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ChevronDown, LayoutDashboard, LogOut, Settings, ShieldCheck, UserRound } from "lucide-react";
import { Avatar } from "@/components/ui/display";
import { signOutAction } from "@/app/actions/auth";

export function AccountMenu({
  name,
  username,
  photoUrl,
  canAdminister,
  isPlatformAdmin,
}: {
  name: string;
  username: string;
  photoUrl: string | null;
  canAdminister: boolean;
  isPlatformAdmin: boolean;
}) {
  const [open, setOpen] = useState(false);
  const container = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!container.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        trigger.current?.focus();
      }
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <div className="relative" ref={container}>
      <button
        ref={trigger}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Your account menu"
        onClick={() => setOpen((value) => !value)}
        className="ml-0.5 flex items-center gap-1 rounded-full p-0.5 transition hover:bg-surface-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
      >
        <Avatar name={name} src={photoUrl} size="sm" />
        <ChevronDown aria-hidden="true" className="hidden size-3.5 text-fg-subtle sm:block" />
      </button>

      {open ? (
        <div
          role="menu"
          aria-label="Account"
          className="absolute right-0 top-[calc(100%+8px)] w-64 animate-pop-in overflow-hidden rounded-card border border-border bg-surface shadow-floating"
        >
          <div className="border-b border-border px-4 py-3">
            <p className="truncate text-[0.9375rem] font-semibold text-fg">{name}</p>
            <p className="truncate text-small text-fg-subtle">@{username}</p>
          </div>
          <div className="p-1.5">
            <MenuLink href="/profile/me" icon={<UserRound aria-hidden="true" className="size-4" />} onClick={() => setOpen(false)}>
              View profile
            </MenuLink>
            <MenuLink href="/settings" icon={<Settings aria-hidden="true" className="size-4" />} onClick={() => setOpen(false)}>
              Settings
            </MenuLink>
            {canAdminister ? (
              <MenuLink href="/admin" icon={<LayoutDashboard aria-hidden="true" className="size-4" />} onClick={() => setOpen(false)}>
                University console
              </MenuLink>
            ) : null}
            {isPlatformAdmin ? (
              <MenuLink href="/platform" icon={<ShieldCheck aria-hidden="true" className="size-4" />} onClick={() => setOpen(false)}>
                Platform console
              </MenuLink>
            ) : null}
          </div>
          <form action={signOutAction} className="border-t border-border p-1.5">
            <button
              type="submit"
              role="menuitem"
              className="flex w-full items-center gap-2.5 rounded-button px-3 py-2.5 text-left text-[0.9375rem] text-danger transition hover:bg-danger-soft"
            >
              <LogOut aria-hidden="true" className="size-4" />
              Log out
            </button>
          </form>
        </div>
      ) : null}
    </div>
  );
}

function MenuLink({
  href,
  icon,
  children,
  onClick,
}: {
  href: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <Link
      href={href}
      role="menuitem"
      onClick={onClick}
      className="flex items-center gap-2.5 rounded-button px-3 py-2.5 text-[0.9375rem] text-fg transition hover:bg-surface-2"
    >
      {icon}
      {children}
    </Link>
  );
}
