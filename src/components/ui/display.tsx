import { Check, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import { ClayAvatar } from "./clay-avatar";

/* ------------------------------- Avatar -------------------------------- */

const avatarSizes = {
  "2xs": "size-6 text-[0.5625rem]",
  xs: "size-8 text-[0.625rem]",
  sm: "size-10 text-small",
  md: "size-12 text-[0.9375rem]",
  /** 56px — community and event feature rows. */
  feature: "size-14 text-[1.0625rem]",
  lg: "size-16 text-h3",
  xl: "size-24 text-[1.75rem]",
} as const;

export type AvatarSize = keyof typeof avatarSizes;

export function VerifiedTick({
  className,
  label = "Verified student",
}: {
  className?: string;
  label?: string;
}) {
  return (
    <span
      role="img"
      aria-label={label}
      className={cn(
        "inline-flex size-4 shrink-0 items-center justify-center rounded-full bg-verified text-white",
        className,
      )}
    >
      <Check aria-hidden="true" className="size-2.5" strokeWidth={3} />
    </span>
  );
}

export function Avatar({
  name,
  seed,
  src,
  size = "md",
  verified = false,
  official = false,
  className,
  priority = false,
}: {
  name: string;
  seed?: string | null;
  src?: string | null;
  size?: AvatarSize;
  verified?: boolean;
  official?: boolean;
  className?: string;
  priority?: boolean;
}) {
  const badgeSize =
    size === "2xs" || size === "xs"
      ? "size-3.5"
      : size === "sm"
        ? "size-4"
        : size === "xl"
          ? "size-7"
          : "size-[18px]";
  const avatarKey = seed || name;

  return (
    <span className={cn("relative inline-flex shrink-0 rounded-full", className)}>
      <span
        className={cn(
          "flex items-center justify-center overflow-hidden rounded-full border border-border bg-surface-2 font-semibold text-fg-muted",
          avatarSizes[size],
        )}
      >
        {src ? (
          // Remote Cloudinary/ID images are sized by the upload pipeline.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={src}
            alt=""
            width={128}
            height={128}
            loading={priority ? "eager" : "lazy"}
            decoding="async"
            className="size-full object-cover"
          />
        ) : (
          <ClayAvatar seed={avatarKey} className="size-full" />
        )}
      </span>
      {official ? (
        <span
          className={cn(
            "absolute -bottom-0.5 -right-0.5 flex items-center justify-center rounded-full bg-accent text-accent-fg ring-2 ring-surface",
            badgeSize,
          )}
          role="img"
          aria-label="Official account"
        >
          <ShieldCheck aria-hidden="true" className="size-3" strokeWidth={2.5} />
        </span>
      ) : verified ? (
        <span
          className={cn(
            "absolute -bottom-0.5 -right-0.5 flex items-center justify-center rounded-full bg-verified text-white ring-2 ring-surface",
            badgeSize,
          )}
          role="img"
          aria-label="Verified student"
        >
          <Check aria-hidden="true" className={size === "xl" ? "size-4" : "size-2.5"} strokeWidth={3} />
        </span>
      ) : null}
    </span>
  );
}

/* -------------------------------- Card --------------------------------- */

export function Card({
  children,
  className,
  as: Component = "div",
  ...props
}: React.HTMLAttributes<HTMLElement> & { as?: React.ElementType }) {
  return (
    <Component
      className={cn("rounded-card border border-border bg-surface shadow-card", className)}
      {...props}
    >
      {children}
    </Component>
  );
}

export function CardHeader({
  title,
  description,
  action,
  className,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex items-start justify-between gap-3 border-b border-border px-4 py-3.5", className)}>
      <div className="min-w-0">
        <h2 className="text-h3 text-fg">{title}</h2>
        {description ? <p className="mt-0.5 text-small text-fg-muted">{description}</p> : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

/* ------------------------------ CountPill ------------------------------ */

export function CountPill({ count, label, className }: { count: number; label?: string; className?: string }) {
  if (count <= 0) return null;
  return (
    <span
      className={cn(
        "inline-flex min-w-[18px] h-[18px] items-center justify-center rounded-chip bg-accent px-1.5 text-[0.6875rem] font-semibold leading-none tabular-nums text-accent-fg",
        className,
      )}
      aria-label={label ? `${label}: ${count}` : `${count}`}
    >
      {count > 99 ? "99+" : count}
    </span>
  );
}

/* ------------------------------- Skeleton ------------------------------- */

export function Skeleton({ className, rounded = "rounded-md" }: { className?: string; rounded?: string }) {
  return <span aria-hidden="true" className={cn("shimmer block animate-shimmer bg-surface-2", rounded, className)} />;
}

export function SkeletonText({ lines = 3, className }: { lines?: number; className?: string }) {
  return (
    <span className={cn("block space-y-2", className)}>
      {Array.from({ length: lines }).map((_, index) => (
        <Skeleton
          key={index}
          className={cn("h-3.5", index === lines - 1 ? "w-2/3" : "w-full")}
        />
      ))}
    </span>
  );
}
