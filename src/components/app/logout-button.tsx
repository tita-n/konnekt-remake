"use client";

import { useState, useTransition } from "react";
import { LogOut, Loader2 } from "lucide-react";
import { signOutAction } from "@/app/actions/auth";
import { clearKonnektClientData } from "@/lib/offline/store";
import { cn } from "@/lib/utils";

/**
 * Logout first wipes this device: Cache Storage, the per-account IndexedDB
 * feed/outbox and account-scoped localStorage. Only then is the session
 * revoked, so a shared phone can never show the previous student's data.
 */
export function LogoutButton({ className, label = "Log out" }: { className?: string; label?: string }) {
  const [pending, setPending] = useState(false);
  const [, startTransition] = useTransition();

  async function signOut() {
    if (pending) return;
    setPending(true);
    await clearKonnektClientData();
    startTransition(() => {
      void signOutAction();
    });
  }

  return (
    <button
      type="button"
      onClick={() => void signOut()}
      disabled={pending}
      className={cn(
        "flex w-full items-center gap-2.5 rounded-button px-3 py-2.5 text-left text-[0.9375rem] text-danger transition hover:bg-danger-soft disabled:opacity-60",
        className,
      )}
    >
      {pending ? <Loader2 aria-hidden="true" className="size-4 animate-spin" /> : <LogOut aria-hidden="true" className="size-4" />}
      {pending ? "Signing out…" : label}
    </button>
  );
}
