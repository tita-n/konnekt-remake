import { UniversityShieldMark, Wordmark } from "@/components/brand/logo";
import { cn } from "@/lib/utils";
import type { DirectionUniversity } from "./fixtures";

/**
 * The brand slot has exactly two states, and which one you get is decided by
 * data, not by the screen: before a university is chosen the platform brand is
 * shown, after it the university's logo, short name and accent arrive from the
 * record (with a monogram when `logoUrl` is null).
 */
export function BrandSlot({
  university,
  size = "md",
  onAccent = false,
  showName = true,
  className,
}: {
  university: DirectionUniversity | null;
  size?: "sm" | "md" | "lg";
  onAccent?: boolean;
  showName?: boolean;
  className?: string;
}) {
  const tile = size === "lg" ? "size-12 rounded-[13px]" : size === "sm" ? "size-8 rounded-[10px]" : "size-10 rounded-[12px]";
  const text = size === "lg" ? "text-[1.0625rem]" : size === "sm" ? "text-[0.8125rem]" : "text-[0.9375rem]";

  const ink = onAccent ? "text-accent-fg" : "text-fg";

  if (!university) {
    return (
      <span className={cn("inline-flex min-w-0 items-center gap-2.5", className)}>
        <UniversityShieldMark className={cn(tile, "shrink-0", onAccent ? "text-accent-fg" : "text-accent")} />
        {showName ? (
          <Wordmark
            className={cn(size === "lg" ? "text-[1.25rem]" : size === "sm" ? "text-[1rem]" : "text-[1.125rem]", "leading-none", ink)}
          />
        ) : null}
      </span>
    );
  }

  return (
    <span className={cn("inline-flex min-w-0 items-center gap-2.5", className)}>
      {university.logoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={university.logoUrl}
          alt=""
          width={48}
          height={48}
          className={cn(tile, "shrink-0 border border-border bg-surface object-cover")}
        />
      ) : (
        <span
          aria-hidden="true"
          className={cn(
            tile,
            "flex shrink-0 items-center justify-center font-display font-bold",
            size === "lg" ? "text-[0.9375rem]" : "text-small",
          )}
          style={
            onAccent
              ? { background: "var(--accent-fg)", color: "var(--accent)" }
              : { background: "var(--accent)", color: "var(--accent-fg)" }
          }
        >
          {university.shortName.replace(/[^A-Za-z]/g, "").slice(0, 2).toUpperCase()}
        </span>
      )}
      {showName ? (
        <span className="min-w-0">
          <span className={cn("block truncate font-semibold leading-tight", text, ink)}>
            {university.shortName}
          </span>
          {size === "lg" ? (
            <span className={cn("mt-0.5 block truncate text-tiny", onAccent ? "text-accent-fg" : "text-fg-subtle")}>
              {university.name}
            </span>
          ) : null}
        </span>
      ) : null}
    </span>
  );
}
