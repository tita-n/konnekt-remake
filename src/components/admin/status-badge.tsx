import { cn } from "@/lib/utils";

const TONES = {
  neutral: "bg-surface-2 text-fg-muted border-border",
  accent: "bg-accent-soft text-accent-soft-fg border-transparent",
  success: "bg-success-soft text-success border-transparent",
  warning: "bg-warning-soft text-warning border-transparent",
  danger: "bg-danger-soft text-danger border-transparent",
} as const;

export function Badge({
  children,
  tone = "neutral",
  className,
}: {
  children: React.ReactNode;
  tone?: keyof typeof TONES;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-chip border px-2 py-0.5 text-[0.6875rem] font-semibold",
        TONES[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

export function RequestStatusBadge({ status }: { status: string }) {
  if (status === "PENDING") return <Badge tone="warning">Pending</Badge>;
  if (status === "APPROVED") return <Badge tone="success">Approved</Badge>;
  return <Badge tone="danger">Declined</Badge>;
}

export function UserStatusBadge({ status }: { status: string }) {
  switch (status) {
    case "VERIFIED":
      return <Badge tone="success">Verified</Badge>;
    case "ALUMNI":
      return <Badge tone="accent">Alumni</Badge>;
    case "SUSPENDED":
      return <Badge tone="danger">Suspended</Badge>;
    case "PENDING":
      return <Badge tone="warning">In review</Badge>;
    case "REJECTED":
      return <Badge tone="danger">Declined</Badge>;
    case "DELETED_PENDING":
      return <Badge tone="neutral">Deleting</Badge>;
    default:
      return <Badge tone="neutral">Not verified</Badge>;
  }
}

export function UniversityStatusBadge({ status }: { status: string }) {
  if (status === "ACTIVE") return <Badge tone="success">Live</Badge>;
  if (status === "WAITLIST") return <Badge tone="warning">Waitlist</Badge>;
  return <Badge tone="danger">Off</Badge>;
}
