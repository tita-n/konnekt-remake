"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  Check,
  Clock3,
  EyeOff,
  Globe2,
  Lock,
  MailCheck,
  ShieldAlert,
  ShieldCheck,
  Users,
} from "lucide-react";
import type { CommunityCardView } from "@/lib/communities/types";
import { COMMUNITY_PRIVACY_LABELS } from "@/lib/domain/community";
import { ApiError, apiPost } from "@/lib/posts/client";
import { Avatar } from "@/components/ui/display";
import { Button, ButtonLink } from "@/components/ui/button";
import { BottomSheet } from "@/components/ui/overlays";
import { TextArea } from "@/components/ui/form-controls";
import { useToast } from "@/components/providers/toast-provider";
import { cn } from "@/lib/utils";

/* --------------------------------------------------------------------------
 * Shared community card pieces.
 * Sizes follow docs/UI-CONVENTIONS.md: 16px cards, 1px hairlines, 36px state
 * buttons on list rows, one accent style per screen.
 * ------------------------------------------------------------------------ */

/** The small shield shown next to an official community's name. */
export function OfficialShield({ className }: { className?: string }) {
  return (
    <span
      role="img"
      aria-label="Official community"
      className={cn("inline-flex size-[18px] shrink-0 items-center justify-center rounded-full bg-accent", className)}
    >
      <ShieldCheck aria-hidden="true" className="size-3 text-accent-fg" strokeWidth={2.6} />
    </span>
  );
}

export function CommunityBadge({ official, privacy }: { official: boolean; privacy: CommunityCardView["privacy"] }) {
  return (
    <span className="inline-flex flex-wrap items-center gap-1">
      {official ? (
        <span className="inline-flex items-center gap-1 rounded-chip bg-accent-soft px-2 py-0.5 text-tiny font-semibold text-accent-soft-fg">
          <ShieldCheck aria-hidden="true" className="size-3" />
          Official
        </span>
      ) : null}
      <span className="inline-flex items-center gap-1 rounded-chip bg-surface-2 px-2 py-0.5 text-tiny font-medium text-fg-muted">
        {privacy === "PUBLIC" ? (
          <Globe2 aria-hidden="true" className="size-3" />
        ) : privacy === "REQUEST" ? (
          <Clock3 aria-hidden="true" className="size-3" />
        ) : (
          <EyeOff aria-hidden="true" className="size-3" />
        )}
        {COMMUNITY_PRIVACY_LABELS[privacy]}
      </span>
    </span>
  );
}

export function CommunityIcon({
  community,
  size = "md",
  className,
}: {
  community: Pick<CommunityCardView, "name" | "slug" | "iconUrl">;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  return (
    <Avatar
      name={community.name}
      seed={community.slug}
      src={community.iconUrl}
      size={size === "lg" ? "lg" : size === "md" ? "feature" : "md"}
      className={cn("shrink-0", size === "lg" && "rounded-[20px]", className)}
    />
  );
}

export function CommunityJoinButton({
  communityId,
  joinState,
  privacy,
  slug,
  hasInvite,
  inviteToken,
  size = "sm",
  fullWidth = false,
}: {
  communityId: string;
  joinState: CommunityCardView["viewer"]["joinState"];
  privacy: CommunityCardView["privacy"];
  slug: string;
  hasInvite: boolean;
  inviteToken?: string;
  size?: "sm" | "md" | "lg";
  fullWidth?: boolean;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [pending, setPending] = useState(false);
  const [requestOpen, setRequestOpen] = useState(false);
  const [message, setMessage] = useState("");

  async function acceptInvite(token: string) {
    setPending(true);
    try {
      const result = await apiPost<{ slug: string }>("/api/invites/accept", { token });
      toast({ title: "Invite accepted", variant: "success" });
      router.replace(`/c/${result.slug}`);
    } catch (error) {
      toast({
        title: error instanceof ApiError ? error.message : "Couldn't accept this invite",
        variant: "error",
      });
    } finally {
      setPending(false);
    }
  }

  async function join(requestMessage?: string) {
    setPending(true);
    try {
      const result = await apiPost<{ state: "JOINED" | "REQUESTED" }>(`/api/communities/${communityId}/join`, {
        message: requestMessage,
      });
      toast({
        title: result.state === "JOINED" ? "Joined community" : "Request sent",
        variant: "success",
      });
      setRequestOpen(false);
      router.refresh();
    } catch (error) {
      toast({
        title: error instanceof ApiError ? error.message : "Couldn't join this community",
        variant: "error",
      });
    } finally {
      setPending(false);
    }
  }

  // Every state stays reachable; only the presentation changes.
  const control = size === "sm" ? "h-9 min-h-9" : undefined;

  if (joinState === "JOINED") {
    return (
      <ButtonLink href={`/c/${slug}`} variant="secondary" size={size} fullWidth={fullWidth} className={control} leftIcon={<Check className="size-4" />}>
        Joined
      </ButtonLink>
    );
  }
  if (joinState === "REQUESTED") {
    return (
      <Button variant="ghost" size={size} fullWidth={fullWidth} className={cn("border border-border text-fg-muted", control)} disabled leftIcon={<Clock3 className="size-4" />}>
        Requested
      </Button>
    );
  }
  if (joinState === "INVITED" || hasInvite) {
    if (inviteToken) {
      return (
        <Button
          variant="primary"
          size={size}
          fullWidth={fullWidth}
          loading={pending}
          leftIcon={<MailCheck className="size-4" />}
          onClick={() => void acceptInvite(inviteToken)}
        >
          Accept invite
        </Button>
      );
    }
    return (
      <ButtonLink href={`/c/${slug}`} variant="primary" size={size} fullWidth={fullWidth} leftIcon={<MailCheck className="size-4" />}>
        View invite
      </ButtonLink>
    );
  }
  if (joinState === "BANNED") {
    return (
      <span className="inline-flex min-h-9 items-center gap-1.5 rounded-chip bg-danger-soft px-3 text-small font-semibold text-danger">
        <ShieldAlert aria-hidden="true" className="size-4" />
        Unavailable
      </span>
    );
  }
  if (joinState === "INVITE_REQUIRED") {
    return (
      <span className="inline-flex min-h-9 items-center gap-1.5 rounded-chip bg-surface-2 px-3 text-small font-medium text-fg-muted">
        <Lock aria-hidden="true" className="size-4" />
        Invite only
      </span>
    );
  }
  if (joinState === "UNAVAILABLE") {
    return <span className="text-small text-fg-subtle">Unavailable</span>;
  }
  if (privacy === "REQUEST") {
    return (
      <>
        <Button
          variant="secondary"
          size={size}
          fullWidth={fullWidth}
          className={control}
          loading={pending}
          onClick={() => setRequestOpen(true)}
        >
          {size === "sm" ? "Request" : "Request to join"}
        </Button>
        <BottomSheet
          open={requestOpen}
          onClose={() => setRequestOpen(false)}
          title="Request to join"
          footer={
            <Button fullWidth size="lg" loading={pending} onClick={() => void join(message)}>
              Send request
            </Button>
          }
        >
          <div className="space-y-3 pb-2">
            <p className="text-small text-fg-muted">
              The moderators will see who you are and decide. You can&apos;t read posts until you&apos;re approved.
            </p>
            <TextArea
              label="Add a note (optional)"
              value={message}
              onChange={(event) => setMessage(event.target.value.slice(0, 300))}
              placeholder="Why do you want to join?"
              rows={3}
            />
            <p className="text-right text-tiny nums text-fg-subtle">{message.length}/300</p>
          </div>
        </BottomSheet>
      </>
    );
  }
  return (
    <Button size={size} fullWidth={fullWidth} className={control} loading={pending} onClick={() => void join()}>
      Join
    </Button>
  );
}

/** Discover result row: icon 56, two-line description, meta and a 36px state button. */
export function CommunityCard({
  community,
  showActivity = false,
}: {
  community: CommunityCardView;
  showActivity?: boolean;
}) {
  return (
    <article className="flex min-h-[88px] items-start gap-3 rounded-card border border-border bg-surface p-4">
      <Link
        href={`/c/${community.slug}`}
        className="-my-1 flex min-h-11 shrink-0 items-center focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
        tabIndex={-1}
      >
        <CommunityIcon community={community} />
      </Link>
      <div className="min-w-0 flex-1">
        <div className="flex items-start gap-1.5">
          <Link
            href={`/c/${community.slug}`}
            className="line-clamp-1 font-display text-[0.9375rem] font-semibold leading-[1.3] text-fg"
          >
            {community.name}
          </Link>
          {community.isOfficial ? <OfficialShield className="mt-0.5" /> : null}
        </div>
        <p className="mt-1 line-clamp-2 text-small leading-5 text-fg-muted">{community.description}</p>
        <p className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-tiny leading-[1.375rem] text-fg-subtle">
          <span className="inline-flex items-center gap-1 nums">
            <Users aria-hidden="true" className="size-3.5" />
            {community.memberCount.toLocaleString()} members
          </span>
          {community.privacy === "REQUEST" || community.privacy === "INVITE_ONLY" ? (
            <span className="inline-flex items-center gap-1">
              <Lock aria-hidden="true" className="size-3.5" />
              {COMMUNITY_PRIVACY_LABELS[community.privacy]}
            </span>
          ) : null}
          {showActivity && community.recentActivity ? (
            <span className="inline-flex items-center gap-1 rounded-chip accent-tile px-1.5 py-0.5 text-[0.6875rem] font-semibold">
              {community.recentActivity}
            </span>
          ) : null}
        </p>
      </div>
      <div className="flex shrink-0 items-center self-center">
        <CommunityJoinButton
          communityId={community.id}
          joinState={community.viewer.joinState}
          privacy={community.privacy}
          slug={community.slug}
          hasInvite={community.viewer.hasInvite}
        />
      </div>
    </article>
  );
}

/** Mine rail tile: 148×168 with a 96px tinted category area above the name. */
export function CommunityTile({ community }: { community: CommunityCardView }) {
  return (
    <Link
      href={`/c/${community.slug}`}
      className="group flex min-h-[168px] w-[148px] shrink-0 snap-start flex-col overflow-hidden rounded-card border border-border bg-surface text-left transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus hover:border-border-strong"
    >
      <div className="accent-banner flex h-24 w-full items-center justify-center">
        <CommunityIcon community={community} size="sm" />
      </div>
      <div className="flex min-h-0 flex-1 flex-col px-3 pb-2 pt-2">
        <span className="line-clamp-2 text-[0.9375rem] font-semibold leading-[1.33] text-fg">{community.name}</span>
        <span className="mt-auto flex items-center gap-1 pt-1">
          {community.isOfficial ? <OfficialShield className="shrink-0" /> : null}
          <span className="truncate text-[0.8125rem] leading-[1.375rem] nums text-fg-muted">
            {community.memberCount.toLocaleString()} members
          </span>
        </span>
      </div>
    </Link>
  );
}

/** Mine list row: 72px, icon 48, name and an activity chip in the accent tint. */
export function CommunityListRow({ community }: { community: CommunityCardView }) {
  return (
    <Link
      href={`/c/${community.slug}`}
      className="flex min-h-[72px] items-center gap-3 rounded-card border border-border bg-surface px-3 py-2.5 transition-colors duration-150 hover:border-border-strong focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
    >
      <CommunityIcon community={community} size="sm" />
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5">
          <span className="truncate text-[0.9375rem] font-semibold text-fg">{community.name}</span>
          {community.isOfficial ? <OfficialShield /> : null}
        </span>
        <span className="mt-0.5 flex items-center gap-2">
          {community.status === "ARCHIVED" ? (
            <span className="inline-flex items-center rounded-chip bg-surface-2 px-2 py-0.5 text-[0.6875rem] font-semibold text-fg-muted">
              Archived
            </span>
          ) : null}
          {community.recentActivity ? (
            <span className="inline-flex max-w-full truncate items-center rounded-chip accent-tile px-2 py-0.5 text-[0.6875rem] font-semibold">
              {community.recentActivity}
            </span>
          ) : (
            <span className="truncate text-tiny nums text-fg-muted">{community.memberCount.toLocaleString()} members</span>
          )}
        </span>
      </span>
    </Link>
  );
}
