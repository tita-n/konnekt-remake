# Konnekt — Phase 1

Konnekt is a PWA-only social network for **verified students at Nigerian universities**. Phase 0 built the foundation: multi-tenant data, identity and verification, onboarding, profiles/settings and the university/platform consoles. Phase 1 adds **Pulse**: posts, questions and polls with path-based audiences, comments, reactions, reposts, bookmarks, hashtags, reports and moderation, blocks and mutes, offline reading, and a per-account outbox that sends once when connectivity returns.

## What is built

### Phase 1 — Pulse

- **Path-based audiences.** A student can post to everyone at their university, or narrow to their college, faculty, department or level. Audiences are stored as academic path arrays. Feeds use an indexed SQL prefilter and every service applies `canSeePost` again, so a mismatch never becomes a read.
- **Posts, questions and polls.** Text and image posts, question posts with a topic tag and accepted answers, polls with one vote per student, edits, deletes and reposts that inherit the original audience.
- **Conversation and discovery.** Threaded comments, helpful marks, reactions, bookmarks, hashtags, mentions and a cursor-paginated feed with a “new posts” indicator.
- **Moderation with an audit trail.** Report a post or comment once, review the queue as an admin/moderator, keep, warn, remove or suspend, and see an append-only activity log. Strikes expire after 90 days; three active strikes flag an account for human review, never an automatic ban.
- **Blocks and mutes.** Blocks are symmetric and invisible in both directions: posts, comments and profiles behave as if they do not exist. Mutes hide an author from the muter’s feed only.
- **Honest offline.** The service worker caches static assets and `/offline` only, never `/api/*` or signed-in HTML. Pulse keeps the last feed page in per-account IndexedDB. Offline posts enter an outbox and send once after reconnect; logout deletes Cache Storage, IndexedDB and account-scoped local storage.
- **Seed data.** 52 students across the Nova University academic tree, with 440 posts, 45 questions, 45 polls, comments, reactions, reports and moderation history.

### Phase 0 foundation

- **Tenant isolation.** Every tenant-owned query goes through `tenantDb(universityId)`, a Prisma extension that injects the tenant into reads and writes. Integration tests cover reads, writes, upserts and role boundaries.
- **Signup and verification.** Student-email auto-verification, private ID-card review, voucher requests, expiring signup drafts, and a single account-creation pipeline.
- **Auth and security.** Argon2id passwords, database sessions, CSRF double-submit, rate limits, Turnstile, append-only audit log, and server-side authorization on every read and write.
- **Student app.** Onboarding, branded shell, profile privacy, settings, data export/deletion and legal pages.
- **University and platform consoles.** Verification queue, student moderation, academic tree, branding, staff invitations, platform university management, waitlist and audit viewer.
- **PWA and quality gates.** Installable manifest, Serwist worker, offline fallback, update prompt, strict TypeScript, ESLint, Vitest unit/integration, Playwright + axe, GitHub Actions and Lighthouse CI.

## Stack

Next.js 15 App Router · React 19 · TypeScript (strict) · Tailwind with CSS-variable tokens · Prisma 6 + PostgreSQL (Neon) · Zod · Resend · Cloudinary · Cloudflare Turnstile · Upstash Redis · Serwist · Sentry · Vitest · Playwright + axe · Lighthouse CI.

External services sit behind adapters in `src/lib/adapters.ts`. `assertProductionServices` runs at process start and refuses to boot in production when a required provider is missing.

## Local setup

Requirements: Node 20.11+ (22 recommended), PostgreSQL 15+.

```bash
npm install
cp .env.example .env            # fill in DATABASE_URL and AUTH_SECRET at minimum
npm run db:migrate              # applies Prisma migrations
npm run db:seed                 # Nova University, staff, 52 students and Pulse content
npm run dev                     # http://localhost:3000
```

If Postgres runs locally on a non-default port, point `DATABASE_URL` at it. In development and tests every missing integration degrades safely and visibly:

| Service | Without credentials |
| --- | --- |
| Resend | Messages go to an in-process outbox, readable at `GET /api/dev/last-email` (blocked in production) |
| Cloudinary | ID images, post images and avatars are stored in local, gitignored folders and served through authorised routes |
| Upstash | Rate limits fall back to in-memory counters |
| Turnstile | Set `TURNSTILE_BYPASS=1`; the widget is hidden |

All demo accounts use the password `KonnektDemo123!`:

| Account | Role |
| --- | --- |
| `admin@konnekt.ng` | Platform admin |
| `admin@nova.edu.ng` | University admin (Nova University, `nova_admin`) |
| `reviewer@nova.edu.ng` | Reviewer, verification queue only (`nova_reviewer`) |
| `courserep@nova.edu.ng` | Official, can vouch (`swe_rep`) |
| `student@nova.edu.ng` | Verified student, 300L Software Engineering (`chinedu_okafor`) |
| `levelmate@nova.edu.ng` | Same department and level (`aisha_bello`) |
| `otherlevel@nova.edu.ng` | Same department, 400L (`tunde_adeyemi`) |
| `otherdept@nova.edu.ng` | Same faculty, another department (`ngozi_eze`) |
| `othercollege@nova.edu.ng` | Another college (`ibrahim_musa`) |
| `pending@nova.edu.ng` | Account with a request in review (`emeka_nwosu`) |
| `rejected@nova.edu.ng` | Declined verification (`zainab_yusuf`) |
| `suspended@nova.edu.ng` | Suspended account (`suspended_nova`) |
| `alumni@nova.edu.ng` | Alumni (`alumni_nova`) |

Nova University: slug `nova-university`, accent `#4F46E5`, matric pattern `^[A-Z]{2,4}/\d{4}/\d{3,4}$`, student domains `student.nova.edu.ng` and `nova.edu.ng`.

The seed refuses to run against production (`prisma/seed-guard.ts`). Seeding twice is safe: it resets only the Nova tenant’s Phase 1 social data.

## Scripts

| Command | Purpose |
| --- | --- |
| `npm run dev` | Development server |
| `npm run build` / `npm start` | Production build and server |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | Next/ESLint (includes the tenant-import boundary rule) |
| `npm test` | Vitest unit tests |
| `npm run test:integration` | Vitest against `konnekt_test` (set `TEST_DATABASE_URL`) |
| `npm run test:e2e` | Playwright + axe (starts the dev server) |
| `npm run db:migrate` / `db:deploy` / `db:seed` | Prisma workflows |
| `npm run icons` | Regenerate PWA icons from the flat mark |
| `npm run shots` | Capture the local design-review screenshots |
| `npm run lighthouse` | Lighthouse CI against `LHCI_URL` or `http://localhost:3100` |

Integration tests need a migrated test database:

```bash
createdb konnekt_test
DATABASE_URL=postgresql://postgres@127.0.0.1:5432/konnekt_test npx prisma migrate deploy
npm run test:integration
```

## Verification

- `tsc --noEmit`: clean.
- `npm run lint`: clean.
- Unit: 54 passed. Integration: 11 passed (tenant isolation, DB constraints, append-only audit, verification decisions, invitations).
- Playwright: **20 passed** — signup (student-email and ID-card), onboarding, audience isolation, polls, reports/moderation, blocks/mutes, shared-device logout, offline outbox, student shell, admin/platform consoles and axe scans.
- Feed plan on the seeded Pulse dataset: `Index Scan Backward` on `Post_universityId_status_rankAt_id_idx`, **0.148 ms**, **22 shared buffers** for the first 21 rows. Full plan in [`docs/PERFORMANCE.md`](./docs/PERFORMANCE.md).
- Lighthouse 12 (Phase 0 production build, local): **Performance 97, Accessibility 100, Best Practices 100, SEO 90**. Lighthouse 12 removed the PWA category; installability is verified through DevTools installability checks instead.

## Deploy

The app targets Vercel + Neon. `.github/workflows/deploy.yml` is manual and expects the full secret set; it applies `prisma migrate deploy` using the unpooled Neon URL before building and deploying. This environment has no deployment credentials, so no staging URL is attached — see **Limitations** in `DECISIONS.md`.

## Documentation

- [`DECISIONS.md`](./DECISIONS.md) — product, security, moderation and design decisions, including deviations.
- [`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md) — request flow, tenancy, auth, social visibility, moderation, media and PWA.
- [`docs/PERFORMANCE.md`](./docs/PERFORMANCE.md) — seed dataset, indexes, EXPLAIN output and pagination strategy.
- [`docs/ENV.md`](./docs/ENV.md) — every environment variable, adapter and production requirement.
- [`docs/UI-REFINEMENT.md`](./docs/UI-REFINEMENT.md) — the refined visual system and what changed.
- [`docs/UI-CONVENTIONS.md`](./docs/UI-CONVENTIONS.md) — presentation, accessibility and test conventions.
- [`docs/UI-SYNC-AUDIT.md`](./docs/UI-SYNC-AUDIT.md) — UI-sync audit, security reverts, invariant matrix and verification.
- [`design/phase-1-components.html`](./design/phase-1-components.html) — Phase 1 component states using the Phase 0 tokens.

## Phase boundaries

Built through Phase 1: feed, posts, questions, polls, comments, reactions, reposts, bookmarks, hashtags, mentions, reports, moderation, blocks, mutes, offline reading and the outbox.

Not built, by design: communities, events, messaging, Campus Voice, push notifications and marketplace. Their tabs remain final empty states; no placeholder APIs or tables exist for them.
