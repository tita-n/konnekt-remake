"use client";

import { useRouter } from "next/navigation";
import { BarChart3, CalendarDays, HelpCircle, MessageSquareLock, PenSquare, Users } from "lucide-react";
import { BottomSheet } from "@/components/ui/overlays";

const options = [
  {
    title: "Post",
    description: "Share a thought, photo or update with the audience you choose.",
    icon: PenSquare,
    href: "/compose?type=post",
  },
  {
    title: "Ask a question",
    description: "Get help from your department, faculty or campus.",
    icon: HelpCircle,
    href: "/compose?type=question",
  },
  {
    title: "Create a poll",
    description: "Ask two to four options and settle it in a day, three days or a week.",
    icon: BarChart3,
    href: "/compose?type=poll",
  },
  {
    title: "Start a community",
    description: "Create a space for your course, hall, team or society.",
    icon: Users,
    comingSoon: true,
  },
  {
    title: "Create an event",
    description: "Plan a meetup, lecture, party or exam revision session.",
    icon: CalendarDays,
    comingSoon: true,
  },
  {
    title: "Campus Voice",
    description: "Share something anonymously with your campus, privately.",
    icon: MessageSquareLock,
    comingSoon: true,
  },
] as const;

export function CreateSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();

  return (
    <BottomSheet open={open} onClose={onClose} title="Create" description="Your campus, your audience.">
      <ul className="space-y-2 pb-2">
        {options.map((option) => {
          const Icon = option.icon;
          const comingSoon = "comingSoon" in option && option.comingSoon;
          return (
            <li key={option.title}>
              <button
                type="button"
                disabled={comingSoon}
                aria-disabled={comingSoon || undefined}
                onClick={() => {
                  if (comingSoon || !("href" in option)) return;
                  onClose();
                  router.push(option.href);
                }}
                className="flex w-full items-start gap-3 rounded-card border border-border bg-surface p-3.5 text-left transition enabled:hover:border-accent/50 enabled:hover:bg-accent-soft disabled:cursor-not-allowed disabled:opacity-60"
              >
                <span className="flex size-10 shrink-0 items-center justify-center rounded-[12px] bg-accent-soft text-accent">
                  <Icon aria-hidden="true" className="size-5" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="text-[0.9375rem] font-semibold text-fg">{option.title}</span>
                    {comingSoon ? (
                      <span className="rounded-chip border border-border bg-surface-2 px-2 py-0.5 text-[0.625rem] font-bold uppercase tracking-wide text-fg-muted">
                        Coming soon
                      </span>
                    ) : null}
                  </span>
                  <span className="mt-0.5 block text-small text-fg-muted">{option.description}</span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </BottomSheet>
  );
}
