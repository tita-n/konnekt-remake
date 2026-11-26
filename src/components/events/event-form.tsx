"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ImagePlus, Info, MapPin } from "lucide-react";
import { Button, ButtonLink } from "@/components/ui/button";
import { FormMessage } from "@/components/auth/auth-shell";
import { apiPatch, apiPost } from "@/lib/posts/client";
import { uploadPostImage } from "@/lib/client/post-image";
import { fromDatetimeLocalValue, toDatetimeLocalValue } from "@/lib/domain/event-display";
import {
  EVENT_CATEGORIES,
  MAX_EVENT_CAPACITY,
  MAX_EVENT_DESCRIPTION,
  MAX_EVENT_NOTE,
  MAX_EVENT_TITLE,
  MAX_EVENT_VENUE,
  type EventCategory,
} from "@/lib/domain/events";
import type { EventComposerOptions } from "@/lib/services/event-options";
import type { SerializedEvent } from "@/lib/services/events";

type Organizer = { kind: "USER" | "COMMUNITY" | "OFFICIAL"; id: string | null };

function defaultTimes(timezone: string): { start: string; end: string } {
  const start = new Date(Date.now() + 24 * 60 * 60 * 1000);
  start.setMinutes(0, 0, 0);
  const end = new Date(start.getTime() + 2 * 60 * 60 * 1000);
  return { start: toDatetimeLocalValue(start, timezone), end: toDatetimeLocalValue(end, timezone) };
}

export function EventForm({
  mode,
  timezone,
  options,
  event,
}: {
  mode: "create" | "edit";
  timezone: string;
  options: EventComposerOptions;
  event?: SerializedEvent;
}) {
  const router = useRouter();
  const defaults = useMemo(() => defaultTimes(timezone), [timezone]);
  const [title, setTitle] = useState(event?.title ?? "");
  const [description, setDescription] = useState(event?.description ?? "");
  const [category, setCategory] = useState<EventCategory>((event?.category as EventCategory | undefined) ?? "MEETUP");
  const [organizer, setOrganizer] = useState<Organizer>(() => {
    if (event?.organiserKind === "COMMUNITY" && event.communityId) return { kind: "COMMUNITY", id: event.communityId };
    if (event?.organiserKind === "OFFICIAL" && event.officialAccountId) return { kind: "OFFICIAL", id: event.officialAccountId };
    return { kind: "USER", id: null };
  });
  const defaultAudience = useMemo(() => {
    if (event) {
      const match = options.audiences.find(
        (option) => option.kind === event.audienceKind && option.path.join("/") === event.audiencePath.join("/"),
      );
      if (match) return match.id;
    }
    return options.audiences[0]?.id ?? "university";
  }, [event, options.audiences]);
  const [audienceId, setAudienceId] = useState(defaultAudience);
  const [startsAt, setStartsAt] = useState(event ? toDatetimeLocalValue(event.startsAt, timezone) : defaults.start);
  const [endsAt, setEndsAt] = useState(event ? toDatetimeLocalValue(event.endsAt, timezone) : defaults.end);
  const [venueName, setVenueName] = useState(event?.venueName ?? "");
  const [placeId, setPlaceId] = useState(event?.place?.id ?? "");
  const [venueNote, setVenueNote] = useState(event?.venueNote ?? "");
  const [capacity, setCapacity] = useState(event?.capacity ? String(event.capacity) : "");
  const [waitlistEnabled, setWaitlistEnabled] = useState(event?.waitlistEnabled ?? true);
  const [checkInEnabled, setCheckInEnabled] = useState(event?.checkInEnabled ?? true);
  const [allowOutsideSharing, setAllowOutsideSharing] = useState(event?.allowOutsideSharing ?? false);
  const [coverPublicId, setCoverPublicId] = useState(event?.coverPublicId ?? null);
  const [coverPreview, setCoverPreview] = useState(event?.coverUrl ?? null);
  const [coverBusy, setCoverBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const audience = options.audiences.find((option) => option.id === audienceId) ?? options.audiences[0];
  const isCommunity = organizer.kind === "COMMUNITY";
  const showAudience = !isCommunity;

  const pickCover = async (file: File | undefined) => {
    if (!file) return;
    setCoverBusy(true);
    setError(null);
    try {
      const uploaded = await uploadPostImage(file);
      setCoverPublicId(uploaded.publicId);
      setCoverPreview(uploaded.url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't upload that cover.");
    } finally {
      setCoverBusy(false);
    }
  };

  const submit = async (formEvent: React.FormEvent) => {
    formEvent.preventDefault();
    setError(null);
    const start = fromDatetimeLocalValue(startsAt, timezone);
    const end = fromDatetimeLocalValue(endsAt, timezone);
    if (!start || !end) {
      setError("Pick a start and end time.");
      return;
    }
    if (end <= start) {
      setError("The end time has to be after the start time.");
      return;
    }
    const payload = {
      title: title.trim(),
      description: description.trim(),
      category,
      startsAt: start.toISOString(),
      endsAt: end.toISOString(),
      venueName: venueName.trim(),
      placeId: placeId || null,
      venueNote: venueNote.trim() || null,
      capacity: capacity ? Number(capacity) : null,
      waitlistEnabled,
      checkInEnabled,
      allowOutsideSharing,
      coverPublicId,
      communityId: organizer.kind === "COMMUNITY" ? organizer.id : null,
      officialAccountId: organizer.kind === "OFFICIAL" ? organizer.id : null,
      ...(showAudience && audience ? { audienceKind: audience.kind, audiencePath: audience.path } : {}),
    };
    setBusy(true);
    try {
      if (mode === "create") {
        const result = await apiPost<{ id: string }>("/api/events", payload);
        router.push(`/events/${result.id}`);
      } else if (event) {
        await apiPatch(`/api/events/${event.id}`, payload);
        router.push(`/events/${event.id}`);
      }
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't save the event.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="pb-28" noValidate>
      <header className="flex items-center justify-between px-4 pt-4">
        <div>
          <h1 className="text-h1 text-fg">{mode === "create" ? "Create event" : "Edit event"}</h1>
          <p className="mt-1 text-small text-fg-muted">Times are in {timezone.replace(/_/g, " ")}.</p>
        </div>
        <Link href={event ? `/events/${event.id}` : "/events"} className="text-small font-semibold text-fg-muted underline underline-offset-4">
          Cancel
        </Link>
      </header>

      <div className="space-y-5 px-4 pt-5">
        <div>
          <label htmlFor="event-cover" className="text-small font-semibold text-fg">
            Cover photo <span className="font-normal text-fg-muted">(optional)</span>
          </label>
          <div className="mt-2 flex items-center gap-3">
            <div className="flex aspect-[16/9] w-36 items-center justify-center overflow-hidden rounded-button border border-border bg-surface-2">
              {coverPreview ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={coverPreview} alt="Event cover preview" className="size-full object-cover" />
              ) : (
                <ImagePlus aria-hidden="true" className="size-6 text-fg-subtle" />
              )}
            </div>
            <div>
              <input
                id="event-cover"
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={(change) => void pickCover(change.target.files?.[0])}
                className="block w-full text-small text-fg-muted file:mr-3 file:min-h-9 file:rounded-button file:border file:border-border file:bg-surface-2 file:px-3 file:text-small file:font-semibold file:text-fg"
              />
              <p className="mt-1 text-tiny text-fg-subtle">A 16:9 photo. Without one we use a bold category cover.</p>
              {coverBusy ? <p className="mt-1 text-tiny text-fg-muted">Uploading…</p> : null}
            </div>
          </div>
        </div>

        <div>
          <label htmlFor="event-title" className="text-small font-semibold text-fg">
            Event title
          </label>
          <input
            id="event-title"
            value={title}
            onChange={(change) => setTitle(change.target.value)}
            required
            maxLength={MAX_EVENT_TITLE}
            placeholder="e.g. Robotics demo night"
            className="mt-1 min-h-11 w-full rounded-button border border-border bg-surface px-3 text-small text-fg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
          />
        </div>

        <div>
          <label htmlFor="event-description" className="text-small font-semibold text-fg">
            Description
          </label>
          <textarea
            id="event-description"
            value={description}
            onChange={(change) => setDescription(change.target.value)}
            required
            rows={5}
            maxLength={MAX_EVENT_DESCRIPTION}
            placeholder="What should people expect?"
            className="mt-1 w-full rounded-button border border-border bg-surface px-3 py-2 text-small text-fg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
          />
          <p className="mt-1 text-right text-tiny text-fg-subtle">
            {description.length}/{MAX_EVENT_DESCRIPTION}
          </p>
        </div>

        <div>
          <label htmlFor="event-category" className="text-small font-semibold text-fg">
            Category
          </label>
          <select
            id="event-category"
            value={category}
            onChange={(change) => setCategory(change.target.value as EventCategory)}
            className="mt-1 min-h-11 w-full rounded-button border border-border bg-surface px-3 text-small text-fg"
          >
            {EVENT_CATEGORIES.map((entry) => (
              <option key={entry.value} value={entry.value}>
                {entry.label}
              </option>
            ))}
          </select>
        </div>

        {options.communities.length > 0 || options.officialAccounts.length > 0 ? (
          <div>
            <label htmlFor="event-organizer" className="text-small font-semibold text-fg">
              Organised by
            </label>
            <select
              id="event-organizer"
              value={`${organizer.kind}:${organizer.id ?? ""}`}
              onChange={(change) => {
                const [kind, id] = change.target.value.split(":");
                setOrganizer({ kind: kind as Organizer["kind"], id: id || null });
              }}
              className="mt-1 min-h-11 w-full rounded-button border border-border bg-surface px-3 text-small text-fg"
            >
              <option value="USER:">Me</option>
              {options.communities.map((community) => (
                <option key={community.id} value={`COMMUNITY:${community.id}`}>
                  {community.name}
                </option>
              ))}
              {options.officialAccounts.map((account) => (
                <option key={account.id} value={`OFFICIAL:${account.id}`}>
                  {account.name} (official)
                </option>
              ))}
            </select>
          </div>
        ) : null}

        {showAudience ? (
          <div>
            <label htmlFor="event-audience" className="text-small font-semibold text-fg">
              Who can see it?
            </label>
            <select
              id="event-audience"
              value={audienceId}
              onChange={(change) => setAudienceId(change.target.value)}
              className="mt-1 min-h-11 w-full rounded-button border border-border bg-surface px-3 text-small text-fg"
            >
              {options.audiences.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </select>
            <p className="mt-1 flex items-start gap-1 text-tiny text-fg-muted">
              <Info aria-hidden="true" className="mt-0.5 size-3.5 shrink-0" />
              Changing the audience later never widens access to people who could not already see it.
            </p>
          </div>
        ) : (
          <p className="rounded-card border border-border bg-surface-2 p-3 text-tiny text-fg-muted">
            Community events are visible to active members of that community.
          </p>
        )}

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="event-start" className="text-small font-semibold text-fg">
              Starts
            </label>
            <input
              id="event-start"
              type="datetime-local"
              value={startsAt}
              onChange={(change) => setStartsAt(change.target.value)}
              required
              className="mt-1 min-h-11 w-full rounded-button border border-border bg-surface px-2 text-small text-fg"
            />
          </div>
          <div>
            <label htmlFor="event-end" className="text-small font-semibold text-fg">
              Ends
            </label>
            <input
              id="event-end"
              type="datetime-local"
              value={endsAt}
              onChange={(change) => setEndsAt(change.target.value)}
              required
              className="mt-1 min-h-11 w-full rounded-button border border-border bg-surface px-2 text-small text-fg"
            />
          </div>
        </div>

        <div>
          <label htmlFor="event-venue" className="text-small font-semibold text-fg">
            Venue
          </label>
          <input
            id="event-venue"
            value={venueName}
            onChange={(change) => setVenueName(change.target.value)}
            required
            maxLength={MAX_EVENT_VENUE}
            placeholder="e.g. Faculty of Science, Lecture Theatre 2"
            className="mt-1 min-h-11 w-full rounded-button border border-border bg-surface px-3 text-small text-fg"
          />
          {options.places.length > 0 ? (
            <div className="mt-2 flex items-center gap-2">
              <MapPin aria-hidden="true" className="size-4 shrink-0 text-fg-subtle" />
              <label htmlFor="event-place" className="sr-only">
                Campus place
              </label>
              <select
                id="event-place"
                value={placeId}
                onChange={(change) => setPlaceId(change.target.value)}
                className="min-h-10 flex-1 rounded-button border border-border bg-surface px-2 text-small text-fg"
              >
                <option value="">Not on the campus map</option>
                {options.places.map((place) => (
                  <option key={place.id} value={place.id}>
                    {place.name}
                  </option>
                ))}
              </select>
            </div>
          ) : null}
          <input
            value={venueNote}
            onChange={(change) => setVenueNote(change.target.value)}
            maxLength={MAX_EVENT_NOTE}
            aria-label="Venue note"
            placeholder="Room, entrance or directions (optional)"
            className="mt-2 min-h-11 w-full rounded-button border border-border bg-surface px-3 text-small text-fg"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="event-capacity" className="text-small font-semibold text-fg">
              Capacity <span className="font-normal text-fg-muted">(optional)</span>
            </label>
            <input
              id="event-capacity"
              type="number"
              min={1}
              max={MAX_EVENT_CAPACITY}
              inputMode="numeric"
              value={capacity}
              onChange={(change) => setCapacity(change.target.value)}
              placeholder="Unlimited"
              className="mt-1 min-h-11 w-full rounded-button border border-border bg-surface px-3 text-small text-fg"
            />
          </div>
          <label className="mt-7 flex min-h-11 items-center gap-2 text-small font-semibold text-fg">
            <input type="checkbox" checked={waitlistEnabled} onChange={(change) => setWaitlistEnabled(change.target.checked)} className="size-5 accent-[var(--accent)]" />
            Waitlist when full
          </label>
        </div>

        <fieldset className="space-y-2 rounded-card border border-border p-3">
          <legend className="px-1 text-small font-semibold text-fg">At the door</legend>
          <label className="flex min-h-11 items-center gap-2 text-small text-fg">
            <input type="checkbox" checked={checkInEnabled} onChange={(change) => setCheckInEnabled(change.target.checked)} className="size-5 accent-[var(--accent)]" />
            Issue QR tickets and scan people in
          </label>
          <label className="flex min-h-11 items-center gap-2 text-small text-fg">
            <input type="checkbox" checked={allowOutsideSharing} onChange={(change) => setAllowOutsideSharing(change.target.checked)} className="size-5 accent-[var(--accent)]" />
            Allow sharing outside Konnekt
          </label>
        </fieldset>

        <FormMessage error={error} message={null} />
      </div>

      <div className="border-t border-border bg-surface/95 p-3 backdrop-blur lg:fixed lg:inset-x-0 lg:bottom-6 lg:left-auto lg:right-6 lg:z-30 lg:rounded-card lg:border">
        <div className="mx-auto flex max-w-3xl items-center gap-2">
          <Button type="submit" loading={busy} className="flex-1">
            {mode === "create" ? "Create event" : "Save changes"}
          </Button>
          <ButtonLink href={event ? `/events/${event.id}` : "/events"} variant="secondary">
            Cancel
          </ButtonLink>
        </div>
      </div>
    </form>
  );
}
