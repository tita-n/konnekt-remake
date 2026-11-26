import type { Metadata } from "next";
import Link from "next/link";
import { getPublicEventPreview } from "@/lib/services/events";
import { formatEventDate, formatEventTime } from "@/lib/domain/event-display";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const preview = await getPublicEventPreview(id).catch(() => null);
  if (!preview) {
    return {
      title: "Event on Konnekt",
      description: "Sign in to Konnekt to see what's happening at your university.",
      robots: { index: false, follow: false },
    };
  }
  const when = `${formatEventDate(preview.startsAt, preview.timezone)} · ${formatEventTime(preview.startsAt, preview.timezone)}`;
  return {
    title: `${preview.title} · ${preview.universityName}`,
    description: `${when} at ${preview.venueName}. See the event on Konnekt.`,
    openGraph: {
      title: preview.title,
      description: `${when} · ${preview.venueName}`,
      type: "website",
    },
    twitter: { card: "summary_large_image", title: preview.title },
  };
}

export default async function PublicEventPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const preview = await getPublicEventPreview(id).catch(() => null);

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-xl flex-col justify-center px-4 py-10">
      <div className="rounded-card border border-border bg-surface p-6 shadow-card">
        {preview ? (
          <>
            <p className="text-tiny font-bold uppercase tracking-widest text-accent-ink">Event · {preview.universityName}</p>
            <h1 className="mt-2 font-display text-h1 font-extrabold text-fg">{preview.title}</h1>
            <dl className="mt-4 space-y-1 text-small text-fg">
              <div>
                <dt className="sr-only">Date and time</dt>
                <dd>
                  {formatEventDate(preview.startsAt, preview.timezone)} · {formatEventTime(preview.startsAt, preview.timezone)}
                </dd>
              </div>
              <div>
                <dt className="sr-only">Venue</dt>
                <dd className="text-fg-muted">{preview.venueName}</dd>
              </div>
            </dl>
            <p className="mt-4 text-small text-fg-muted">
              Sign in with your university account to see the full event, RSVP and get a ticket.
            </p>
          </>
        ) : (
          <>
            <h1 className="font-display text-h1 font-extrabold text-fg">This event is private</h1>
            <p className="mt-2 text-small text-fg-muted">
              Only students in its audience can open this event. If someone shared it with you, ask them to invite you
              inside Konnekt.
            </p>
          </>
        )}
        <Link
          href="/login"
          className="mt-6 inline-flex min-h-11 items-center justify-center rounded-button bg-accent px-4 text-small font-bold text-accent-fg"
        >
          Go to Konnekt
        </Link>
      </div>
      <p className="mt-4 text-center text-tiny text-fg-subtle">
        Konnekt never shows attendee names, counts or organiser details on public links.
      </p>
    </main>
  );
}
