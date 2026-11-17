import Link from "next/link";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
import { buttonStyles } from "./button";

/* ------------------------------ EmptyState ------------------------------ */

/**
 * Every empty state is a real, designed destination: an illustration, one
 * friendly line and (when useful) a next action. No placeholder copy, no fake
 * content.
 */
export function EmptyState({
  illustration = "default",
  title,
  description,
  action,
  className,
  compact = false,
}: {
  illustration?: "default" | "pulse" | "communities" | "events" | "inbox" | "search" | "notifications";
  title: string;
  description: string;
  action?: React.ReactNode;
  className?: string;
  compact?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center text-center",
        compact ? "px-4 py-8" : "px-6 py-14",
        className,
      )}
    >
      <EmptyIllustration kind={illustration} />
      <h2 className="mt-5 text-h3 text-fg">{title}</h2>
      <p className="mt-1.5 max-w-xs text-small text-fg-muted">{description}</p>
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}

function EmptyIllustration({ kind }: { kind: NonNullable<React.ComponentProps<typeof EmptyState>["illustration"]> }) {
  const common = "size-20 text-accent";
  switch (kind) {
    case "pulse":
      return (
        <svg viewBox="0 0 96 96" role="img" aria-label="An empty campus pulse" className={common} fill="none">
          <rect x="14" y="20" width="68" height="56" rx="16" fill="var(--accent-soft)" />
          <path d="M28 52h9l5-12 8 24 7-16 4 4h10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case "communities":
      return (
        <svg viewBox="0 0 96 96" role="img" aria-label="An empty communities list" className={common} fill="none">
          <rect x="12" y="26" width="58" height="46" rx="14" fill="var(--accent-soft)" />
          <circle cx="64" cy="34" r="12" fill="var(--surface)" stroke="currentColor" strokeWidth="3" />
          <path d="M58 34l4 4 8-8" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case "events":
      return (
        <svg viewBox="0 0 96 96" role="img" aria-label="An empty events calendar" className={common} fill="none">
          <rect x="18" y="24" width="60" height="54" rx="14" fill="var(--accent-soft)" />
          <path d="M18 40h60M34 18v12M62 18v12" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
          <circle cx="48" cy="56" r="6" fill="currentColor" />
        </svg>
      );
    case "inbox":
      return (
        <svg viewBox="0 0 96 96" role="img" aria-label="An empty inbox" className={common} fill="none">
          <path d="M16 30a12 12 0 0112-12h40a12 12 0 0112 12v32a12 12 0 01-12 12H28a12 12 0 01-12-12V30z" fill="var(--accent-soft)" />
          <path d="M18 34l28 20 32-20" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case "search":
      return (
        <svg viewBox="0 0 96 96" role="img" aria-label="No search results" className={common} fill="none">
          <circle cx="42" cy="42" r="22" fill="var(--accent-soft)" />
          <circle cx="42" cy="42" r="22" stroke="currentColor" strokeWidth="3" />
          <path d="M59 59l18 18" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
        </svg>
      );
    case "notifications":
      return (
        <svg viewBox="0 0 96 96" role="img" aria-label="No notifications" className={common} fill="none">
          <path d="M30 64h36l-4-8V44a14 14 0 10-28 0v12l-4 8z" fill="var(--accent-soft)" stroke="currentColor" strokeWidth="3" strokeLinejoin="round" />
          <path d="M42 72a6 6 0 0012 0" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
        </svg>
      );
    default:
      return (
        <svg viewBox="0 0 96 96" role="img" aria-label="Nothing here yet" className={common} fill="none">
          <circle cx="48" cy="48" r="28" fill="var(--accent-soft)" />
          <path d="M36 48h24M48 36v24" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
        </svg>
      );
  }
}

/* ------------------------------ ErrorState ------------------------------ */

export function ErrorState({
  title = "Something went wrong",
  description = "We couldn't load this. Check your connection and try again.",
  onRetry,
  retryLabel = "Try again",
  href,
  className,
}: {
  title?: string;
  description?: string;
  onRetry?: () => void;
  retryLabel?: string;
  href?: string;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-center px-6 py-12 text-center", className)} role="alert">
      <span className="flex size-14 items-center justify-center rounded-full bg-danger-soft">
        <AlertTriangle aria-hidden="true" className="size-6 text-danger" />
      </span>
      <h2 className="mt-4 text-h3 text-fg">{title}</h2>
      <p className="mt-1.5 max-w-xs text-small text-fg-muted">{description}</p>
      {onRetry ? (
        <button type="button" onClick={onRetry} className={buttonStyles({ variant: "secondary", size: "md", className: "mt-5" })}>
          <RefreshCw aria-hidden="true" className="size-4" />
          {retryLabel}
        </button>
      ) : href ? (
        <Link href={href} className={buttonStyles({ variant: "secondary", size: "md", className: "mt-5" })}>
          {retryLabel}
        </Link>
      ) : null}
    </div>
  );
}
