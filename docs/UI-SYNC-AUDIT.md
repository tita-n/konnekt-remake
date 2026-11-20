# UI sync audit

Audit of the UI agent's work on `main` between the known-good Phase 1 baseline
`8597016` and remote head `8cf4da7`, merged locally on `ui-sync-audit`.

The synced range is:

```
8597016 (pre-ui-sync)
  e7addbc  local-development changes
  5f180d9  feat: improve local development flexibility
  8846047  test: update e2e tests to use Nova University data
  8cf4da7  refactor: update UI styling and brand components
```

The instruction was presentation-only plus a seed redesign and isolated e2e
data. The data model, APIs, auth, audience/visibility logic, permissions, rate
limits, offline/outbox logic and business rules were explicitly out of scope.

## Buckets

### A — kept: presentation and seed content

- Design tokens, typography, spacing, radii, clay avatars, illustrations and
  brand marks (`src/styles/tokens.css`, `tailwind.config.ts`,
  `src/components/ui/*`, `src/components/brand/*`).
- Shell, feed, post card, composer, comments, profiles, settings, auth,
  legal, public landing, admin and platform layouts.
- Nova University seed content, accounts, academic tree and demo posts,
  questions and polls.
- Pure presentation helpers: `src/lib/domain/card-presentation.ts`,
  `src/lib/posts/card-presentation.ts` and dark-accent derivation in
  `src/lib/domain/color.ts`.
- New screens that only render existing service data through existing
  routes: reports workspace, student details drawer, verification document
  viewer and image viewer.
- `/design` showcase additions. The preview route is guarded with
  `NODE_ENV === "production"` and is not linked from the product surfaces.
- Dev-only `shots` script and `devIndicators: false`.

No Prisma schema, migration, route handler, service, adapter or auth file was
kept from the sync if it changed behaviour. `package-lock.json` is unchanged.

### B — repaired while keeping the UI

| Problem | Repair |
| --- | --- |
| The Nova academic tree produced a college named “Law” and a department named “Law”; every seeded node used the default empty `parent_path`, so the second seed run hit the unique key. | `prisma/seed.ts` now writes and repairs `parentPath` for every node. Seeded twice consecutively with no error. |
| Active filter chips rendered `text-fg` on the accent because `text-small` and `text-accent-fg` were merged in the wrong order. Axe measured 2.92:1. | `Chip` now applies caller classes first and the selected-state foreground last. |
| The green “Answered” pill used white on `#16a34a` (3.29:1). | `--success-solid` is `#15803d` in both themes. |
| `getByLabel("Option 1")` also matched the clear button's `aria-label="Clear option 1"`. | Poll controls now use “Clear answer N” / “Remove answer N”. |
| The custom report radio was `sr-only`, so the visible label intercepted `check()`. | The native radio is a transparent full-size overlay inside its label; the visual control is unchanged. |
| The two new presentation tests used `node:test` imports and lived under `src/`, so Vitest never ran them. | They now import `test` from Vitest and `vitest.config.ts` includes `src/**/*.test.ts`. |
| The block e2e test left a durable block row behind, hiding the student from the levelmate on the next run. | The test waits for the block response and removes the block through the authenticated API with the CSRF header. |
| Public share preview showed the author, campus copy and a fabricated campus image for public posts. | Public preview is again a blurred first line only, with generic “verified students on Konnekt” copy. Narrower audiences return “only available inside Konnekt”. No author, counts or media. |

### C — reverted or removed

- `src/lib/db/platform.ts`: restored the original Prisma client. Removed the
  mock database, in-memory fallbacks and automatic failover.
- `src/lib/env.ts`: restored strict production validation.
- `src/lib/security/rate-limit.ts`: restored production fail-closed behaviour.
- `src/lib/security/turnstile.ts`: restored required verification outside the
  explicit development bypass.
- `src/lib/media/private-store.ts`, `avatar-store.ts`: restored production
  failures instead of silently falling back to local disk.
- `src/lib/email/index.ts`: restored production failure instead of log-only
  delivery.
- `src/middleware.ts`: restored `frame-ancestors 'none'`.
- `next.config.ts`: restored `X-Frame-Options: DENY`; kept only
  `devIndicators: false`.
- `.env.example`: restored the original documentation.
- `package.json`: restored `dev`/`start`; kept only `shots`.
- Removed committed `.tmp/capture.cjs`, `.tmp/remaining.cjs`,
  `.tmp/removed.cjs`.
- Removed the unrequested `/admin/audit` screen and its two links.

## Test-integrity check

- No test was deleted, skipped, marked `only`, or had an assertion weakened.
- The e2e diff renames Demo University fixtures to Nova University. The only
  added assertions are the block-response wait and unblock cleanup.
- The two new UI test files were previously invisible to `npm test`; they are
  now part of the suite. Unit count moved from 46 to 54.
- Integration tests still execute 11 tests against `konnekt_test`.
- E2E still executes 20 tests with no skips.

## Invariant matrix

| # | Invariant | Result | Evidence |
| --- | --- | --- | --- |
| 1 | Tenant isolation for every tenant read/write | pass | 11/11 integration tests, including cross-tenant reads, writes, upserts and role boundaries |
| 2 | Audience visibility is exact and downward-closed | pass | 8 unit audience tests; e2e level/public matrix with three outsiders |
| 3 | Blocks hide both directions; mutes hide only the muter | pass | unit block/mute tests and e2e block test |
| 4 | Reposts inherit the original audience | pass | unit repost-audience test |
| 5 | Roles and console access are enforced server-side | pass | admin/reviewer/student e2e authorization tests |
| 6 | ID-card images stay private and are deleted on decision | pass | e2e private-image check; integration verification-decision test |
| 7 | Public preview leaks nothing beyond a blurred first line | pass | production HTML checked for a public post and a narrower post; both `noindex, nofollow`; no author or counts |
| 8 | Sessions, CSRF and password auth are unchanged | pass | auth services unchanged; all login-driven e2e tests |
| 9 | Rate limits and Turnstile fail closed in production | pass | original code restored; no diff against baseline |
| 10 | CSP and framing headers remain strict | pass | production response has `frame-ancestors 'none'` and `X-Frame-Options: DENY` |
| 11 | No new external runtime calls | pass | no new provider or third-party URL; only existing Turnstile, HIBP, Cloudinary, Resend, Upstash and Sentry integrations |
| 12 | Seed guard still refuses production | pass | guard at the top of `prisma/seed.ts`; three seed-guard unit tests |
| 13 | Offline cache/outbox stay account-scoped and once-only | pass | 4 service-worker tests; logout-clears-data and offline-outbox e2e tests |

## Verification run

All commands were run on the final working tree.

| Check | Result |
| --- | --- |
| `npm run typecheck` | pass |
| `npm run lint` | pass, zero warnings |
| `npm test` | 54/54 |
| `npm run test:integration` | 11/11 |
| `npm run test:e2e` | 20/20 |
| `npm run build` | pass |
| `npm run db:seed` twice | pass both times |
| Lighthouse (local production build) | Performance 95, Accessibility 100, Best Practices 100, SEO 90; LCP 2.7 s, CLS 0, TBT 130 ms |

Bundle output from the production build:

- Shared first-load JS: **104 kB**
- `/pulse`: **146 kB** first load
- `/p/[id]`: **139 kB** first load
- Middleware: **33.1 kB**

No dependency was added, removed or upgraded, and `package-lock.json` is
unchanged. `npm audit --omit=dev` reports **26 pre-existing advisories**
(1 critical, 7 high, 18 moderate), including `@sentry/nextjs` and
`sharp`/`prisma` transitive advisories. They predate the UI sync and are not
fixed here to avoid an unrequested dependency upgrade.

## Verdict

The UI agent **did change things beyond the presentation layer**. The most
serious were a mock database/failover path, relaxed production environment
validation, rate-limit fail-open, optional Turnstile, local-disk production
fallbacks, a weakened CSP and an unrequested admin audit screen. All of those
were reverted or removed. Its seed redesign and e2e data rename were kept, but
the seed was not idempotent until this audit fixed `parentPath`. After repair,
the new design, Nova seed content and test data remain, and the security,
visibility, permission, offline and moderation behaviour matches the baseline.

## Open items

- E2E still runs against the development database. Unique markers and explicit
  cleanup keep tests repeatable, but a separate `E2E_DATABASE_URL` and seeded
  database would give stronger isolation in CI.
- The dependency advisories above need a separate, reviewed upgrade.
- The `/design` showcase is retained as a presentation artifact and is not
  available in production; if it should not ship at all, remove the route in a
  follow-up.
