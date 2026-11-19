import Link from "next/link";
import { RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
import { buttonStyles } from "./button";
import { ClayIllustration, type ClayIllustrationKind } from "./clay-illustrations";

/* ------------------------------ EmptyState ------------------------------ */

export type EmptyIllustrationType =
  | "default"
  | "pulse"
  | "communities"
  | "events"
  | "inbox"
  | "search"
  | "notifications"
  | "padlock"
  | "unavailable"
  | "bookmarks"
  | "drafts"
  | "hourglass";

const KIND_MAP: Record<EmptyIllustrationType, ClayIllustrationKind> = {
  default: "emptyMailbox",
  pulse: "emptyMailbox",
  padlock: "happyPadlock",
  unavailable: "unavailableEnvelope",
  bookmarks: "emptyBookmark",
  drafts: "blankDrafts",
  search: "magnifier",
  hourglass: "hourglass",
  communities: "welcomeHero",
  events: "emptyBookmark",
  inbox: "emptyMailbox",
  notifications: "emptyMailbox",
};

export function EmptyState({
  illustration = "default",
  title,
  description,
  action,
  className,
  compact = false,
}: {
  illustration?: EmptyIllustrationType;
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
        compact ? "px-4 py-8" : "px-6 py-12",
        className,
      )}
    >
      <ClayIllustration kind={KIND_MAP[illustration]} className={compact ? "h-32 w-40" : "h-40 w-48"} />
      <h2 className="mt-4 font-display text-h2 font-bold text-fg">{title}</h2>
      <p className="mt-1.5 max-w-xs text-small text-fg-muted">{description}</p>
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}

/* ------------------------------ ErrorState ------------------------------ */

export function ErrorState({
  title = "We couldn't load this.",
  description = "Check your connection and try again.",
  onRetry,
  retryLabel = "Try again",
  href,
  reportHref = "/settings/about",
  className,
}: {
  title?: string;
  description?: string;
  onRetry?: () => void;
  retryLabel?: string;
  href?: string;
  reportHref?: string | null;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-center px-6 py-12 text-center", className)} role="alert">
      <ClayIllustration kind="errorPlug" />
      <h2 className="mt-4 font-display text-h2 font-bold text-fg">{title}</h2>
      <p className="mt-1.5 max-w-xs text-small text-fg-muted">{description}</p>
      {onRetry ? (
        <button
          type="button"
          onClick={onRetry}
          className={buttonStyles({ variant: "primary", size: "lg", className: "mt-5 px-7" })}
        >
          <RefreshCw aria-hidden="true" className="size-4" />
          {retryLabel}
        </button>
      ) : href ? (
        <Link href={href} className={buttonStyles({ variant: "primary", size: "lg", className: "mt-5 px-7" })}>
          {retryLabel}
        </Link>
      ) : null}
      {reportHref ? (
        <Link
          href={reportHref}
          className="mt-3 inline-flex min-h-11 items-center text-small font-medium text-accent-ink underline underline-offset-4 hover:opacity-80"
        >
          Report a problem
        </Link>
      ) : null}
    </div>
  );
}
