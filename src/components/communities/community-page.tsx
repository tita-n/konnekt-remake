"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  BookOpen,
  Download,
  FileText,
  Link2,
  Loader2,
  Lock,
  MessageSquare,
  MoreHorizontal,
  Pin,
  Plus,
  Search,
  Settings,
  Shield,
  Trash2,
  Upload,
  Users,
  X,
} from "lucide-react";
import type { CommunityMemberView, CommunityPageView, CommunityResourceView } from "@/lib/communities/types";
import type { PostView } from "@/lib/posts/types";
import { COMMUNITY_CATEGORY_LABELS, COMMUNITY_PRIVACY_LABELS, type CommunityCategory } from "@/lib/domain/community";
import { ApiError, apiDelete, apiGet, apiPatch, apiPost, csrfToken } from "@/lib/posts/client";
import { Button, ButtonLink, IconButton } from "@/components/ui/button";
import { Chip, SelectField, TextArea, TextField } from "@/components/ui/form-controls";
import { BottomSheet } from "@/components/ui/overlays";
import { EmptyState } from "@/components/ui/feedback";
import { useToast } from "@/components/providers/toast-provider";
import { cn, timeAgo } from "@/lib/utils";
import { PostCard } from "@/components/pulse/post-card";
import { CommunityBadge, CommunityIcon, CommunityJoinButton } from "./community-card";

type Tab = "posts" | "resources" | "members" | "about";

export function CommunityPage({
  community,
  initialPosts,
  initialPinned,
  initialResources,
  initialMembers,
  inviteToken,
  initialTab = "posts",
}: {
  community: CommunityPageView;
  initialPosts: PostView[];
  initialPinned: PostView[];
  initialResources: CommunityResourceView[] | null;
  initialMembers: CommunityMemberView[] | null;
  inviteToken?: string;
  initialTab?: Tab;
}) {
  const [tab, setTab] = useState<Tab>(initialTab);
  const [sort, setSort] = useState<"latest" | "top">("latest");
  const [posts, setPosts] = useState(initialPosts);
  const [pinned, setPinned] = useState(initialPinned);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  const canReadContent = community.viewer.isMember || community.privacy === "PUBLIC";
  const locked = !canReadContent;

  async function changeSort(next: "latest" | "top") {
    if (next === sort) return;
    setSort(next);
    setLoading(true);
    try {
      const { data } = await apiGet<{ posts: PostView[]; pinned: PostView[]; nextCursor: string | null }>(
        `/api/communities/${community.id}/posts?sort=${next}`,
      );
      setPosts(data.posts);
      setPinned(data.pinned);
      setNextCursor(data.nextCursor);
    } catch {
      // Keep the initial list if the refresh fails.
    } finally {
      setLoading(false);
    }
  }

  async function loadMore() {
    if (!nextCursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const { data } = await apiGet<{ posts: PostView[]; pinned: PostView[]; nextCursor: string | null }>(
        `/api/communities/${community.id}/posts?sort=${sort}&cursor=${encodeURIComponent(nextCursor)}`,
      );
      const seen = new Set(posts.map((post) => post.id));
      setPosts((current) => [...current, ...data.posts.filter((post) => !seen.has(post.id))]);
      setNextCursor(data.nextCursor);
    } catch {
      // Silent; the user can retry by scrolling again.
    } finally {
      setLoadingMore(false);
    }
  }

  const tabs: Array<{ value: Tab; label: string; icon: typeof Users }> = [
    { value: "posts", label: "Posts", icon: MessageSquare },
    { value: "resources", label: "Resources", icon: BookOpen },
    { value: "members", label: "Members", icon: Users },
    { value: "about", label: "About", icon: Shield },
  ];

  return (
    <div className="pb-8">
      <div className="relative">
        <div
          className="h-32 w-full bg-gradient-to-br from-accent/40 via-accent-soft to-surface-2 sm:h-40"
          style={
            community.bannerUrl
              ? { backgroundImage: `url(${community.bannerUrl})`, backgroundSize: "cover", backgroundPosition: "center" }
              : undefined
          }
        />
        <Link
          href="/communities"
          aria-label="Back to communities"
          className="glass absolute left-3 top-3 flex size-10 items-center justify-center rounded-full border border-border/50 text-fg hover:bg-surface"
        >
          <ArrowLeft aria-hidden="true" className="size-5" />
        </Link>
        {community.viewer.canManage ? (
          <Link
            href={`/c/${community.slug}/settings`}
            aria-label="Community settings"
            className="glass absolute right-3 top-3 flex size-10 items-center justify-center rounded-full border border-border/50 text-fg hover:bg-surface"
          >
            <Settings aria-hidden="true" className="size-5" />
          </Link>
        ) : null}
      </div>

      <header className="px-4">
        <div className="-mt-8 flex items-end gap-3">
          <div className="rounded-[24px] border-4 border-surface bg-surface">
            <CommunityIcon community={community} size="lg" />
          </div>
          <div className="min-w-0 flex-1 pb-1">
            <div className="flex flex-wrap items-center gap-2">
              <CommunityBadge official={community.isOfficial} privacy={community.privacy} />
              {community.status === "ARCHIVED" ? (
                <span className="rounded-full bg-warning-soft px-2 py-0.5 text-[0.6875rem] font-semibold text-warning">Archived</span>
              ) : null}
            </div>
          </div>
        </div>
        <h1 className="mt-2 font-display text-h1 font-bold text-fg">{community.name}</h1>
        <p className="mt-1 text-small leading-relaxed text-fg-muted">{community.description}</p>
        <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-tiny text-fg-subtle">
          <span className="inline-flex items-center gap-1">
            <Users aria-hidden="true" className="size-3.5" />
            {community.memberCount.toLocaleString()} members
          </span>
          <span className="inline-flex items-center gap-1">
            <MessageSquare aria-hidden="true" className="size-3.5" />
            {community.postCount.toLocaleString()} posts
          </span>
          <span>{COMMUNITY_CATEGORY_LABELS[community.category]}</span>
          <span>Created {timeAgo(community.createdAt)}</span>
        </p>
        <div className="mt-3.5 flex items-center gap-2">
          {!community.viewer.isMember ? (
            <CommunityJoinButton
              communityId={community.id}
              joinState={community.viewer.joinState}
              privacy={community.privacy}
              slug={community.slug}
              hasInvite={community.viewer.hasInvite}
              inviteToken={inviteToken}
              size="md"
            />
          ) : (
            <ButtonLink href="/compose" size="md" leftIcon={<Plus className="size-4" />}>
              Post in community
            </ButtonLink>
          )}
          {community.viewer.canModerate && (community.pendingRequestCount > 0 || community.reportedCount > 0) ? (
            <Link
              href={`/c/${community.slug}/settings`}
              className="inline-flex min-h-10 items-center gap-1.5 rounded-full bg-warning-soft px-3 text-small font-semibold text-warning"
            >
              <Shield aria-hidden="true" className="size-4" />
              {community.pendingRequestCount + community.reportedCount} to review
            </Link>
          ) : null}
        </div>
      </header>

      <div className="no-scrollbar sticky top-14 z-20 mt-4 flex gap-1 overflow-x-auto border-b border-border bg-surface/95 px-3 backdrop-blur">
        {tabs.map((entry) => {
          const Icon = entry.icon;
          const selected = tab === entry.value;
          return (
            <button
              key={entry.value}
              type="button"
              aria-current={selected ? "page" : undefined}
              onClick={() => setTab(entry.value)}
              className={cn(
                "relative flex min-h-12 shrink-0 items-center gap-1.5 px-3 text-small font-semibold transition",
                selected ? "text-accent-ink" : "text-fg-muted hover:text-fg",
              )}
            >
              <Icon aria-hidden="true" className="size-4" />
              {entry.label}
              {selected ? <span className="absolute inset-x-2 bottom-0 h-0.5 rounded-full bg-accent" /> : null}
            </button>
          );
        })}
      </div>

      {tab === "posts" ? (
        locked ? (
          <LockedContent community={community} inviteToken={inviteToken} />
        ) : (
          <div className="px-3 pt-3">
            <div className="mb-2 flex items-center justify-end gap-1.5">
              <Chip selected={sort === "latest"} onClick={() => void changeSort("latest")}>
                Latest
              </Chip>
              <Chip selected={sort === "top"} onClick={() => void changeSort("top")}>
                Top
              </Chip>
            </div>
            {loading ? (
              <div className="flex justify-center py-10 text-fg-subtle">
                <Loader2 aria-hidden="true" className="size-5 animate-spin" />
              </div>
            ) : posts.length === 0 && pinned.length === 0 ? (
              <div className="rounded-card border border-border bg-surface">
                <EmptyState
                  illustration="pulse"
                  compact
                  title="No posts yet"
                  description={community.viewer.isMember ? "Start the first conversation in this community." : "The first conversation is waiting."}
                  action={
                    community.viewer.isMember ? (
                      <ButtonLink href="/compose" size="sm" variant="secondary">
                        Write a post
                      </ButtonLink>
                    ) : undefined
                  }
                />
              </div>
            ) : (
              <div className="space-y-3">
                {pinned.map((post) => (
                  <div key={post.id} className="relative">
                    <span className="absolute -top-1 left-3 z-10 inline-flex items-center gap-1 rounded-full bg-accent px-2 py-0.5 text-[0.625rem] font-bold uppercase tracking-wide text-accent-fg">
                      <Pin aria-hidden="true" className="size-2.5" />
                      Pinned
                    </span>
                    <PostCard post={post} />
                  </div>
                ))}
                {posts.map((post) => (
                  <PostCard key={post.id} post={post} />
                ))}
                {nextCursor ? (
                  <div className="flex justify-center py-3">
                    <Button variant="secondary" loading={loadingMore} onClick={() => void loadMore()}>
                      Load more
                    </Button>
                  </div>
                ) : null}
              </div>
            )}
          </div>
        )
      ) : null}

      {tab === "resources" ? (
        <ResourcesTab
          community={community}
          initial={initialResources}
          canUpload={community.viewer.isMember && (community.allowMemberUploads || community.viewer.canModerate)}
        />
      ) : null}

      {tab === "members" ? (
        <MembersTab community={community} initial={initialMembers} />
      ) : null}

      {tab === "about" ? <AboutTab community={community} /> : null}
    </div>
  );
}

function LockedContent({ community, inviteToken }: { community: CommunityPageView; inviteToken?: string }) {
  return (
    <div className="px-3 pt-4">
      <div className="rounded-card border border-border bg-surface">
        <EmptyState
          illustration="padlock"
          title={community.privacy === "REQUEST" ? "Members only" : "Invite only"}
          description={
            community.privacy === "REQUEST"
              ? "Request to join to read posts, resources and the member list."
              : "This community stays invisible to everyone without an invite."
          }
          action={
            <CommunityJoinButton
              communityId={community.id}
              joinState={community.viewer.joinState}
              privacy={community.privacy}
              slug={community.slug}
              hasInvite={community.viewer.hasInvite}
              inviteToken={inviteToken}
              size="lg"
            />
          }
        />
      </div>
      <div className="mt-4 rounded-card border border-border bg-surface p-4">
        <h2 className="font-display text-h3 font-bold text-fg">Community rules</h2>
        {community.rules.length > 0 ? (
          <ol className="mt-2.5 space-y-2.5">
            {community.rules.map((rule) => (
              <li key={rule.id} className="flex gap-2.5">
                <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-accent-soft text-[0.6875rem] font-bold text-accent-ink">
                  {rule.position + 1}
                </span>
                <div>
                  <p className="text-small font-semibold text-fg">{rule.title}</p>
                  <p className="text-tiny leading-relaxed text-fg-muted">{rule.body}</p>
                </div>
              </li>
            ))}
          </ol>
        ) : (
          <p className="mt-1 text-small text-fg-muted">No rules listed yet.</p>
        )}
      </div>
    </div>
  );
}

function ResourcesTab({
  community,
  initial,
  canUpload,
}: {
  community: CommunityPageView;
  initial: CommunityResourceView[] | null;
  canUpload: boolean;
}) {
  const { toast } = useToast();
  const [resources, setResources] = useState(initial ?? []);
  const [loading, setLoading] = useState(initial === null);
  const [category, setCategory] = useState<CommunityCategory | null>(null);
  const [kind, setKind] = useState<"FILE" | "LINK" | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [mode, setMode] = useState<"FILE" | "LINK">("FILE");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [url, setUrl] = useState("");
  const [resourceCategory, setResourceCategory] = useState<CommunityCategory>(community.category);
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (initial !== null) return;
    let cancelled = false;
    void (async () => {
      try {
        const { data } = await apiGet<{ resources: CommunityResourceView[] }>(`/api/communities/${community.id}/resources`);
        if (!cancelled) setResources(data.resources);
      } catch {
        if (!cancelled) setResources([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [community.id, initial]);

  async function refresh(nextCategory: CommunityCategory | null, nextKind: "FILE" | "LINK" | null) {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (nextCategory) params.set("category", nextCategory);
      if (nextKind) params.set("kind", nextKind);
      const { data } = await apiGet<{ resources: CommunityResourceView[] }>(
        `/api/communities/${community.id}/resources?${params.toString()}`,
      );
      setResources(data.resources);
    } catch {
      setResources([]);
    } finally {
      setLoading(false);
    }
  }

  async function add() {
    if (!title.trim()) return;
    setSaving(true);
    try {
      if (mode === "LINK") {
        const result = await apiPost<{ resource: CommunityResourceView }>(
          `/api/communities/${community.id}/resources`,
          { title, description, category: resourceCategory, url },
        );
        setResources((current) => [result.resource, ...current]);
      } else {
        if (!file) throw new Error("Choose a file to upload.");
        const form = new FormData();
        form.append("file", file);
        form.append("title", title);
        form.append("description", description);
        form.append("category", resourceCategory);
        const response = await fetch(`/api/communities/${community.id}/resources`, {
          method: "POST",
          headers: { "x-konnekt-csrf": csrfToken() },
          body: form,
        });
        const data = (await response.json().catch(() => ({}))) as { resource?: CommunityResourceView; error?: string };
        if (!response.ok || !data.resource) throw new Error(data.error ?? "Couldn't upload that resource.");
        setResources((current) => [data.resource!, ...current]);
      }
      toast({ title: "Resource added", variant: "success" });
      setAddOpen(false);
      setTitle("");
      setDescription("");
      setUrl("");
      setFile(null);
    } catch (error) {
      toast({ title: error instanceof Error ? error.message : "Couldn't add that resource", variant: "error" });
    } finally {
      setSaving(false);
    }
  }

  async function remove(resource: CommunityResourceView) {
    try {
      await apiDelete(`/api/communities/${community.id}/resources/${resource.id}`);
      setResources((current) => current.filter((item) => item.id !== resource.id));
      toast({ title: "Resource removed" });
    } catch (error) {
      toast({ title: error instanceof ApiError ? error.message : "Couldn't remove that resource", variant: "error" });
    }
  }

  if (!community.viewer.isMember) {
    return (
      <div className="px-3 pt-4">
        <div className="rounded-card border border-border bg-surface">
          <EmptyState
            illustration="padlock"
            compact
            title="Resources are member-only"
            description="Join this community to see shared files, links and past papers."
          />
        </div>
      </div>
    );
  }

  return (
    <div className="px-3 pt-3">
      <div className="flex items-center gap-2">
        <div className="no-scrollbar flex flex-1 gap-1.5 overflow-x-auto">
          <Chip selected={!category && !kind} onClick={() => { setCategory(null); setKind(null); void refresh(null, null); }}>
            All
          </Chip>
          <Chip selected={kind === "FILE"} onClick={() => { setKind(kind === "FILE" ? null : "FILE"); setCategory(null); void refresh(null, kind === "FILE" ? null : "FILE"); }}>
            Files
          </Chip>
          <Chip selected={kind === "LINK"} onClick={() => { setKind(kind === "LINK" ? null : "LINK"); setCategory(null); void refresh(null, kind === "LINK" ? null : "LINK"); }}>
            Links
          </Chip>
        </div>
        {canUpload && community.status === "ACTIVE" ? (
          <Button size="sm" leftIcon={<Plus className="size-4" />} onClick={() => setAddOpen(true)}>
            Add
          </Button>
        ) : null}
      </div>

      {loading ? (
        <div className="flex justify-center py-10 text-fg-subtle">
          <Loader2 aria-hidden="true" className="size-5 animate-spin" />
        </div>
      ) : resources.length === 0 ? (
        <div className="mt-3 rounded-card border border-border bg-surface">
          <EmptyState
            illustration="bookmarks"
            compact
            title="No resources yet"
            description={canUpload ? "Share a past paper, slide deck or useful link." : "Members haven't shared anything here yet."}
          />
        </div>
      ) : (
        <ul className="mt-3 space-y-2">
          {resources.map((resource) => (
            <li key={resource.id} className="flex items-start gap-3 rounded-card border border-border bg-surface p-3.5">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-[12px] bg-accent-soft text-accent-ink">
                {resource.kind === "LINK" ? <Link2 className="size-4" /> : <FileText className="size-4" />}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-small font-bold text-fg">{resource.title}</p>
                {resource.description ? (
                  <p className="mt-0.5 line-clamp-2 text-tiny leading-relaxed text-fg-muted">{resource.description}</p>
                ) : null}
                <p className="mt-1 text-[0.6875rem] text-fg-subtle">
                  {COMMUNITY_CATEGORY_LABELS[resource.category]} · {resource.uploader.fullName} · {timeAgo(resource.createdAt)}
                  {resource.sizeBytes ? ` · ${(resource.sizeBytes / 1024 / 1024).toFixed(1)} MB` : ""}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <a
                  href={`/api/communities/${community.id}/resources/${resource.id}`}
                  target={resource.kind === "LINK" ? "_blank" : undefined}
                  rel="noreferrer"
                  aria-label={`Download ${resource.title}`}
                  className="flex size-9 items-center justify-center rounded-full text-accent-ink hover:bg-accent-soft"
                >
                  {resource.kind === "LINK" ? <Link2 aria-hidden="true" className="size-4" /> : <Download aria-hidden="true" className="size-4" />}
                </a>
                {resource.canRemove ? (
                  <button
                    type="button"
                    aria-label={`Remove ${resource.title}`}
                    onClick={() => void remove(resource)}
                    className="flex size-9 items-center justify-center rounded-full text-fg-subtle hover:bg-danger-soft hover:text-danger"
                  >
                    <Trash2 aria-hidden="true" className="size-4" />
                  </button>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}

      <BottomSheet
        open={addOpen}
        onClose={() => setAddOpen(false)}
        title="Add a resource"
        footer={
          <Button fullWidth size="lg" loading={saving} onClick={() => void add()}>
            Add resource
          </Button>
        }
      >
        <div className="space-y-3 pb-2">
          <div className="flex gap-2">
            <Chip selected={mode === "FILE"} onClick={() => setMode("FILE")} icon={<Upload className="size-4" />}>
              File
            </Chip>
            <Chip selected={mode === "LINK"} onClick={() => setMode("LINK")} icon={<Link2 className="size-4" />}>
              Link
            </Chip>
          </div>
          <TextField label="Title" required value={title} onChange={(event) => setTitle(event.target.value.slice(0, 120))} />
          <TextArea
            label="Description (optional)"
            rows={2}
            value={description}
            onChange={(event) => setDescription(event.target.value.slice(0, 300))}
          />
          <SelectField
            label="Category"
            value={resourceCategory}
            onChange={(event) => setResourceCategory(event.target.value as CommunityCategory)}
            options={Object.entries(COMMUNITY_CATEGORY_LABELS).map(([value, label]) => ({ value, label }))}
          />
          {mode === "FILE" ? (
            <label className="flex min-h-16 cursor-pointer items-center gap-3 rounded-input border border-dashed border-border-strong bg-surface px-3.5 py-3">
              <Upload aria-hidden="true" className="size-5 text-fg-subtle" />
              <span className="min-w-0 flex-1 truncate text-small text-fg-muted">
                {file ? file.name : "PDF, Office, text or image · up to 10 MB"}
              </span>
              <input
                type="file"
                className="sr-only"
                accept=".pdf,.docx,.pptx,.xlsx,.txt,.png,.jpg,.jpeg,.webp"
                onChange={(event) => setFile(event.target.files?.[0] ?? null)}
              />
            </label>
          ) : (
            <TextField label="https:// link" required value={url} onChange={(event) => setUrl(event.target.value)} placeholder="https://" />
          )}
        </div>
      </BottomSheet>
    </div>
  );
}

function MembersTab({ community, initial }: { community: CommunityPageView; initial: CommunityMemberView[] | null }) {
  const { toast } = useToast();
  const [members, setMembers] = useState(initial ?? []);
  const [loading, setLoading] = useState(initial === null);
  const [status, setStatus] = useState<"ACTIVE" | "BANNED">("ACTIVE");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<CommunityMemberView | null>(null);
  const [reason, setReason] = useState("");
  const [working, setWorking] = useState(false);

  async function fetchMembers(nextStatus: "ACTIVE" | "BANNED", q = query) {
    setLoading(true);
    try {
      const params = new URLSearchParams({ status: nextStatus });
      if (q.trim()) params.set("q", q.trim());
      const { data } = await apiGet<{ members: CommunityMemberView[] }>(
        `/api/communities/${community.id}/members?${params.toString()}`,
      );
      setMembers(data.members);
    } catch (error) {
      setMembers([]);
      if (error instanceof ApiError) toast({ title: error.message, variant: "error" });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (initial !== null) return;
    void fetchMembers("ACTIVE");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function act(action: string, extra: Record<string, unknown> = {}) {
    if (!selected) return;
    setWorking(true);
    try {
      await apiPatch(`/api/communities/${community.id}/members/${selected.userId}`, { action, ...extra });
      toast({ title: "Member updated", variant: "success" });
      setSelected(null);
      setReason("");
      await fetchMembers(status);
    } catch (error) {
      toast({ title: error instanceof ApiError ? error.message : "Couldn't update that member", variant: "error" });
    } finally {
      setWorking(false);
    }
  }

  if (!community.viewer.isMember) {
    return (
      <div className="px-3 pt-4">
        <div className="rounded-card border border-border bg-surface">
          <EmptyState illustration="padlock" compact title="Members are private" description="Join to see who is in this community." />
        </div>
      </div>
    );
  }

  return (
    <div className="px-3 pt-3">
      <TextField
        label="Search members"
        hideLabel
        type="search"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter") void fetchMembers(status);
        }}
        placeholder="Search by name or username"
        leading={<Search aria-hidden="true" className="size-4" />}
      />
      {community.viewer.canModerate ? (
        <div className="mt-2 flex gap-1.5">
          <Chip selected={status === "ACTIVE"} onClick={() => { setStatus("ACTIVE"); void fetchMembers("ACTIVE"); }}>
            Active
          </Chip>
          <Chip selected={status === "BANNED"} onClick={() => { setStatus("BANNED"); void fetchMembers("BANNED"); }}>
            Banned
          </Chip>
        </div>
      ) : null}

      {loading ? (
        <div className="flex justify-center py-10 text-fg-subtle">
          <Loader2 aria-hidden="true" className="size-5 animate-spin" />
        </div>
      ) : members.length === 0 ? (
        <p className="py-8 text-center text-small text-fg-muted">No members found.</p>
      ) : (
        <ul className="mt-3 space-y-1.5">
          {members.map((member) => (
            <li key={member.userId} className="flex items-center gap-3 rounded-button px-1 py-2">
              <CommunityMemberAvatar member={member} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-small font-semibold text-fg">
                  {member.fullName}
                  {member.isViewer ? <span className="ml-1 text-tiny font-normal text-fg-subtle">(you)</span> : null}
                </p>
                <p className="truncate text-tiny text-fg-muted">
                  @{member.username}
                  {member.departmentName ? ` · ${member.departmentName}` : ""}
                  {member.level ? ` · ${member.level}L` : ""}
                </p>
              </div>
              <span
                className={cn(
                  "rounded-full px-2 py-0.5 text-[0.625rem] font-bold uppercase tracking-wide",
                  member.role === "OWNER"
                    ? "bg-accent-soft text-accent-ink"
                    : member.role === "MODERATOR"
                      ? "bg-warning-soft text-warning"
                      : member.status === "BANNED"
                        ? "bg-danger-soft text-danger"
                        : "bg-surface-2 text-fg-muted",
                )}
              >
                {member.status === "BANNED" ? "Banned" : member.role.toLowerCase()}
              </span>
              {community.viewer.canModerate && !member.isViewer && member.role !== "OWNER" && status === "ACTIVE" ? (
                <IconButton label={`Manage ${member.fullName}`} onClick={() => setSelected(member)} className="size-9">
                  <MoreHorizontal aria-hidden="true" className="size-4" />
                </IconButton>
              ) : null}
              {community.viewer.canModerate && status === "BANNED" ? (
                <Button size="sm" variant="secondary" onClick={() => { setSelected(member); void act("unban"); }}>
                  Unban
                </Button>
              ) : null}
            </li>
          ))}
        </ul>
      )}

      <BottomSheet
        open={Boolean(selected)}
        onClose={() => setSelected(null)}
        title={selected ? `Manage ${selected.fullName}` : "Manage member"}
      >
        <div className="space-y-2 pb-2">
          <Button
            fullWidth
            variant="secondary"
            loading={working}
            onClick={() => void act(selected?.role === "MODERATOR" ? "demote" : "promote", {
              role: selected?.role === "MODERATOR" ? "MEMBER" : "MODERATOR",
            })}
          >
            {selected?.role === "MODERATOR" ? "Remove moderator role" : "Make moderator"}
          </Button>
          <Button fullWidth variant="secondary" loading={working} onClick={() => void act("mute", { hours: 24 })}>
            Mute for 24 hours
          </Button>
          <Button fullWidth variant="secondary" loading={working} onClick={() => void act("unmute")}>
            Unmute
          </Button>
          <TextArea
            label="Ban reason"
            rows={2}
            value={reason}
            onChange={(event) => setReason(event.target.value.slice(0, 300))}
            placeholder="Visible to moderators in the audit log"
          />
          <Button fullWidth variant="destructive" loading={working} onClick={() => void act("ban", { reason })}>
            Ban from community
          </Button>
          <Button
            fullWidth
            variant="ghost"
            loading={working}
            onClick={async () => {
              if (!selected) return;
              setWorking(true);
              try {
                await apiDelete(`/api/communities/${community.id}/members/${selected.userId}`);
                toast({ title: "Member removed" });
                setSelected(null);
                await fetchMembers(status);
              } catch (error) {
                toast({ title: error instanceof ApiError ? error.message : "Couldn't remove member", variant: "error" });
              } finally {
                setWorking(false);
              }
            }}
          >
            Remove from community
          </Button>
        </div>
      </BottomSheet>
    </div>
  );
}

function CommunityMemberAvatar({ member }: { member: CommunityMemberView }) {
  return (
    <span className="flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-accent-soft text-small font-bold text-accent-ink">
      {member.photoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={member.photoUrl} alt="" className="size-full object-cover" />
      ) : (
        member.fullName
          .split(/\s+/)
          .map((part) => part[0])
          .join("")
          .slice(0, 2)
      )}
    </span>
  );
}

function AboutTab({ community }: { community: CommunityPageView }) {
  return (
    <div className="space-y-4 px-3 pt-4">
      <section className="rounded-card border border-border bg-surface p-4">
        <h2 className="font-display text-h3 font-bold text-fg">About</h2>
        <p className="mt-2 whitespace-pre-wrap text-small leading-relaxed text-fg-muted">{community.description}</p>
        <dl className="mt-3 grid grid-cols-2 gap-2 text-small">
          <div>
            <dt className="text-tiny text-fg-subtle">Category</dt>
            <dd className="font-semibold text-fg">{COMMUNITY_CATEGORY_LABELS[community.category]}</dd>
          </div>
          <div>
            <dt className="text-tiny text-fg-subtle">Privacy</dt>
            <dd className="font-semibold text-fg">{COMMUNITY_PRIVACY_LABELS[community.privacy]}</dd>
          </div>
          <div>
            <dt className="text-tiny text-fg-subtle">Created</dt>
            <dd className="font-semibold text-fg">{new Date(community.createdAt).toLocaleDateString()}</dd>
          </div>
          <div>
            <dt className="text-tiny text-fg-subtle">Members</dt>
            <dd className="font-semibold text-fg">{community.memberCount.toLocaleString()}</dd>
          </div>
        </dl>
      </section>

      <section className="rounded-card border border-border bg-surface p-4">
        <h2 className="font-display text-h3 font-bold text-fg">Rules</h2>
        {community.rules.length === 0 ? (
          <p className="mt-1 text-small text-fg-muted">No rules listed yet.</p>
        ) : (
          <ol className="mt-2.5 space-y-3">
            {community.rules.map((rule) => (
              <li key={rule.id} className="flex gap-2.5">
                <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-accent-soft text-tiny font-bold text-accent-ink">
                  {rule.position + 1}
                </span>
                <div>
                  <p className="text-small font-semibold text-fg">{rule.title}</p>
                  <p className="text-tiny leading-relaxed text-fg-muted">{rule.body}</p>
                </div>
              </li>
            ))}
          </ol>
        )}
      </section>

      <section className="rounded-card border border-border bg-surface p-4">
        <h2 className="font-display text-h3 font-bold text-fg">Moderators</h2>
        {community.staff.length === 0 ? (
          <p className="mt-1 text-small text-fg-muted">No moderators listed.</p>
        ) : (
          <ul className="mt-2 space-y-2">
            {community.staff.map((member) => (
              <li key={member.userId} className="flex items-center gap-2.5">
                <CommunityMemberAvatar member={{ ...member, status: "ACTIVE", departmentName: null, level: null, mutedUntil: null, isOwner: member.role === "OWNER", isViewer: false }} />
                <div className="min-w-0 flex-1">
                  <Link href={`/profile/${member.username}`} className="truncate text-small font-semibold text-fg hover:text-accent-ink">
                    {member.fullName}
                  </Link>
                  <p className="text-tiny text-fg-muted">{member.role === "OWNER" ? "Owner" : "Moderator"}</p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <p className="px-1 text-center text-tiny leading-relaxed text-fg-subtle">
        This community belongs to one university. Reports go to its moderators and can be escalated to university staff.
      </p>
    </div>
  );
}
