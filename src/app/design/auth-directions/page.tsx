import Link from "next/link";
import { notFound } from "next/navigation";
import { ButtonLink } from "@/components/ui/button";
import { Chip } from "@/components/ui/form-controls";
import { AUTH_STEPS } from "@/components/auth/directions/steps";
import { cn } from "@/lib/utils";

export const metadata = { title: "Auth directions · Konnekt" };

type Direction = { key: "a" | "b" | "c"; name: string; tone: string; idea: string; strengths: string; risks: string };

const DIRECTIONS: Direction[] = [
  {
    key: "a",
    name: "Friendly Campus",
    tone: "Warm, plain-spoken, illustrated",
    idea:
      "A clay hero scene and a soft accent-tint panel carry the promise, the form sits in one raised card beside it, and the three verification routes are explained as icon cards. Reads like a helpful upperclassman.",
    strengths:
      "Lowest perceived effort of the three: the lede answers 'why should I bother' before any field appears, and the tinted message panel keeps every step feeling like the same product. Closest to the current design system, so it is the cheapest to adopt.",
    risks:
      "Friendly can drift toward generic; on Welcome it is quieter than the current neo-brutalist button and may test as 'still just a form'.",
  },
  {
    key: "b",
    name: "Bold Youth",
    tone: "Confident, typographic, saturated",
    idea:
      "Half the viewport is an accent block carrying a large display headline, the three benefit lines and an avatar cluster; the form lives in the other half with numbered method rows. The neo-brutalist button stays, but only on Welcome.",
    strengths:
      "Most distinctive and most 'campus' of the three; the split screen makes the promise legible from across a room and gives the flow a real point of view. Reads best on a phone in a bright lecture hall.",
    risks:
      "The saturated block is one accent away from looking like a promo page, and it leans hardest on the university accent being distinct — with two campuses sharing an accent the differentiation drops. Contrast of `accent-fg` text on tinted blocks must be re-checked per custom university colour.",
  },
  {
    key: "c",
    name: "Clean Premium",
    tone: "Calm, precise, minimal",
    idea:
      "A quiet glass header, one hairline step rule, generous whitespace, a single line-art arch mark, and short declarative copy. Exactly one accent style per screen (the primary action); everything else is surface, hairline and type.",
    strengths:
      "Feels the most trustworthy and the least like a social app, which is the impression testers said was missing. Cheapest to maintain: almost no bespoke styling, so token changes in the system flow straight through.",
    risks:
      "Can read cold or empty at 320 px if the whitespace is trimmed, and 'premium' is the least differentiated from a generic SaaS sign-up; it needs the illustration to not disappear entirely.",
  },
];

const STEPS = AUTH_STEPS.map((step) => step.id);

/**
 * Dev-only index for the three Welcome/Login/Sign-up directions. Presentation
 * only: nothing here is reachable in production and no live route is changed.
 */
export default function AuthDirectionsIndexPage() {
  if (process.env.NODE_ENV === "production") notFound();

  return (
    <div className="min-h-dvh bg-bg text-fg">
      <header className="glass sticky top-0 z-30 border-b border-border">
        <div className="mx-auto flex min-h-14 max-w-[1100px] items-center justify-between gap-4 px-5">
          <Link href="/design" className="font-display text-h2 font-bold text-fg">
            Auth directions
          </Link>
          <nav aria-label="Directions" className="flex items-center gap-1.5">
            {DIRECTIONS.map((direction) => (
              <Link
                key={direction.key}
                href={`/design/auth-${direction.key}?chrome=0`}
                className="inline-flex min-h-11 items-center rounded-button px-2.5 text-small font-semibold text-fg-muted transition-colors hover:bg-surface-2 hover:text-fg"
              >
                {direction.key.toUpperCase()}
              </Link>
            ))}
          </nav>
        </div>
      </header>

      <main id="main" className="mx-auto w-full max-w-[1100px] px-5 py-8">
        <p className="text-tiny font-semibold uppercase tracking-[0.08em] text-fg-subtle">
          Welcome · Find university · Sign-up · Onboarding · Login · Reset
        </p>
        <h1 className="mt-1.5 max-w-[52ch] font-display text-display font-bold leading-[1.14]">
          Three complete directions for the flow that testers called unwelcoming
        </h1>
        <p className="mt-2 max-w-[72ch] text-body text-fg-muted">
          Every direction covers the same thirteen screens, reuses the real form components, and keeps all field labels and
          verification states identical. They differ in composition, imagery, colour and tone — not in behaviour. Each route
          takes <code className="text-tiny">?step=</code>, <code className="text-tiny">?theme=light|dark</code>,{" "}
          <code className="text-tiny">?u=nova|riddy|ukas|long</code>, <code className="text-tiny">?state=ok|loading|error|offline</code>{" "}
          and <code className="text-tiny">?chrome=0</code> to hide the control bar.
        </p>

        <ul className="mt-6 space-y-4">
          {DIRECTIONS.map((direction, index) => (
            <li key={direction.key} className="rounded-card border border-border bg-surface p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <h2 className="text-h2 font-bold">
                  <span className="nums text-fg-subtle">{String(index + 1).padStart(2, "0")}</span>{" "}
                  {direction.key.toUpperCase()} — {direction.name}
                </h2>
                <div className="flex flex-wrap items-center gap-1.5">
                  <Chip selected aria-label="Tone">
                    {direction.tone}
                  </Chip>
                  <ButtonLink href={`/design/auth-${direction.key}?chrome=0`} size="sm" variant="secondary" className="min-h-11">
                    Open direction
                  </ButtonLink>
                </div>
              </div>
              <p className="mt-2 max-w-[78ch] text-small text-fg-muted">{direction.idea}</p>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <p className="rounded-button bg-success-soft p-3 text-small leading-relaxed text-fg">
                  <span className="block text-tiny font-bold uppercase tracking-[0.06em] text-success">Strengths</span>
                  {direction.strengths}
                </p>
                <p className="rounded-button bg-warning-soft p-3 text-small leading-relaxed text-fg">
                  <span className="block text-tiny font-bold uppercase tracking-[0.06em] text-warning">Risks</span>
                  {direction.risks}
                </p>
              </div>
              <p className="mt-3 flex flex-wrap gap-1.5">
                {STEPS.map((step) => (
                  <Link
                    key={step}
                    href={`/design/auth-${direction.key}?chrome=0&step=${step}`}
                    className={cn(
                      "inline-flex min-h-11 items-center rounded-chip border border-border px-2.5 text-tiny font-medium text-fg-muted",
                      "transition-colors hover:border-border-strong hover:bg-surface-2 hover:text-fg",
                    )}
                  >
                    {step}
                  </Link>
                ))}
              </p>
            </li>
          ))}
        </ul>

        <h2 className="mt-8 text-h2 font-bold">Side by side</h2>
        <div className="mt-3 overflow-x-auto rounded-card border border-border">
          <table className="w-full min-w-[46rem] border-collapse text-left text-small">
            <caption className="sr-only">Comparison of the three auth directions</caption>
            <thead>
              <tr className="bg-surface-2 text-tiny uppercase tracking-[0.06em] text-fg-subtle">
                <th scope="col" className="p-3 font-semibold">
                  Dimension
                </th>
                {DIRECTIONS.map((direction) => (
                  <th key={direction.key} scope="col" className="p-3 font-semibold">
                    {direction.key.toUpperCase()} · {direction.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[
                ["Tone", (d: Direction) => d.tone],
                [
                  "Colour",
                  (d: Direction) =>
                    ({ a: "Accent as soft tint; one filled CTA", b: "Accent as a full block, tinted tiles", c: "Accent only on the primary action" })[
                      d.key
                    ],
                ],
                [
                  "Imagery",
                  (d: Direction) =>
                    ({ a: "Clay 3D hero scene (existing)", b: "Avatar cluster, no illustration", c: "One line-art SVG mark" })[d.key],
                ],
                [
                  "Typography",
                  (d: Direction) =>
                    ({ a: "clamp() display heading, body copy", b: "Large display headline, tight tracking", c: "h1/h2 only, wide leading" })[
                      d.key
                    ],
                ],
                [
                  "Step indicator",
                  (d: Direction) => ({ a: "Pill rail with connectors", b: "Bar + label stepper", c: "Hairline rule with dots" })[d.key],
                ],
                [
                  "Above-the-fold promise",
                  (d: Direction) => ({ a: "Panel beside the form", b: "Half-screen headline block", c: "Full column beside the card" })[d.key],
                ],
                [
                  "Distinctiveness",
                  (d: Direction) => ({ a: "Medium", b: "High", c: "Low–medium" })[d.key],
                ],
                [
                  "Adoption cost",
                  (d: Direction) => ({ a: "Low — existing tokens", b: "Medium — per-accent contrast checks", c: "Lowest — no bespoke styling" })[
                    d.key
                  ],
                ],
                [
                  "Motion",
                  (d: Direction) => ({ a: "None beyond the system", b: "Hover lift + arrow shift, reduced-motion safe", c: "None" })[d.key],
                ],
              ].map(([label, read]) => (
                <tr key={label as string} className="border-t border-border align-top">
                  <th scope="row" className="w-[10rem] p-3 text-tiny font-semibold uppercase tracking-[0.04em] text-fg-subtle">
                    {label as string}
                  </th>
                  {DIRECTIONS.map((direction) => (
                    <td key={direction.key} className="p-3 leading-relaxed text-fg">
                      {(read as (d: Direction) => string)(direction)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <h2 className="mt-8 text-h2 font-bold">What the directions cannot finish without data</h2>
        <ul className="mt-2 max-w-[80ch] space-y-1.5 text-small leading-relaxed text-fg-muted">
          {[
            "A pre-login university context for Welcome and Find-your-university: the chosen campus record (name, short name, logoUrl, accentColor) must be readable before a session exists. Today /design fixtures stand in for it, so the branded states here are fixture renders, not live screens.",
            "A real per-university logo and custom accent in each of the tones tested (indigo, green, orange), plus a campus with no logo to exercise the monogram fallback — the second state every direction designs.",
            "The live verification settings (idCardEnabled, vouchingEnabled, accepted domains, matric pattern) that decide which method cards appear; the fixtures flip those flags by hand.",
          ].map((line) => (
            <li key={line} className="flex gap-2">
              <span aria-hidden="true" className="mt-[0.45rem] size-1.5 shrink-0 rounded-full bg-accent" />
              <span>{line}</span>
            </li>
          ))}
        </ul>
      </main>
    </div>
  );
}
