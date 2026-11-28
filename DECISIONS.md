# Decisions

Decisions are recorded when they change behaviour in a way a future maintainer would question. “Because the spec said so” is not repeated here.

## Product and model

### Usernames are globally unique

The spec asks for a username that is unique within a university. Login by username then becomes ambiguous across tenants, and mentions/search would need university context everywhere. Usernames are **globally unique** instead, while the profile still shows the university. This is a deliberate deviation; it removes an entire class of ambiguity and keeps `/@username` meaningful inside one app.

### `SignupDraft` exists so proof can precede an account

The designed order is: pick university → prove studentship → create account. Student-email and ID-card proof need somewhere to live before a `User` exists. A draft holds the proof, a password **hash**, and expires after 24 hours. Account creation consumes it atomically. The alternative — creating an unverified account first — would orphan accounts, leak usernames early, and invert the screen order.

### `PasswordResetToken` and tenant fields on `Session`/`EmailCode`

Reset tokens are hashed, single-use and expire. `Session` and `EmailCode` carry `universityId` so they are tenant-scoped like everything else. `RoleInvite` is tenant-scoped when it is for a university and platform-scoped when it is not.

### Staff invitations require an existing account

An invitation is bound to an email address and accepted by a signed-in user with that address. If the invitee has no account, the invite page directs them to sign up (on an active university) and return. Building a second, parallel signup path for staff would duplicate the most security-sensitive flow in the product for a rare case.

### Phase boundaries are hard

No placeholder tables or endpoints exist for posts, feed, communities, events, messaging, Campus Voice, push or marketplace. Their tabs are final empty states with real copy; Create options say “Coming soon”; platform flags exist but do nothing until their phase ships.

## Tenancy and data

### Tenant isolation is a client extension, not discipline

`tenantDb(universityId)` injects `universityId` into every tenant read/write/delete and removes platform models from its type and runtime surface. A query that forgets a filter still cannot cross tenants. Platform-only code imports the unscoped client, and ESLint blocks that import everywhere else. Integration tests prove reads, writes, upserts and role boundaries.

Prisma cannot express `universityId` on `findUnique` or single-row `update`/`delete` (unique where inputs), so the extension verifies ownership with an unscoped lookup before running the unique query. Writes still name the tenant, but safety does not depend on the caller doing so.

### Hard guarantees live in Postgres

Raw SQL migration `20261117133000_hard_constraints` adds partial unique indexes for: one verified student per matric per university; one pending request per user; one approved request per matric per university; case-insensitive email uniqueness; one role per user/university. It also installs a trigger that rejects `UPDATE`/`DELETE` on `AuditLog`. Application bugs cannot bypass these.

### Audit metadata excludes personal data

Audit rows store actor id, tenant, action, target id, reasons/status changes and counts. Names, emails, matric numbers and image references stay out of metadata. The log’s purpose is accountability, not surveillance.

## Auth and security

### Custom auth with database sessions

Passwords use Argon2id. Sessions are random tokens stored hashed, delivered as httpOnly/Secure/SameSite=Lax cookies. CSRF is double-submit bound to the session token via HMAC. Every sign-in rotates the session; suspension, role removal and university switch-off revoke sessions immediately. Server actions and route handlers re-check authorisation and tenant scope; the UI is never the authority.

### Strict CSP with a per-request nonce

Middleware generates a nonce, sets a strict `script-src` with `strict-dynamic`, and passes the nonce to the app. In production Next’s scripts and the external theme initialiser share the nonce. The theme script is an external cached file, not inline JS; no inline event handlers exist. In development Next’s HMR generates a separate nonce, which produces a hydration warning; production is clean and enforcing.

### ID images are private assets, deleted on decision

Cloudinary uses `authenticated` delivery; reviewers receive a 120-second signed URL only after an authorisation check. Local development stores files in `.private-media` behind the same authorised route. Uploads are re-encoded with `sharp`, which strips EXIF and rejects non-images. Decision deletes the image from storage and nulls the reference in one transaction. Avatars are public and re-encoded to 512 px WebP.

### Accent contrast is gated in the product

A university accent is used on both themes and as a button background. Saving requires ≥3:1 against white and the dark surface, and derived text ≥4.5:1 on the accent. The settings form previews failures and disables saving; the server re-validates. Tinted accent surfaces are derived with CSS `color-mix`, so they follow the active theme.

## PWA and offline

- Serwist is bundled only for production builds; development does not register a worker.
- The worker precaches the app shell and `/offline`, caches navigations, and never caches `/api/*` (so account data cannot be replayed between users on a shared device).
- `skipWaiting` is off: a new version waits for the user, who sees a reload toast. This avoids swapping the worker mid-form.
- Install prompt appears only after a second visit and is dismissible forever. Chrome installability checks report zero errors.
- Offline is honest: the cached shell or `/offline` appears, and the app never pretends a write succeeded.

## Design system

- Flat Material 3 Expressive; glass only on the top bar, bottom tab bar and bottom sheets, with a solid fallback for reduced transparency, Data saver, low memory/CPU or no `backdrop-filter`. Blur is never animated. Create is the only skeuomorphic control.
- Contrast is verified by axe (serious/critical must be zero) and Lighthouse. `--fg-subtle` was darkened to meet 4.5:1 on both the page background and white.
- Mobile-first at 360–414 px; admin consoles use a sidebar on desktop and horizontal navigation on mobile.

## Phase 1 — Pulse, visibility and moderation

### Audience paths are data, not labels

An audience is stored as an ordered academic path (`university`, `college`, `faculty`, `department`, `level`) or the single sentinel `PUBLIC`. The feed turns the viewer’s path into exact path equality filters and lets Postgres return candidates from the ranking index. Every returned row is rechecked with `canSeePost` before serialization. Exact arrays avoid prefix/abbreviation collisions, and the service recheck means a future query mistake cannot widen visibility by itself.

### Hidden means nonexistent

Unauthorised posts, comments and profiles return the same `notFound()` response as missing ones. Blocks are checked in both directions for posts, comments and profiles. Removed posts stay reachable by direct detail for their original audience, with a moderator notice and reason; deleted posts are gone for everyone. This is deliberate: authors and moderators need the removal record, while deletion is the author’s irreversible exit.

### Reports are one per student per target

A partial unique index prevents duplicate reports, and the API checks it before writing. Moderation actions are append-only and carry the reason, moderator and optional strike. Removal and warning issue expiring strikes; three active strikes flag the account for review. Nothing auto-bans, and no moderation action can be edited or deleted from the product.

### Blocks are symmetric; mutes are private

A block hides both students from each other everywhere, including profiles, and is indistinguishable from absence. A mute only removes the muted author from the muter’s feed and hashtag results. Enforcing this in services rather than feed queries is what keeps direct links honest.

### Offline never pretends a write succeeded

The service worker is NetworkOnly for `/api/*` and navigations. Offline Pulse reads the last page cached for that account. A post composed offline is written to the outbox and the composer says it is queued; it is sent once on reconnect with the original idempotency key. Logout deletes the IndexedDB database, Cache Storage and account-scoped local storage. On a shared phone the next student cannot read the previous student’s feed or outbox.

### Feed ranking uses a keyset, not offsets

`rankAt` plus `id` gives a stable total order and a `(rankAt, id)` keyset cursor. The feed index is `(universityId, status, rankAt, id)`, so the first page is an index scan and later pages continue from the same key. Audience filtering is applied to the index scan rather than forcing a sort. The measured plan is recorded in `docs/PERFORMANCE.md`.

## UI sync audit

### Presentation stays separate from platform security

The UI sync was accepted as a visual and seed change, not as a development-mode
shortcut. A mock Prisma client/failover, relaxed production env validation,
fail-open rate limiting, optional Turnstile, production local-disk media/email
fallbacks and a weakened CSP were reverted. Development conveniences belong
behind explicit development branches, never in the default client or the
production boot path.

### The public preview is intentionally minimal

A logged-out `/p/[id]` renders a blurred first line only for a `PUBLIC` post.
Narrower audiences render generic copy. No author, avatar, count, media or
university name is rendered, and the response stays `noindex, nofollow`. A
share preview must not become a side channel for content or identity.

### Nova University replaces the Demo tenant

The seed now models one fictional Nigerian campus, Nova University, with 52
students, 440 posts, 45 questions and 45 polls. The production seed guard is
unchanged. Academic nodes persist `parentPath`; this was missing in the UI
sync and made a second seed collide on the new Law college/department names.

### The design showcase is not a product surface

The `/design` gallery is retained as a presentation artifact. Its dynamic
preview route calls `notFound()` in production and is not linked from the app.
The unrequested `/admin/audit` screen was removed rather than becoming a new
feature.

### Accessibility is part of the definition of done

Serious/critical axe violations block release. The sync's selected-chip and
answered-badge contrast failures were fixed at the token/component level, not
suppressed in the test. The report radio keeps a real native input, and poll
auxiliary labels avoid colliding with the option field names.

## Phase 2 Communities (November 2026)

### Community posts are a separate audience kind

A community post stores `communityId`, `audienceKind = COMMUNITY` and an empty `audiencePath`. `canSeePost` rejects it, so it can never leak into an academic feed, hashtag or profile path by accident. `canSeePostInCommunity` is the only read rule. Reposts inherit the original community, and a community post cannot also be academic.

### INVITE_ONLY is a 404, not a locked door

For non-members, INVITE_ONLY communities are omitted from discovery, suggestions, search and direct lookup. The page returns the same response as a nonexistent slug. REQUEST communities expose metadata so a student can ask to join, but content, resources and the member list stay member-only. Archived communities are readable by existing members and read-only.

### Names are normalized before uniqueness

Community names strip accents, punctuation, spaces and common lookalikes, then check reserved university, academic, official, SUG and admin terms. Both the normalized name and slug are uniquely indexed per university. The database, not just the service, is the final guard.

### The last-owner guard is a database trigger

Service checks can race or be bypassed by a future caller. A trigger rejects removing or demoting the last active owner. The trigger originally returned `OLD` from `BEFORE UPDATE`, which silently reverted every membership update; the follow-up migration returns `NEW` for updates while preserving the delete guard.

### Invite tokens are hashed and narrow

Invite tokens are 32 random bytes encoded as base64url, stored only as SHA-256. Links expire (default 7 days, maximum 30), active invites are capped, and each link has a usage cap. User-targeted invites bind to a specific account. Accepting an invite still runs the same membership and ban checks as joining.

### Resources are private by default

Community resources are stored in private object storage and served through a short-lived signed URL after a server-side membership check. Allowed types are PDF, Office, text and images up to 10 MB, with a 200-resource cap per community. A resource is never a public object URL.

### Onboarding gets a skippable third step

`User.onboardingCompletedAt` is the authoritative gate. Existing verified users were backfilled by migration; new users can choose interests, join suggested communities or skip, then enter the shell. The login landing and shell guard both use the same field.

## Limitations and open items

- **No staging deployment has been run.** The environment has no Vercel/Neon/Resend/Cloudinary/Upstash/Sentry credentials. `docs/STAGING.md` and the hardened deploy workflow are ready; apply migrations and run `deploy.yml` once the accounts and secrets exist.
- **Lighthouse 12 has no PWA category.** Installability is asserted by `scripts/check-pwa.mjs` (manifest with name, icons, start URL and a served service worker) instead of the removed category score.
- **Logo uploads are square-cropped** using the avatar pipeline. A dedicated non-square brand pipeline can come with the media phase.
- **Moderator/Official roles are modelled and grantable** but have no Phase 0 screens beyond vouching (Official). They are not fake permissions; their future capabilities are simply not built.
- **Deletion is a 30-day soft delete.** A scheduled purge job is intentionally out of Phase 0; the data model records `purgeAfter` so the job has a contract.
- **Sentry is installed but not initialised yet.** The SDK is kept patched and its DSN is validated when present, but no Sentry client is started; enabling error monitoring is a separate task. Production env validation does not require it.
- **No staging deployment for Phase 1 either.** No Vercel/Neon/Resend/Cloudinary/Upstash/Turnstile/Sentry credentials were available. The production build, seed, full unit/integration/Playwright suites and local EXPLAIN plans were verified; deployment awaits secrets.
- **Post images use the same Cloudinary adapter as avatars.** Authenticated ID assets remain private; post media is public by design. A dedicated media pipeline for video or large galleries is out of Phase 1.
- **Feed performance is measured on the local seeded dataset.** The plan, not an absolute latency promise, is the portable result; production p95 should be rechecked after real traffic and Neon warm-up.

## Hardening (November 2026)

### E2E has a dedicated database, not a convention

Playwright starts its own server on `:3101` with `DATABASE_URL` replaced by `E2E_DATABASE_URL`. The guard requires a different database name ending in `_e2e` or `_test`, refuses production-looking hosts and requires an explicit opt-in for any remote database. CI seeds the demo database separately, snapshots users/posts, runs Playwright, then diffs the snapshots. The demo seed no longer cleans up E2E markers because e2e never reaches it.

### Production assertions are dependency-free at boot

The instrumentation entry point deliberately does not import the Zod env module. That import was bundled into middleware and added ~25 kB. A small startup check validates the same required names/shapes, while the full schema still runs on every route import. Middleware stays at 34.1 kB (1 kB above the audited 33.1 kB baseline for the startup check).

### Security invariants are executable, not prose

`security/headers.snapshot.json` makes any header loosening a diff. `scripts/security-invariants.mjs` runs the real production server with an unreachable Redis, asserts write endpoints return 429, checks the demo seed refuses production, and starts a second server with an unreachable database to prove it returns 503 rather than serving data. `tests/unit/security-fallbacks.test.ts` covers storage, email and Turnstile fallbacks.

### Fonts are self-hosted, not fetched during CI builds

`next/font/google` fetched font files during `next build`. Several CI jobs
build in parallel, and a rate-limited Google Fonts response failed a build with
a `next/font` parse error. The same Latin variable files are now vendored under
`src/fonts` and loaded with `next/font/local`, so builds are deterministic. The
families and weights are unchanged and both are SIL OFL 1.1.

### Next.js takes the 15.5.29 patch

The earlier audit kept 15.5.28 because the only benefit then was a PostCSS fix
already covered by the override. A later `npm audit` shows three moderate
runtime advisories in 15.5.28 (SVG image-optimizer bypass, HttpOnly cookie
exposure on edge routes, and response injection) with a semver-patch fix in
15.5.29, so the patch is taken rather than deferred.

### Prisma 6 advisories are deferred, with an expiry

Both remaining highs are in Prisma's v6 CLI config loader (`deepmerge-ts`, `effect`). They are build-tool only and receive trusted repository config. Prisma 7 changes the config file and client generation, so it is a separate migration. The allowlist entries expire 2027-01-15; CI rejects unlisted/expired entries. Every other critical/high/moderate advisory was fixed in this branch.

### Budgets and guards are checked against the repository

`perf/baseline.json` records the measured build and Lighthouse result; key routes may not grow more than 10% without an explicit baseline update. `ci/test-floor.json` enforces 85/18/26 (Phase 2 current) and rejects skipped/focused tests. `.github/ui-guard.json` blocks UI-only branches from touching schema, services, auth, APIs, actions, workers, dependencies, env, security, performance or test infrastructure. CODEOWNERS requires owner review for the same paths.

### Staging is prepared, not deployed

The deploy workflow validates environment variables before migrations or Vercel, then runs a read-only smoke test after deployment. `docs/STAGING.md` lists the accounts, values, GitHub secrets, SPF/DKIM, Cloudinary and Turnstile setup. No credentials are invented or committed.

## Stabilization pass (November 2026)

### Feeds are strictly reverse-chronological

The reported “grouping” was the narrower-audience boost: `rankAt` added ten
minutes per audience layer, so level posts clustered above newer campus posts.
Every feed view now orders by `(createdAt DESC, id DESC)` with a paired keyset
cursor, a repost appears at repost time, and an edit never changes order. The
legacy `rankAt` column stays for compatibility but is no longer read. Cursors
issued before the change still decode.

### Replies store depth, display three levels

Replies may nest up to a safety maximum of 20 stored levels; the earlier
one-level limit was functional, not visual. The thread loads once (bounded to
1,000 comments) and display flattens at level 3, where a deeper reply shows
“Replying to @name” with a jump link. This keeps query count flat while allowing
long chains, and the client reveals replies beyond the first two on demand.

### One overlay dismissal contract

Native `<dialog>` gives Escape, focus trapping and focus return. On top of it,
`useOverlayDismiss` pushes a history marker so Android back closes the top
overlay, closes on a route change, and compares outside taps against the panel
rather than the full-height sheet wrapper (the old bug: taps above the sheet hit
a wrapper element and never reached the dialog). Sheets add a downward swipe.

### Idempotency is a per-user claim with a 24-hour result

A mutating request may carry `Idempotency-Key`. The first request claims it with
one atomic insert, a concurrent duplicate waits then replays the stored status
and body, and a 5xx releases the claim so a retry can run. Claims are scoped to
one user. Posts already had a unique key; comments, community create/join,
event create/RSVP and reports now use the shared claim. Client composers keep
one key per intent and disable the control while pending.

### The Create sheet reflects what is built

Post, Question, Poll, Community and Event open their real screens. Campus Voice
remains the only “Coming soon” option. “Post an announcement” appears only for
official-account staff and administrators and opens the official composer.

### Platform pages carry no university brand

The welcome page and design gallery no longer name a seeded university. All
university branding is read from `University` (name, logo, accent) and appears
only after a university is chosen or a student is signed in. New tenant-level
checks: a CI guard rejects a seeded or real university name literal anywhere in
`src`, and the e2e seed contains a second tenant (Lakeside University, different
accent and domain) so a branding leak fails a test.

### Vouching is shown whenever the university enables it

The signup card used to appear only when a voucher existed, which made an
admin's “vouching on” setting look broken. The card now follows
`vouchingEnabled`; when no reviewer or official is listed, the vouch screen
explains that and offers the working alternatives instead of redirecting.

### The demo seed shows real media and a live event

Events and communities get varied cover, icon and banner art served from
`/seed` (the URL helpers pass app-relative paths through instead of building a
Cloudinary URL), the critical registration notice has a PDF attachment, the
live event is relative to seed time, and attendee lists are populated. This art
is demo-only and never uploaded to Cloudinary.

### The academic tree is cached per instance for 60 seconds

Every request used to load the viewer's department plus every academic node in
the university. The tree changes rarely and is identical for all viewers in a
tenant, so it is cached for 60 seconds per server instance. Admin mutations call
`invalidateAcademicTree`; the staleness window is bounded and never affects
authorization (the post/community rule still rechecks the viewer's path).

### One image delivery helper with named widths

`src/lib/media/image-url.ts` is the only place that builds a Cloudinary URL.
Only five named widths exist (`avatar`, `thumb`, `card`, `cover`, `full`) with
`f_auto,q_auto,c_limit`. Ad-hoc widths were how a free plan would spend 25
credits on transformation sprawl. Demo `/seed` paths pass through untouched.

### Capacity is documented against the vendors, not assumed

`docs/CAPACITY.md` records the verified free-tier limits, monthly usage at 500,
2,000 and 5,000 users, the first limit to break (Vercel's non-commercial Hobby
rule, then 1M invocations at ~1,700 monthly actives), upgrade triggers, the
degradation ladder and where to monitor each service.

## Reposts and drafts (November 2026)

### A plain repost is a profile record, not a post

`Post` keeps its dual role for quotes, but every `REPOST` row now carries a
`RepostKind`. `PLAIN` rows are profile-only: every feed, hashtag, bookmark,
search and community query excludes them, while the author's Posts tab includes
them and labels them “reposted”. A quote is a `QUOTE` row with the author's
comment and stays a real feed post that embeds the original.

The alternative — a separate `Repost` table — would have required rewriting
every existing feed, bookmark, report and moderation path at once. Keeping one
row type, with an explicit kind and query guard, preserves those paths and the
moderation record.

### One repost per user per original is a partial unique index

Two partial unique indexes enforce `(authorId, repostOfId)` for `PLAIN` and
`QUOTE` separately, ignoring soft-deleted rows. That makes undo-then-repost
possible and lets a student both repost and quote the same original. The
migration keeps the earliest duplicate per kind, soft-deletes the rest, and
recomputes `repostCount` as the count of distinct active plain reposters.
`repostCount` deliberately does **not** include quotes; quotes are separate
feed posts with their own reactions and comments.

Counters move inside the same transaction as the insert/delete. A concurrent
duplicate loses the unique race and returns the winner's id, so the counter can
never be incremented twice. Moderator removal follows the same kind split: a
removed `PLAIN` repost decrements the original's `repostCount` and leaves the
community `postCount` alone, because a plain repost never incremented it. A
removed `QUOTE` behaves like any other removed community post.

### Reposting a repost resolves to the original

Both the client and the service resolve a repost target to the root original
before checking visibility, blocks, self-repost and audience. A quote therefore
cannot be used to launder a hidden original: the embedded card is rechecked
against the viewer, and a blocked, muted, removed or deleted original renders an
unavailable state with no author or body.

### Drafts are local-first, then versioned

The composer writes to an IndexedDB `drafts` store after a 300 ms trailing
debounce. Every record is namespaced by user id, and the whole database is
deleted on logout, so a shared phone never exposes the previous student's text.
Unsent image blobs stay on the device; uploaded media are stored as references.

The server copy is a PUT upsert keyed by a device-generated `clientDraftId`
(unique per university and user). It carries a monotonic version and the device
timestamp. A lower version, or the same version with an older timestamp, gets a
409 with the current draft instead of overwriting a newer tab. The 2-second
server debounce is flushed on blur, `visibilitychange`, `pagehide` and the
`online` event with keepalive.

Limits are product decisions: 20 drafts per student, 30-day purge, 10 KB plus
media references, and 120 saves per hour. Drafts are private to the author,
tenant-scoped, cascade-deleted with the account and included in the data
export. Auto-restore only considers a draft newer than seven days for the same
composer context (`post`, `question`, `poll` or `community:<id>`).

### The e2e web server is ready when the health route answers

Playwright's `webServer` probe now waits on `/api/health` with a 300-second
budget instead of the app shell with 120 seconds. The shell probe compiled every
shared layout before replying, so a cold dev server could miss the window. The
health route compiles quickly and also proves the e2e database is migrated; the
tests themselves and their timeouts are unchanged.

### Posting is optimistic through the outbox

Every submit writes the idempotent outbox item and navigates to Pulse at once.
Pulse renders the item as “Posting…” at the top, flushes it with the original
idempotency key, then reconciles with the server. A 4xx stays in the outbox with
Retry; a successful send deletes its draft (idempotently) and the local copy.
The previous direct-POST composer is gone, so there is one path for online,
offline and retried posts.

## Migration-safe deployments (November 2026)

### The GitHub Deploy workflow is the only deploy path

Vercel's Git integration is kept connected for repository metadata and PR
comments, but automatic Git deployments are disabled with
`"git": { "deploymentEnabled": false }` in `vercel.json`. Every deployment now
goes through `.github/workflows/deploy.yml`, which runs automatically after a
successful `CI` run on `main` and can still be dispatched manually for staging.
The automatic path is guarded by `workflow_run` matching `CI`, `push`, `main`
and a successful conclusion; it checks out the exact CI commit and refuses to
deploy it if `main` has already moved on.

The order is fixed and each stage depends on the previous one: validate the
staging environment and the runtime/migration database agreement, run
`prisma migrate deploy` against the unpooled URL, deploy to Vercel, then smoke
the public staging domain. No stage uses `continue-on-error`, so a failed env
check, migration, deploy or smoke fails the workflow loudly.

This closes the race where Vercel could deploy a merge before its migration had
been applied. The cost is that a Vercel dashboard Git push no longer deploys;
maintainers must use the workflow, including for rollbacks that need a deploy.

### Migrations expand first and contract in a later release

A migration that ships with application code must be compatible with both the
old and new application versions while the rollout is in progress. Additive
changes (new nullable columns, new tables, new indexes, defaults, backfills)
ship first. Destructive changes wait for a later release, after the previous
application version no longer reads or writes the affected shape:

- drops of tables, columns, indexes, types, constraints or other objects
- renames of tables, columns, indexes or types
- `NOT NULL` added without a default
- `SET NOT NULL` on an existing column (a default does not backfill old rows)

The contract migration is its own reviewed change. This costs an extra release
for a rename or drop, but it prevents a deploy from breaking requests that are
still served by the previous version.

### Destructive DDL needs a reviewed annotation

`npm run lint:migrations` runs in CI before `prisma migrate deploy`. It fails a
migration that contains destructive DDL unless the migration carries:

```sql
-- migration-safety: destructive-approved: <why this is safe now, with review reference>
```

The annotation must include a reason; a bare marker is rejected. Adding it is a
deliberate exception reviewed with the migration, not a way to silence the
check. Migrations that predate this policy are frozen by SHA-256 in
`scripts/migration-lint-baseline.json`; editing one fails the lint as well as
Prisma's checksum, so history cannot be rewritten to evade the rule.

The lint also verifies that `src/lib/db/migration-manifest.json` names the
newest migration directory. That manifest is what the running build expects;
`npm run db:manifest` updates it when a migration is added.

### Health fails when the database is behind the code

`/api/health` keeps its database reachability, required-table and adapter
checks, and now compares the manifest's expected migration with the newest
successfully applied row in `_prisma_migrations`. A mismatch returns `503` and
reports `migrationReady: false` with the expected and applied names (never
credentials). This makes the smoke test fail when `migrate deploy` did not run,
ran against another database, or left the schema behind, instead of shipping a
deployment that only fails on its first request.
