"use client";

import Link from "next/link";
import { cn } from "@/lib/utils";

export interface TabItem {
  label: string;
  href: string;
  icon?: React.ReactNode;
  count?: number;
}

/** Navigation tabs: real links, correct ARIA state, horizontal scroll on mobile. */
export function Tabs({
  items,
  current,
  label,
  className,
}: {
  items: TabItem[];
  current: string;
  label: string;
  className?: string;
}) {
  return (
    <nav aria-label={label} className={cn("no-scrollbar -mx-1 overflow-x-auto", className)}>
      <ul className="flex min-w-full items-center gap-1 px-1">
        {items.map((item) => {
          const active = current === item.href;
          return (
            <li key={item.href} className="shrink-0">
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "relative inline-flex -my-1 min-h-11 items-center gap-1.5 rounded-chip px-3 text-small font-semibold transition-colors",
                  active ? "bg-accent-soft text-accent-soft-fg" : "text-fg-muted hover:bg-surface-2 hover:text-fg",
                )}
              >
                {item.icon}
                {item.label}
                {typeof item.count === "number" && item.count > 0 ? (
                  <span className="rounded-chip bg-accent px-1.5 text-[0.625rem] font-bold text-accent-fg">
                    {item.count}
                  </span>
                ) : null}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

export function SegmentedControl<T extends string>({
  value,
  onChange,
  options,
  label,
  className,
}: {
  value: T;
  onChange: (value: T) => void;
  options: Array<{ value: T; label: string }>;
  label: string;
  className?: string;
}) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className={cn("flex w-full items-center gap-1 rounded-button border border-border bg-surface p-1", className)}
    >
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(option.value)}
            className={cn(
              "flex h-11 min-h-11 min-w-0 flex-1 items-center justify-center gap-1.5 truncate rounded-[9px] px-2 text-small font-semibold transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus",
              selected
                ? "border border-border-strong bg-surface-2 text-fg"
                : "border border-transparent text-fg-muted hover:bg-surface-2 hover:text-fg",
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

export function Stepper({
  steps,
  current,
  label = "Progress",
}: {
  steps: string[];
  current: number;
  label?: string;
}) {
  return (
    <div aria-label={label} className="flex items-center gap-2">
      {steps.map((step, index) => {
        const active = index === current;
        const done = index < current;
        return (
          <div key={step} className="flex flex-1 items-center gap-2">
            <span
              className={cn(
                "flex size-6 shrink-0 items-center justify-center rounded-full border text-[0.6875rem] font-bold transition-colors",
                active
                  ? "border-accent bg-accent text-accent-fg"
                  : done
                    ? "border-accent bg-accent-soft text-accent-soft-fg"
                    : "border-border bg-surface text-fg-subtle",
              )}
              aria-current={active ? "step" : undefined}
            >
              {index + 1}
            </span>
            <span className={cn("hidden text-small sm:block", active ? "font-semibold text-fg" : "text-fg-subtle")}>
              {step}
            </span>
            {index < steps.length - 1 ? <span className="h-px flex-1 bg-border" aria-hidden="true" /> : null}
          </div>
        );
      })}
      <span className="sr-only">
        Step {current + 1} of {steps.length}: {steps[current]}
      </span>
    </div>
  );
}
