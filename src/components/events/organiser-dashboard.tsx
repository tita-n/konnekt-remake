"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Download, QrCode, Search, UserPlus, Users } from "lucide-react";
import { Avatar } from "@/components/ui/display";
import { Button, ButtonLink } from "@/components/ui/button";
import { BottomSheet } from "@/components/ui/overlays";
import { FormMessage } from "@/components/auth/auth-shell";
import { apiDelete, apiGet, apiPost } from "@/lib/posts/client";
import { formatEventDate, formatEventTime } from "@/lib/domain/event-display";
import type { getOrganiserDashboard } from "@/lib/services/events";

type Dashboard = Awaited<ReturnType<typeof getOrganiserDashboard>>;
type StaffMember = {
  id: string;
  role: "HOST" | "CHECKIN";
  user: { id: string; username: string; fullName: string; photoUrl: string | null; level: number | null };
};
type Candidate = { id: string; username: string; fullName: string; photoUrl: string | null; level: number | null };

const STATUS_FILTERS = [
  { value: "ALL", label: "All" },
  { value: "GOING", label: "Going" },
  { value: "INTERESTED", label: "Interested" },
  { value: "WAITLISTED", label: "Waitlist" },
] as const;

export function OrganiserDashboard({
  dashboard,
  initialStaff,
  canManageStaff,
  canExport,
}: {
  dashboard: Dashboard;
  initialStaff: StaffMember[];
  canManageStaff: boolean;
  canExport: boolean;
}) {
  const { event, stats, attendees } = dashboard;
  const [status, setStatus] = useState<(typeof STATUS_FILTERS)[number]["value"]>("ALL");
  const [query, setQuery] = useState("");
  const [rows, setRows] = useState(attendees);
  const [staff, setStaff] = useState(initialStaff);
  const [staffOpen, setStaffOpen] = useState(false);
  const [staffQuery, setStaffQuery] = useState("");
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const handle = window.setTimeout(async () => {
      try {
        const params = new URLSearchParams();
        if (status !== "ALL") params.set("status", status);
        if (query.trim()) params.set("q", query.trim());
        const { data } = await apiGet<{ attendees: typeof attendees; total: number }>(
          `/api/events/${event.id}/attendees?${params.toString()}`,
        );
        setRows(data.attendees);
      } catch {
        // Keep the last successful list visible when a request fails.
      }
    }, 250);
    return () => window.clearTimeout(handle);
  }, [status, query, event.id, attendees]);

  useEffect(() => {
    if (!staffOpen) return;
    const handle = window.setTimeout(async () => {
      if (staffQuery.trim().length < 2) {
        setCandidates([]);
        return;
      }
      try {
        const { data } = await apiGet<Candidate[]>(`/api/events/${event.id}/staff/search?q=${encodeURIComponent(staffQuery)}`);
        setCandidates(data);
      } catch {
        setCandidates([]);
      }
    }, 250);
    return () => window.clearTimeout(handle);
  }, [staffQuery, staffOpen, event.id]);

  const addStaff = async (candidate: Candidate, role: "HOST" | "CHECKIN") => {
    setBusy(true);
    setError(null);
    try {
      await apiPost(`/api/events/${event.id}/staff`, { userId: candidate.id, role });
      setStaff((current) => [
        ...current,
        { id: candidate.id, role, user: { ...candidate, username: candidate.username } },
      ]);
      setStaffQuery("");
      setCandidates([]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't add staff.");
    } finally {
      setBusy(false);
    }
  };

  const removeStaff = async (userId: string) => {
    setBusy(true);
    setError(null);
    try {
      await apiDelete(`/api/events/${event.id}/staff`, { userId });
      setStaff((current) => current.filter((entry) => entry.user.id !== userId));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't remove staff.");
    } finally {
      setBusy(false);
    }
  };

  const filtered = rows;

  return (
    <div className="space-y-5 pb-12">
      <header>
        <p className="text-tiny font-bold uppercase tracking-widest text-accent-ink">Organiser dashboard</p>
        <h1 className="mt-1 font-display text-h2 font-extrabold text-fg">{event.title}</h1>
        <p className="mt-1 text-small text-fg-muted">
          {formatEventDate(event.startsAt, event.timezone)} · {formatEventTime(event.startsAt, event.timezone)}
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <ButtonLink href={`/events/${event.id}/scan`} size="sm" variant="secondary">
            <QrCode aria-hidden="true" className="size-4" />
            Open scanner
          </ButtonLink>
          <ButtonLink href={`/events/${event.id}/edit`} size="sm" variant="ghost">
            Edit event
          </ButtonLink>
        </div>
      </header>

      <section aria-label="Event statistics" className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {[
          { label: "Views", value: stats.views },
          { label: "Going", value: stats.going },
          { label: "Interested", value: stats.interested },
          { label: "Waitlisted", value: stats.waitlisted },
          { label: "Checked in", value: stats.checkedIn },
          { label: "Check-in rate", value: `${stats.checkInRate}%` },
        ].map((stat) => (
          <div key={stat.label} className="rounded-card border border-border bg-surface p-3">
            <p className="text-h2 font-extrabold tabular-nums text-fg">{stat.value}</p>
            <p className="text-tiny text-fg-muted">{stat.label}</p>
          </div>
        ))}
      </section>

      <section aria-labelledby="trend-heading">
        <h2 id="trend-heading" className="text-h3 text-fg">
          Last 14 days
        </h2>
        <div className="mt-2 grid gap-3 sm:grid-cols-2">
          <div className="rounded-card border border-border bg-surface p-3">
            <p className="text-small font-semibold text-fg">Views per day</p>
            <TrendChart points={dashboard.trend.views} />
          </div>
          <div className="rounded-card border border-border bg-surface p-3">
            <p className="text-small font-semibold text-fg">Check-ins per day</p>
            <TrendChart points={dashboard.trend.checkIns} />
          </div>
        </div>
      </section>

      <section id="attendees" aria-labelledby="attendees-heading">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 id="attendees-heading" className="text-h3 text-fg">
            Attendees
          </h2>
          {canExport ? (
            <a
              href={`/api/events/${event.id}/attendees/export`}
              className="inline-flex min-h-9 items-center gap-1 rounded-button border border-border px-3 text-tiny font-semibold text-fg hover:bg-surface-2"
            >
              <Download aria-hidden="true" className="size-4" />
              Export CSV
            </a>
          ) : null}
        </div>
        <div className="mt-2 flex items-center gap-2 rounded-button border border-border bg-surface px-3">
          <Search aria-hidden="true" className="size-4 text-fg-subtle" />
          <label htmlFor="attendee-search" className="sr-only">
            Search attendees
          </label>
          <input
            id="attendee-search"
            value={query}
            onChange={(change) => setQuery(change.target.value)}
            placeholder="Search name, username or department"
            className="min-h-11 flex-1 bg-transparent text-small text-fg focus:outline-none"
          />
        </div>
        <div className="no-scrollbar mt-2 flex gap-2 overflow-x-auto" role="group" aria-label="Filter attendees">
          {STATUS_FILTERS.map((filter) => (
            <button
              key={filter.value}
              type="button"
              onClick={() => setStatus(filter.value)}
              aria-pressed={status === filter.value}
              className={`min-h-9 shrink-0 rounded-chip border px-3 text-tiny font-semibold ${
                status === filter.value ? "border-accent bg-accent-soft text-accent-soft-fg" : "border-border text-fg-muted"
              }`}
            >
              {filter.label}
            </button>
          ))}
        </div>
        <ul className="mt-3 divide-y divide-border overflow-hidden rounded-card border border-border bg-surface">
          {filtered.length === 0 ? (
            <li className="p-4 text-small text-fg-muted">No attendees match yet.</li>
          ) : (
            filtered.map((attendee) => (
              <li key={attendee.userId} className="flex items-center gap-3 p-3">
                <Avatar name={attendee.fullName} src={attendee.photoUrl} size="sm" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-small font-semibold text-fg">{attendee.fullName}</p>
                  <p className="truncate text-tiny text-fg-muted">
                    @{attendee.username}
                    {attendee.department ? ` · ${attendee.department}` : ""}
                    {attendee.level ? ` · ${attendee.level} level` : ""}
                  </p>
                </div>
                {attendee.checkedInAt ? (
                  <span className="text-tiny font-semibold text-success">
                    In at {formatEventTime(attendee.checkedInAt, event.timezone)}
                  </span>
                ) : (
                  <span className="text-tiny text-fg-subtle">Not yet</span>
                )}
              </li>
            ))
          )}
        </ul>
        <p className="mt-1 text-tiny text-fg-subtle">
          Showing {filtered.length} of {stats.going} going. Full list (up to 200) is in the CSV export.
        </p>
      </section>

      <section aria-labelledby="staff-heading">
        <div className="flex items-center justify-between">
          <h2 id="staff-heading" className="text-h3 text-fg">
            Event staff
          </h2>
          {canManageStaff ? (
            <Button size="sm" variant="secondary" onClick={() => setStaffOpen(true)}>
              <UserPlus aria-hidden="true" className="size-4" />
              Add staff
            </Button>
          ) : null}
        </div>
        <ul className="mt-2 divide-y divide-border overflow-hidden rounded-card border border-border bg-surface">
          {staff.length === 0 ? (
            <li className="p-3 text-small text-fg-muted">No staff yet. Hosts can see attendees and export; check-in staff can scan.</li>
          ) : (
            staff.map((member) => (
              <li key={member.user.id} className="flex items-center gap-3 p-3">
                <Avatar name={member.user.fullName} src={member.user.photoUrl} size="sm" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-small font-semibold text-fg">{member.user.fullName}</p>
                  <p className="text-tiny text-fg-muted">{member.role === "HOST" ? "Host" : "Check-in"}</p>
                </div>
                {canManageStaff ? (
                  <Button size="sm" variant="ghost" onClick={() => void removeStaff(member.user.id)} disabled={busy}>
                    Remove
                  </Button>
                ) : null}
              </li>
            ))
          )}
        </ul>
      </section>

      <section aria-labelledby="changelog-heading">
        <h2 id="changelog-heading" className="text-h3 text-fg">
          Change log
        </h2>
        {dashboard.changeLog.length === 0 ? (
          <p className="mt-1 text-small text-fg-muted">No material changes since publishing.</p>
        ) : (
          <ul className="mt-2 space-y-2">
            {dashboard.changeLog.map((change, index) => (
              <li key={`${change.at}-${index}`} className="rounded-card border border-border bg-surface p-3 text-small text-fg">
                <p className="font-semibold">{formatEventDate(change.at, event.timezone)}</p>
                <p className="text-fg-muted">
                  Changed: {change.fields.join(", ")}. Previous venue: {change.previous.venueName ?? "unchanged"}.
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="flex items-center gap-2">
        <Link href={`/events/${event.id}`} className="text-small font-semibold text-accent-ink underline underline-offset-4">
          View public event
        </Link>
        <span className="text-fg-subtle" aria-hidden="true">
          ·
        </span>
        <Link href={`/e/${event.id}`} className="text-small font-semibold text-accent-ink underline underline-offset-4">
          Share card preview
        </Link>
      </div>

      <BottomSheet open={staffOpen} onClose={() => setStaffOpen(false)} title="Add event staff">
        <div className="space-y-3 px-1 pb-4">
          <p className="text-small text-fg-muted">
            Hosts can see attendees, export the CSV and post updates. Check-in staff can only scan tickets. Maximum 6.
          </p>
          <div className="flex items-center gap-2 rounded-button border border-border bg-bg px-3">
            <Users aria-hidden="true" className="size-4 text-fg-subtle" />
            <label htmlFor="staff-search" className="sr-only">
              Search students
            </label>
            <input
              id="staff-search"
              value={staffQuery}
              onChange={(change) => setStaffQuery(change.target.value)}
              placeholder="Search by name or username"
              className="min-h-11 flex-1 bg-transparent text-small text-fg focus:outline-none"
            />
          </div>
          <ul className="divide-y divide-border">
            {candidates.map((candidate) => (
              <li key={candidate.id} className="flex items-center gap-2 py-2">
                <Avatar name={candidate.fullName} src={candidate.photoUrl} size="sm" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-small font-semibold text-fg">{candidate.fullName}</p>
                  <p className="truncate text-tiny text-fg-muted">@{candidate.username}</p>
                </div>
                <Button size="sm" variant="secondary" onClick={() => void addStaff(candidate, "CHECKIN")} loading={busy}>
                  Check-in
                </Button>
                <Button size="sm" variant="ghost" onClick={() => void addStaff(candidate, "HOST")} loading={busy}>
                  Host
                </Button>
              </li>
            ))}
          </ul>
          <FormMessage error={error} message={null} />
        </div>
      </BottomSheet>
    </div>
  );
}

function TrendChart({ points }: { points: Array<{ date: string; value: number }> }) {
  if (points.length === 0) return <p className="mt-2 text-tiny text-fg-muted">No activity yet.</p>;
  const max = Math.max(...points.map((point) => point.value), 1);
  return (
    <div className="mt-2 flex h-24 items-end gap-1" role="img" aria-label="Daily activity chart">
      {points.map((point) => (
        <div key={point.date} className="flex flex-1 flex-col items-center gap-1">
          <div className="w-full rounded-t-[3px] bg-accent-soft" style={{ height: `${Math.max(4, (point.value / max) * 72)}px` }} />
          <span className="text-[0.5rem] text-fg-subtle">{point.date.slice(8)}</span>
        </div>
      ))}
    </div>
  );
}
