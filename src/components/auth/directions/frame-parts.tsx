import { AlertCircle, RotateCw, WifiOff } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/display";
import { cn } from "@/lib/utils";

export type ScreenState = "ok" | "loading" | "error" | "offline";

/**
 * Loading, error and offline treatments for the auth steps. They reuse the
 * same surfaces the app uses (Skeleton, rounded card, a single action) so the
 * states feel authored rather than dropped in.
 */
export function StepState({
  state,
  tone,
  retryHref,
  lines = 4,
}: {
  state: ScreenState;
  tone: "soft" | "flat" | "panel";
  retryHref?: string;
  lines?: number;
}) {
  if (state === "ok") return null;

  if (state === "loading") {
    return (
      <div className={cn("space-y-2.5", tone === "panel" && "rounded-card bg-surface-2 p-4", tone === "flat" && "px-1")} role="status" aria-label="Loading">
        {Array.from({ length: lines }).map((_, index) => (
          <Skeleton key={index} className={cn("h-11 w-full", tone === "soft" && "rounded-button")} rounded={tone === "soft" ? "rounded-button" : "rounded-card"} />
        ))}
      </div>
    );
  }

  const offline = state === "offline";
  return (
    <div
      role={offline ? "status" : "alert"}
      className={cn(
        "flex items-start gap-3 rounded-card border p-4",
        offline ? "border-border bg-surface-2" : "border-danger bg-danger-soft",
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          "flex size-9 shrink-0 items-center justify-center rounded-[10px]",
          offline ? "bg-surface text-fg-muted" : "bg-danger-btn text-danger-fg",
        )}
      >
        {offline ? <WifiOff className="size-[18px]" /> : <AlertCircle className="size-[18px]" />}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-small font-semibold text-fg">
          {offline ? "You're offline" : "That didn't go through"}
        </p>
        <p className="mt-0.5 text-small leading-snug text-fg-muted">
          {offline
            ? "Your details are still here. Reconnect and we'll pick up where you left off."
            : "Nothing was saved. Check your connection and try once more."}
        </p>
        {retryHref ? (
          <ButtonLink href={retryHref} size="sm" variant={offline ? "primary" : "secondary"} className="mt-2.5 min-h-11">
            <RotateCw aria-hidden="true" className="size-4" />
            {offline ? "Try again" : "Retry"}
          </ButtonLink>
        ) : null}
      </div>
    </div>
  );
}
