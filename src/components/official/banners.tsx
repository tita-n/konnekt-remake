"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertTriangle, Check, ChevronRight, Megaphone, X } from "lucide-react";
import { apiPost } from "@/lib/posts/client";
import { cn } from "@/lib/utils";
import type { AnnouncementBanner, SerializedAnnouncement } from "@/lib/services/announcements";

async function acknowledge(id: string) {
  await apiPost(`/api/announcements/${id}/ack`);
}

export function CriticalBanner({ announcement }: { announcement: SerializedAnnouncement }) {
  const router = useRouter();
  const [visible, setVisible] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (!visible) return null;

  const ack = async () => {
    setBusy(true);
    setError(null);
    try {
      await acknowledge(announcement.id);
      setVisible(false);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't save your acknowledgement.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section
      aria-labelledby={`critical-${announcement.id}`}
      className="rounded-card border-2 border-highlight bg-highlight-soft p-4"
    >
      <div className="flex items-start gap-3">
        <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-full bg-highlight text-[#3a2500]">
          <AlertTriangle aria-hidden="true" className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[0.6875rem] font-extrabold uppercase tracking-widest text-highlight-fg">
            Critical · {announcement.officialAccount.name}
          </p>
          <h2 id={`critical-${announcement.id}`} className="mt-1 text-h3 font-bold text-fg">
            {announcement.title}
          </h2>
          <p className="mt-1 line-clamp-3 text-small text-fg">{announcement.excerpt}</p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => void ack()}
              disabled={busy}
              className="inline-flex min-h-10 items-center gap-1.5 rounded-button bg-fg px-3 text-small font-bold text-bg transition hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus disabled:opacity-50"
            >
              <Check aria-hidden="true" className="size-4" />
              I understand
            </button>
            <Link
              href={`/official/a/${announcement.id}`}
              className="inline-flex min-h-10 items-center gap-1 rounded-button px-2 text-small font-semibold text-fg underline underline-offset-4"
            >
              Read full notice
              <ChevronRight aria-hidden="true" className="size-4" />
            </Link>
          </div>
          {error ? <p className="mt-2 text-tiny text-danger">{error}</p> : null}
        </div>
        <button
          type="button"
          onClick={() => void ack()}
          aria-label="Acknowledge and dismiss critical notice"
          className="inline-flex size-8 shrink-0 items-center justify-center rounded-full text-fg-muted hover:bg-black/5"
        >
          <X aria-hidden="true" className="size-4" />
        </button>
      </div>
    </section>
  );
}

export function OfficialBanner({ announcement }: { announcement: SerializedAnnouncement }) {
  const router = useRouter();
  const [visible, setVisible] = useState(true);
  const [busy, setBusy] = useState(false);
  if (!visible) return null;

  const dismiss = async () => {
    setBusy(true);
    try {
      await acknowledge(announcement.id);
      setVisible(false);
      router.refresh();
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="flex items-center gap-3 rounded-card border border-border bg-surface p-3" aria-label="Official announcement">
      <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-accent-soft text-accent-ink">
        <Megaphone aria-hidden="true" className="size-4" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[0.6875rem] font-bold uppercase tracking-wide text-fg-subtle">
          Official · {announcement.officialAccount.name}
        </p>
        <Link href={`/official/a/${announcement.id}`} className="mt-0.5 block truncate text-small font-semibold text-fg underline-offset-4 hover:underline">
          {announcement.title}
        </Link>
      </div>
      <button
        type="button"
        onClick={() => void dismiss()}
        disabled={busy}
        aria-label="Mark announcement as read"
        className="inline-flex size-9 shrink-0 items-center justify-center rounded-full text-fg-muted hover:bg-surface-2"
      >
        <X aria-hidden="true" className="size-4" />
      </button>
    </section>
  );
}

export function AnnouncementBanners({ banners }: { banners: AnnouncementBanner }) {
  if (!banners.critical && !banners.official) return null;
  return (
    <div className={cn("space-y-3", banners.critical && banners.official && "pb-1")}>
      {banners.critical ? <CriticalBanner announcement={banners.critical} /> : null}
      {banners.official ? <OfficialBanner announcement={banners.official} /> : null}
    </div>
  );
}
