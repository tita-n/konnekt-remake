# UI refinement

This pass keeps the Phase 1 product model and replaces the presentation layer
with a warmer, campus-specific visual system. It does not change API contracts,
permissions, audience rules, moderation or offline behaviour.

## Direction

- **Paper, not dashboard.** White/charcoal surfaces, hairline borders, restrained
  shadows and generous whitespace. Glass is reserved for the top bar, bottom tab
  bar and sheets, with an explicit solid fallback.
- **One accent per campus.** Nova University uses `#4F46E5`. Filled controls,
  tinted callouts and focus rings derive from the university accent; dark mode
  lifts the accent to keep text and buttons AA-readable.
- **Student-made imagery.** Clay avatars are deterministic from the username,
  so every seeded student has a stable, human illustration without stock
  photos. Empty and error states use the local illustration set.
- **Campus voice.** Names, departments, hostels, societies and posts in the
  seed belong to a fictional Nova University in Nigeria. No student data is
  copied from Demo University.

## What changed

### Student experience

- Branded app shell with a compact top bar, bottom tab bar and safe-area
  handling.
- Pulse feed with filter chips, an offline banner, a “new posts” pill and a
  clearer audience label on every card.
- Post cards support text, images, questions, accepted answers, polls with
  results, reposts and removable-media image viewing. Long posts truncate at a
  word boundary instead of cutting mid-character.
- Composer with a dedicated audience sheet, poll builder, question topic,
  image thumbnails and draft state.
- Profiles, blocked/muted settings, appearance previews, onboarding, auth,
  legal pages and public share preview all use the same tokens.
- Public share preview shows a blurred first line for public posts and generic
  copy otherwise. No author, counts or media are exposed.

### Admin and platform

- Denser console layouts with a desktop sidebar and mobile horizontal nav.
- Reports workspace with list/detail panes, report metadata, a reason-first
  action form, suspension duration and audit note.
- Student directory with a details drawer and moderation history.
- Verification queue with a private document viewer, academic tree and
  university settings preview in both themes.
- Platform university list, waitlist export and audit view.

### Seed and tests

- Nova University: `nova-university`, accent `#4F46E5`, student domains
  `student.nova.edu.ng` and `nova.edu.ng`, matric pattern
  `^[A-Z]{2,4}/\d{4}/\d{3,4}$`.
- Seed result: 52 students, 440 posts, 45 questions, 45 polls, plus comments,
  reactions, reports and moderation history.
- Academic nodes now persist `parentPath`, so seeding twice is safe.
- E2E accounts and markers use Nova data; durable blocks are cleaned up.

## Visual QA

- axe serious/critical violations: **0** across public auth, student shell and
  settings, and the verification queue.
- Lighthouse on a local production build: **95 performance, 100 accessibility,
  100 best practices, 90 SEO**.
- Both themes are exercised through the design previews under
  `design/review/`; the screenshots are review artifacts, not runtime assets.
- Contrast fixes from the audit: selected chips use `text-accent-fg`, and the
  answered badge uses `--success-solid: #15803d`.

## Where to look

| Area | Files |
| --- | --- |
| Tokens | `src/styles/tokens.css`, `tailwind.config.ts` |
| Primitives | `src/components/ui/*`, `src/components/brand/*` |
| Shell | `src/components/app/*`, `src/app/(shell)/layout.tsx` |
| Pulse | `src/components/pulse/*` |
| Profiles/settings | `src/components/student/*`, `src/components/settings/*` |
| Admin | `src/components/admin/*` |
| Seed | `prisma/seed.ts`, `prisma/seed-social.ts` |
| Rules | `docs/UI-CONVENTIONS.md` |

The audit findings and evidence are in `docs/UI-SYNC-AUDIT.md`.
