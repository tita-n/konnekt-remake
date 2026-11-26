# Architecture

## Shape of the app

```
Browser (PWA)
  ├─ public pages      /, /login, /signup/[slug]/*, /legal/*
  ├─ student shell     /pulse, /p/[id], /compose, /hashtag/[tag], /bookmarks,
  │                     /drafts, /communities, /communities/new, /c/[slug],
  │                     /c/[slug]/settings, /events, /inbox, /profile/*, /settings/*
  ├─ university console /admin/*, /admin/reports, /admin/communities,
  │                     /admin/students/[id]/moderation
  └─ platform console   /platform/*     (PLATFORM_ADMIN)

Next.js App Router (Node runtime on Vercel)
  ├─ Server Components  read through services; no client secrets
  ├─ Server Actions     mutations; re-check auth, tenant, CSRF-by-cookie/session action origin
  ├─ Route Handlers     uploads, private images, data export, dev email outbox, waitlist CSV
  ├─ Services           src/lib/services/*  — all business rules
  └─ Prisma             tenantDb(id) extension + platformDb (restricted)
PostgreSQL (Neon)       migrations, partial indexes, audit trigger
Cloudinary / Resend / Upstash / Turnstile / Sentry
```

The browser never receives a secret. Public IDs and signed URLs are produced after a server-side authorisation check. Client-side validation mirrors Zod schemas for feedback; the server copy is authoritative.

## Request lifecycle

1. **Middleware** generates a CSP nonce, sets the request/response CSP and security headers, and passes `x-nonce` to the app. It does **not** authenticate (sessions need the database; route layouts do that).
2. **Layout/page** calls a guard: `requireSessionUser`, `requireStudent`, `requireUniversityRole([...])`, or `requirePlatformAdmin`. Guards redirect for unauthenticated users, `notFound()` for authenticated-but-unauthorised users (so tenant cross-access is indistinguishable from absence).
3. **Service** performs the operation. Every tenant-owned query goes through `tenantDb(universityId)`. Platform operations are explicit and audited.
4. **Audit** is written for admin/security actions. For critical decisions the audit write is part of the transaction’s success path.
5. **UI** renders with the university accent injected as CSS variables (`--accent`, `--accent-fg`); tinted surfaces derive from `color-mix` per theme. Components consume view models and never query Prisma or reimplement an authorization rule. See `docs/UI-CONVENTIONS.md`.

## Presentation layer

`src/styles/tokens.css` owns the colour, spacing, radius, shadow and font tokens. `accentCssVars()` switches the university accent per subtree and derives a dark-theme button/ink pair that clears WCAG AA. The refined components live under `src/components/ui`, `brand`, `app` and the feature folders; `docs/UI-REFINEMENT.md` maps the screens.

Public share previews are a special boundary: `src/app/p/[id]/page.tsx` calls `getPublicPreview()` for a logged-out visitor. It returns one blurred line only when the post is `PUBLIC`, and generic copy for missing, removed, deleted or narrower-audience posts. The page renders no author, avatar, media, counts or university identity and is `noindex, nofollow`.

## Data tenancy

- `src/lib/db/platform.ts` is the unscoped Prisma client. Only platform-admin APIs, infrastructure, migrations and tests import it; ESLint enforces the boundary.
- `src/lib/db/tenant.ts` returns a proxy with a Prisma extension:
  - `findFirst`/`findMany`/`count`/aggregates: `AND` the tenant filter.
  - `findUnique`: resolve through the raw client with `AND`, so another tenant’s id yields `null`.
  - `update`/`delete`: verify ownership with a raw lookup, then run the unique query; the extension does not weaken Prisma’s unique-input contract.
  - `updateMany`/`deleteMany`: tenant `AND`.
  - `create`/`createMany`: inject `universityId`; reject a conflicting explicit value.
  - `upsert`: reject if the existing unique row belongs to another tenant.
  - Non-tenant models (`university`, `waitlistEntry`) throw at runtime and are absent from the type.
- `withTenantTransaction(id, fn)` runs an interactive transaction on the extended client; extension behaviour inside transactions is covered by integration tests.

Tenant models: `AcademicNode`, `User`, `RoleAssignment`, `VerificationRequest`, `EmailCode`, `Session`, `AuditLog`, `RoleInvite`, `Post`, `PostMedia`, `Comment`, `Reaction`, `Bookmark`, `Repost`, `Hashtag`, `PostHashtag`, `Mention`, `Poll`, `PollOption`, `PollVote`, `Draft`, `Report`, `ModerationAction`, `Strike`, `Block`, `Mute`, `HelpfulMark`. Platform-only: `University`, `WaitlistEntry`.

## Social visibility

A `SocialViewer` is resolved once per request from the session: academic path, department, level, labels and lineage. Posts store `audiencePath` (an ordered `text[]`) and `audienceKind`. A viewer may see only exact prefixes of their own path, plus `PUBLIC`.

1. `visibleAudienceFilter` produces exact-array equality predicates for `PUBLIC` and every visible prefix. It never uses substring or label matching.
2. Postgres scans `Post_universityId_status_rankAt_id_idx` in ranking order; the audience predicate filters candidates.
3. Every row is rechecked with `canSeePost`, and relationship sets remove blocked/muted authors.
4. A hidden post, comment or profile calls `notFound()`; the response is the same as a missing record.

Post detail deliberately allows `REMOVED` rows for viewers who could see the original audience, so the author and moderators can inspect the removal notice. `DELETED` rows are absent everywhere. Reposts copy the original audience verbatim and can never widen it.

## Communities

Communities reuse the same viewer and tenant boundary but are deliberately outside the academic audience model. A post with `communityId` stores `audienceKind = COMMUNITY` and an empty `audiencePath`; `canSeePost` rejects it, so it cannot appear in an academic feed or hashtag by accident. `canSeePostInCommunity` is the only community read rule and combines the community privacy/status with a batched `CommunityMember` lookup.

- PUBLIC communities expose metadata and content to verified students at the same university. REQUEST exposes metadata but keeps content, resources and members member-only. INVITE_ONLY is member-only and indistinguishable from a nonexistent slug for outsiders.
- The Pulse `All` and `Communities` tabs include posts from joined active communities; academic chips exclude them. Bookmarks and search only surface content the viewer can currently read.
- Roles are OWNER, MODERATOR and MEMBER. Permissions are pure table-driven checks in `src/lib/domain/community.ts`; a database trigger refuses to remove the last active owner.
- Invite tokens are random, stored as SHA-256, expiring and usage-capped. Name normalization and reserved-name checks run before the per-university unique name/slug constraints.
- Resources live in private storage and are served through a short-lived signed URL after a server-side membership check.
- `/admin/communities` is for university admins and moderators: official requests, suspension, reinstatement, archival and creation of official communities. Community-level moderation stays with the community's own staff.

## Moderation

Reports target one post or comment and are unique per reporter/target. The admin console groups pending reports, shows the target and prior activity, and records a decision (`KEEP`, `WARN`, `REMOVE`, `SUSPEND`). A removal updates the target and its comments, resolves the report, writes a `ModerationAction`, and issues an expiring `Strike` in one tenant transaction. Three active strikes set `flaggedForReviewAt`; no automatic ban exists. `ModerationAction` and `AuditLog` are append-only by product and database trigger respectively.

## Offline and the outbox

- `src/app/sw.ts` precaches build assets and `/offline`; navigations and `/api/*` are `NetworkOnly`. Signed-in HTML and API responses are never stored in Cache Storage.
- `src/lib/offline/store.ts` uses one IndexedDB database with `feeds`, `outbox` and `checkins` stores. Feed keys are user ids, so a cached page cannot cross accounts. `clearKonnektClientData` deletes the database, Cache Storage and account-scoped storage on logout, including queued check-ins.
- The composer writes an outbox item when `navigator.onLine` is false, with the original idempotency key and payload. Pulse flushes on mount and on the `online` event; successful items are removed, server errors are marked failed and retried manually.
- The event scanner queues every scan made offline (or after a lost response) with a client-generated `clientScanId`. Reconnect and the manual retry use that same id, so the server treats a replay as a duplicate rather than a second check-in. Failed rows stay visible with their error until they are retried or cleared.
- The UI never shows a published post while offline. It shows a queued confirmation, then a pending count on Pulse until the server accepts the write.

## Identity and verification

```
Signup
  university → method (student email | ID card | vouch)
  student email: 6-digit code hashed per email/purpose/code, 10-minute expiry, attempt limit
       ↓ verified email + password + consent → User (VERIFIED) → onboarding
  ID card: SignupDraft holds image ref + matric → account creation → PENDING
       ↓ reviewer approves → VERIFIED → onboarding
  vouch: draft selects an Official/Reviewer → request → voucher or admin decides
```

Existing accounts use the same pipeline without a draft. Verification requests are capped at 3 per 24 hours. Matric format is validated against the university pattern; approved matric numbers are unique per university by partial index. A decision deletes the image and emails the student (approved, reason, or note).

Status transitions are explicit (`src/lib/domain/status.ts`): `PENDING → VERIFIED | REJECTED`, `VERIFIED → SUSPENDED | ALUMNI`, `SUSPENDED → VERIFIED`, and so on. Illegal jumps throw before touching the database.

## Sessions and CSRF

- `konnekt_session`: 32-byte random token, httpOnly, Secure in production, SameSite=Lax, 30-day TTL. Only its SHA-256 is stored.
- `konnekt_csrf`: readable cookie containing `HMAC(AUTH_SECRET, "csrf:" + sessionToken)`. Route handlers require `x-konnekt-csrf` to equal it and the cookie. Same-origin is also checked for state-changing requests.
- `getSession()` resolves the token, loads the user with roles and university, and touches `lastSeenAt` at most hourly.
- Login, suspension, role removal, password reset and university switch-off revoke sessions. Revocation is a database update, not a cookie trick.

Rate limits use Upstash sliding windows in production, with separate policies per action and identifier/IP. Development and tests use an in-process limiter.

## Media

| Asset | Storage | Access |
| --- | --- | --- |
| ID card | Cloudinary `authenticated` (`konnekt/verification/*`) or `.private-media/` locally | `GET /api/admin/verification/[id]/image` after reviewer/admin check; 120-second signed URL or local bytes; `no-store` |
| Avatar / logo | Cloudinary public or `public/uploads/avatars/` locally | Public URL; re-encoded 512 px WebP, EXIF stripped |

`sharp` decodes and re-encodes every upload. Upload ceilings are 6 MB input / ~900 KB stored. Filenames are random; user input never becomes a path.

## PWA

- `src/app/manifest.ts` describes the installable app (`/pulse`, standalone, icons, shortcuts).
- `src/app/sw.ts` is bundled by `@serwist/next` to `/sw.js` for production only.
  - Precaches build assets and `/offline`.
  - Navigation requests are `NetworkOnly`; the document fallback is `/offline`.
  - `/api/*` is `NetworkOnly`.
  - `skipWaiting: false`; `PwaProvider` watches for a waiting worker and offers a reload.
- `PwaProvider` registers the worker, handles update prompts; `OfflineBanner` reflects connectivity; `InstallPrompt` appears only after a second visit and can be dismissed permanently.
- CSP excludes service-worker/manifest/static paths from nonce middleware and allows `worker-src 'self' blob:`.

## Testing

| Layer | Tool | Scope |
| --- | --- | --- |
| Unit | Vitest | matric, email domains, colour contrast, password strength, CSV parsing, status machines, slugs, production env/fallback/cookie guards, e2e DB guard |
| Integration | Vitest + real Postgres | tenant isolation (reads/writes/upserts), DB constraints, audit immutability, verification decisions, invitations, 1,000-post feed plan |
| E2E | Playwright | signup, onboarding, audience matrix, polls, reports/removal, blocks/mutes, shared-device logout, offline outbox, public-preview privacy, student shell, admin/platform consoles; dedicated database proof |
| Accessibility | axe via Playwright | public pages, student shell/settings, verification queue/detail, feed and composer; serious/critical must be zero |
| Performance | Lighthouse CI + EXPLAIN | production build Performance ≥90, Accessibility ≥95; feed plan in `docs/PERFORMANCE.md` |

CI runs quality + integration, e2e, Lighthouse, production security invariants, dependency audit, performance budget, UI scope, test-floor and secret-scan jobs. The integration database is migrated with `prisma migrate deploy`; the demo and e2e seeds are deterministic and separate. Current counts are 184 unit, 46 integration and 42 Playwright tests. Playwright gets a dedicated `konnekt_e2e` database on `:3101`; CI snapshots the demo users/posts before and after the run and fails on any diff.

## Failure behaviour

- Env validation fails fast at server start in production. During `next build` validation is skipped because runtime secrets are absent by definition.
- `/api/health` returns 503 unless the runtime database is both reachable and contains the migrated `Post`, `Event` and `Announcement` tables. A pooled URL pointed at the wrong Neon branch cannot masquerade as healthy.
- Email delivery failures are logged and surfaced where the flow can continue; verification decisions commit before email is attempted.
- Storage failures abort uploads with a generic message; no partial record is written.
- Database errors on decisions surface as “Could not save that decision” and never as success.
- Missing Upstash/Cloudinary in development degrade to in-memory/local implementations; production validation prevents that.

## Phase 3 — Events and official announcements

Phase 3 adds two verticals on top of the Phase 1 audience primitive and Phase 2
communities:

- **Events** (`src/lib/domain/events.ts`, `event-ticket.ts`, `event-time.ts`,
  `src/lib/services/events.ts`, `src/components/events/**`). An event carries
  the same academic audience prefix as a post, or is community-scoped. A user,
  community or official account may organise. RSVPs, a capacity counter,
  ordered waitlist, hashed QR tickets and idempotent check-ins live in their own
  tables. Every read goes through `canSeeEvent`; every mutation through
  `eventPermissions`.
- **Official channel** (`src/lib/domain/announcements.ts`, `official.ts`,
  `src/lib/services/announcements.ts`, `official.ts`,
  `src/components/official/**`). Official accounts are university-managed,
  verified voices with their own staff table. They publish announcements (never
  ordinary posts) with academic audiences, optional PDFs, critical flags and
  scheduling. Acknowledgements are per-student and drive both the critical and
  normal banners.

`src/lib/services/event-admin.ts` adds campus places and the event moderation
queue. `/api/cron/announcements` is the only infrastructure entry point; it
enumerates universities and enters tenant scope for each, because cron has no
logged-in tenant. It is secret-gated with a constant-time comparison, fails
closed when the secret is unset in production, is rate limited per caller and
uses a conditional per-row claim. Scheduled announcements also publish lazily
when a student reads the feed, so a missed cron run cannot hide a notice
indefinitely.

Camera check-in uses the native `BarcodeDetector` where it exists. Safari and
other browsers without it load `qr/decode.js` dynamically only when the camera
starts on `/events/[id]/scan`; the bundled decoder is about 17 KB gzipped
(measured with esbuild, minified, browser ESM) and has no production
dependency at runtime beyond the dynamically imported chunk. Typing the ticket
code and name search remain available on every browser and when camera
permission is denied. No camera stream is uploaded, recorded or cached.

The public share routes (`/e/[id]` and its OG image) deliberately bypass the
session and query `platformDb` for a narrow preview gated by PUBLIC + explicit
share + scheduled status. They never reveal attendees, counts, descriptions or
organiser identity. `src/components/pulse/event-modules.tsx` places at most one
critical banner, one official banner, one live rail and one upcoming card above
the Pulse feed.
