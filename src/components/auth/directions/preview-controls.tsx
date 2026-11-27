"use client";

import { useRouter } from "next/navigation";
import { useId } from "react";

type Option = { id: string; label: string };

/**
 * Dev-only toolbar for the auth direction previews. Kept out of the rendered
 * frame so the frames themselves stay server components, exactly like the real
 * auth pages; `?chrome=0` hides it for screenshots.
 */
export function DirectionControls({
  direction,
  step,
  steps,
  theme,
  state,
  states,
  university,
  universities,
  branded,
  brand,
}: {
  direction: "a" | "b" | "c";
  step: string;
  steps: Option[];
  theme: "light" | "dark";
  state: string;
  states: Option[];
  university: { id: string; shortName: string; vouchingEnabled: boolean; idCardEnabled: boolean };
  universities: Option[];
  branded: boolean;
  brand: "platform" | "campus";
}) {
  const router = useRouter();
  const selectId = useId();

  function go(patch: Record<string, string>) {
    const params = new URLSearchParams({
      step,
      theme,
      u: university.id,
      state,
      brand,
      ...patch,
    });
    router.push(`/design/auth-${direction}?${params.toString()}`, { scroll: false });
  }

  const nextCampus = universities[(universities.findIndex((entry) => entry.id === university.id) + 1) % universities.length]!;
  const nextState = states[(states.findIndex((entry) => entry.id === state) + 1) % states.length]!;

  return (
    <nav
      aria-label="Direction preview controls"
      className="fixed inset-x-0 bottom-0 z-50 border-t border-border bg-surface px-3 py-2"
    >
      <div className="mx-auto flex max-w-3xl flex-wrap items-center gap-2 text-tiny">
        <label htmlFor={selectId} className="font-semibold text-fg-muted">
          Screen
        </label>
        <select
          id={selectId}
          value={step}
          onChange={(event) => go({ step: event.target.value })}
          className="min-h-11 rounded-button border border-border bg-bg px-2 text-tiny text-fg"
        >
          {steps.map((entry) => (
            <option key={entry.id} value={entry.id}>
              {entry.label}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={() => go({ u: nextCampus.id })}
          className="min-h-11 rounded-button border border-border px-2.5 font-semibold text-fg hover:bg-surface-2"
        >
          Campus: {university.shortName}
        </button>
        <button
          type="button"
          onClick={() => go({ brand: branded ? "platform" : "campus" })}
          className="min-h-11 rounded-button border border-border px-2.5 font-semibold text-fg hover:bg-surface-2"
        >
          Brand: {branded ? university.shortName : "Konnekt"}
        </button>
        <button
          type="button"
          onClick={() => go({ theme: theme === "dark" ? "light" : "dark" })}
          className="min-h-11 rounded-button border border-border px-2.5 font-semibold text-fg hover:bg-surface-2"
        >
          {theme === "dark" ? "Light" : "Dark"}
        </button>
        <button
          type="button"
          onClick={() => go({ state: nextState.id })}
          className="min-h-11 rounded-button border border-border px-2.5 font-semibold text-fg hover:bg-surface-2"
        >
          State: {state}
        </button>
        <a href="/design/auth-directions" className="min-h-11 rounded-button bg-accent px-2.5 py-2 font-semibold text-accent-fg">
          All directions
        </a>
      </div>
    </nav>
  );
}
