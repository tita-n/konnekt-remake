"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  ArrowRight,
  Check,
  ChevronDown,
  Clock3,
  Globe2,
  Lock,
  MailCheck,
  ShieldAlert,
  Sparkles,
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

export function CommunityBadge({ official, privacy }: { official: boolean; privacy: CommunityCardView["privacy"] }) {
  return (
    <span className="inline-flex flex-wrap items-center gap-1">
      {official ? (
        <span className="inline-flex items-center gap-1 rounded-full bg-accent-soft px-2 py-0.5 text-[0.6875rem] font-semibold text-accent-soft-fg">
          <Sparkles aria-hidden="true" className="size-3" />
          Official
        </span>
      ) : null}
      <span className="inline-flex items-center gap-1 rounded-full bg-surface-2 px-2 py-0.5 text-[0.6875rem] font-medium text-fg-muted">
        {privacy === "PUBLIC" ? <Globe2 aria-hidden="true" className="size-3" /> : privacy === "REQUEST" ? <Clock3 aria-hidden="true" className="size-3" /> : <Lock aria-hidden="true" className="size-3" />}
        {COMMUNITY_PRIVACY_LABELS[privacy]}
      </span>
    </span>
  );
}

export function CommunityIcon({ community, size = "md" }: { community: Pick<CommunityCardView, "name" | "slug" | "iconUrl">; size?: "sm" | "md" | "lg" }) {
  return (
    <Avatar
      name={community.name}
      seed={community.slug}
      src={community.iconUrl}
      size={size === "lg" ? "xl" : size}
      className={cn("shrink-0", size === "lg" && "rounded-[22px]")}
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

  if (joinState === "JOINED") {
    return (
      <ButtonLink href={`/c/${slug}`} variant="secondary" size={size} fullWidth={fullWidth} rightIcon={<ArrowRight className="size-4" />}>
        Open
      </ButtonLink>
    );
  }
  if (joinState === "REQUESTED") {
    return (
      <Button variant="secondary" size={size} fullWidth={fullWidth} disabled leftIcon={<Clock3 className="size-4" />}>
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
      <span className="inline-flex min-h-9 items-center gap-1.5 rounded-full bg-danger-soft px-3 text-small font-semibold text-danger">
        <ShieldAlert aria-hidden="true" className="size-4" />
        Unavailable
      </span>
    );
  }
  if (joinState === "INVITE_REQUIRED") {
    return (
      <span className="inline-flex min-h-9 items-center gap-1.5 rounded-full bg-surface-2 px-3 text-small font-medium text-fg-muted">
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
          loading={pending}
          leftIcon={<Clock3 className="size-4" />}
          onClick={() => setRequestOpen(true)}
        >
          Request to join
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
            <p className="text-right text-tiny text-fg-subtle">{message.length}/300</p>
          </div>
        </BottomSheet>
      </>
    );
  }
  return (
    <Button
      size={size}
      fullWidth={fullWidth}
      loading={pending}
      leftIcon={<Users className="size-4" />}
      onClick={() => void join()}
    >
      Join
    </Button>
  );
}

export function CommunityCard({
  community,
  showActivity = false,
}: {
  community: CommunityCardView;
  showActivity?: boolean;
}) {
  return (
    <article className="flex flex-col rounded-card border border-border bg-surface p-4 shadow-[0_1px_0_rgba(16,40,30,0.02)]">
      <div className="flex items-start gap-3">
        <CommunityIcon community={community} />
        <div className="min-w-0 flex-1">
          <Link href={`/c/${community.slug}`} className="block truncate font-display text-[1.0625rem] font-bold text-fg hover:text-accent-ink">
            {community.name}
          </Link>
          <div className="mt-1">
            <CommunityBadge official={community.isOfficial} privacy={community.privacy} />
          </div>
        </div>
      </div>
      <p className="mt-2.5 line-clamp-2 text-small leading-relaxed text-fg-muted">{community.description}</p>
      <p className="mt-2 flex items-center gap-1.5 text-tiny text-fg-subtle">
        <Users aria-hidden="true" className="size-3.5" />
        <span>{community.memberCount.toLocaleString()} members</span>
        <span aria-hidden="true">·</span>
        <span>{community.postCount.toLocaleString()} posts</span>
      </p>
      {showActivity && community.recentActivity ? (
        <p className="mt-1 inline-flex items-center gap-1 text-tiny font-medium text-accent-ink">
          <Check aria-hidden="true" className="size-3" />
          {community.recentActivity}
        </p>
      ) : null}
      <div className="mt-3.5">
        <CommunityJoinButton
          communityId={community.id}
          joinState={community.viewer.joinState}
          privacy={community.privacy}
          slug={community.slug}
          hasInvite={community.viewer.hasInvite}
          fullWidth
        />
      </div>
    </article>
  );
}

export function CommunityTile({ community }: { community: CommunityCardView }) {
  return (
    <Link
      href={`/c/${community.slug}`}
      className="group relative flex min-w-[240px] flex-1 flex-col justify-between overflow-hidden rounded-card border border-border bg-gradient-to-br from-accent-soft via-surface to-surface p-4 transition hover:border-accent/40"
    >
      <div className="flex items-center gap-3">
        <CommunityIcon community={community} size="sm" />
        <div className="min-w-0">
          <p className="truncate font-display text-[1rem] font-bold text-fg">{community.name}</p>
          <p className="truncate text-tiny text-fg-muted">
            {community.recentActivity ?? `${community.memberCount} members`}
          </p>
        </div>
      </div>
      <div className="mt-4 flex items-center justify-between text-tiny text-fg-subtle">
        <span>{community.postCount} posts</span>
        <ChevronDown aria-hidden="true" className="-rotate-90 size-4 text-accent-ink transition group-hover:translate-x-0.5" />
      </div>
    </Link>
  );
}
