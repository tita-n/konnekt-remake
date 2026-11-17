"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ChevronRight, Search } from "lucide-react";
import type { PublicUniversity } from "@/lib/services/universities";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/ui/feedback";
import { Button } from "@/components/ui/button";
import { BottomSheet } from "@/components/ui/overlays";
import { WaitlistForm } from "./waitlist-form";

export function UniversityPicker({ universities }: { universities: PublicUniversity[] }) {
  const [query, setQuery] = useState("");
  const [waitlistOpen, setWaitlistOpen] = useState(false);

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return universities;
    return universities.filter(
      (university) =>
        university.name.toLowerCase().includes(term) || university.shortName.toLowerCase().includes(term),
    );
  }, [query, universities]);

  return (
    <div>
      <label htmlFor="university-search" className="sr-only">
        Search for your university
      </label>
      <div className="relative">
        <Search aria-hidden="true" className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-fg-subtle" />
        <Input
          id="university-search"
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search by name or short name"
          className="pl-10"
          autoComplete="off"
        />
      </div>

      {universities.length === 0 ? (
        <EmptyState
          title="No campuses open yet"
          description="Konnekt is onboarding universities one at a time. Join the waitlist and we'll email you the moment yours opens."
          action={<Button onClick={() => setWaitlistOpen(true)}>Join the waitlist</Button>}
        />
      ) : filtered.length === 0 ? (
        <EmptyState
          illustration="search"
          title="No university matches"
          description={`We couldn’t find “${query.trim()}”. If your school is missing, tell us and we’ll work on it.`}
          action={<Button onClick={() => setWaitlistOpen(true)}>My university isn&apos;t listed</Button>}
        />
      ) : (
        <ul className="mt-3 divide-y divide-border overflow-hidden rounded-card border border-border bg-surface">
          {filtered.map((university) => (
            <li key={university.id}>
              <Link
                href={`/signup/${university.slug}`}
                className="flex min-h-[62px] items-center gap-3 px-3.5 py-2.5 transition hover:bg-surface-2 focus-visible:bg-surface-2"
              >
                {university.logoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={university.logoUrl} alt="" width={40} height={40} className="size-10 rounded-[12px] object-cover" />
                ) : (
                  <span
                    className="flex size-10 shrink-0 items-center justify-center rounded-[12px] text-small font-bold"
                    style={{ background: university.accentColor, color: "#fff" }}
                    aria-hidden="true"
                  >
                    {university.shortName.slice(0, 2).toUpperCase()}
                  </span>
                )}
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[0.9375rem] font-semibold text-fg">{university.name}</span>
                  <span className="block text-small text-fg-subtle">{university.shortName}</span>
                </span>
                <ChevronRight aria-hidden="true" className="size-4 shrink-0 text-fg-subtle" />
              </Link>
            </li>
          ))}
        </ul>
      )}

      {universities.length > 0 ? (
        <p className="mt-4 text-center text-small text-fg-muted">
          Can&apos;t find your school?{" "}
          <button
            type="button"
            onClick={() => setWaitlistOpen(true)}
            className="font-semibold text-accent underline-offset-2 hover:underline"
          >
            Join the waitlist
          </button>
        </p>
      ) : null}

      <BottomSheet
        open={waitlistOpen}
        onClose={() => setWaitlistOpen(false)}
        title="Join the waitlist"
        description="We open one campus at a time. Tell us where you are and we'll email you when it's ready."
      >
        <WaitlistForm defaultUniversity={query} />
      </BottomSheet>
    </div>
  );
}
