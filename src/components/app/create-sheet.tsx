"use client";

import { CalendarDays, MessageSquareLock, PenSquare, Users } from "lucide-react";
import { BottomSheet } from "@/components/ui/overlays";

const options = [
  {
    title: "Post to your campus",
    description: "Share a thought, photo or question with your department, faculty or everyone at your university.",
    icon: PenSquare,
  },
  {
    title: "Start a community",
    description: "Create a space for your course, hall, team or society.",
    icon: Users,
  },
  {
    title: "Create an event",
    description: "Plan a meetup, lecture, party or exam revision session.",
    icon: CalendarDays,
  },
  {
    title: "Campus Voice",
    description: "Share something anonymously with your campus, privately.",
    icon: MessageSquareLock,
  },
] as const;

/**
 * The Create sheet ships complete. Everything inside it is a later-phase
 * capability, so each option is visibly marked and non-interactive rather than
 * pretending to work.
 */
export function CreateSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title="Create"
      description="Your campus, your voice. Posting opens with Pulse in the next release."
    >
      <ul className="space-y-2 pb-2">
        {options.map((option) => {
          const Icon = option.icon;
          return (
            <li key={option.title}>
              <div className="flex w-full items-start gap-3 rounded-card border border-border bg-surface p-3.5 opacity-90">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-[12px] bg-accent-soft text-accent">
                  <Icon aria-hidden="true" className="size-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-[0.9375rem] font-semibold text-fg">{option.title}</p>
                    <span className="rounded-chip border border-border bg-surface-2 px-2 py-0.5 text-[0.625rem] font-bold uppercase tracking-wide text-fg-muted">
                      Coming soon
                    </span>
                  </div>
                  <p className="mt-0.5 text-small text-fg-muted">{option.description}</p>
                </div>
              </div>
            </li>
          );
        })}
      </ul>
      <p className="rounded-card bg-surface-2 px-3.5 py-3 text-small text-fg-muted">
        Phase 0 is the foundation: accounts, verification and your campus profile. Nothing is published yet — and nothing
        here is fake.
      </p>
    </BottomSheet>
  );
}
