import { BadgeCheck, ShieldCheck } from "lucide-react";
import { cn, initials } from "@/lib/utils";

/* ------------------------------- Avatar -------------------------------- */

const avatarSizes = {
  xs: "size-7 text-[0.625rem]",
  sm: "size-9 text-small",
  md: "size-12 text-[0.9375rem]",
  lg: "size-16 text-h3",
  xl: "size-24 text-[1.75rem]",
} as const;

export type AvatarSize = keyof typeof avatarSizes;

export function Avatar({
  name,
  src,
  size = "md",
  verified = false,
  official = false,
  className,
  priority = false,
}: {
  name: string;
  src?: string | null;
  size?: AvatarSize;
  verified?: boolean;
  official?: boolean;
  className?: string;
  priority?: boolean;
}) {
  const badgeSize = size === "xs" || size === "sm" ? "size-3.5" : size === "xl" ? "size-6" : "size-4";
  return (
    <span className={cn("relative inline-flex shrink-0", className)}>
      <span
        className={cn(
          "flex items-center justify-center overflow-hidden rounded-full border border-border bg-surface-2 font-semibold text-fg-muted",
          avatarSizes[size],
        )}
      >
        {src ? (
          // Remote Cloudinary/ID images are already sized by the upload pipeline.
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
          <span aria-hidden="true">{initials(name)}</span>
        )}
      </span>
      {official ? (
        <span className="absolute -bottom-0.5 -right-0.5 rounded-full bg-surface" role="img" aria-label="Official account">
          <ShieldCheck aria-hidden="true" className={cn(badgeSize, "text-accent")} fill="var(--surface)" />
        </span>
      ) : verified ? (
        <span className="absolute -bottom-0.5 -right-0.5 rounded-full bg-surface" role="img" aria-label="Verified student">
          <BadgeCheck aria-hidden="true" className={cn(badgeSize, "text-accent")} fill="var(--surface)" />
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
        "inline-flex min-w-5 items-center justify-center rounded-chip bg-accent px-1.5 py-0.5 text-[0.625rem] font-bold tabular-nums text-accent-fg",
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
