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

## Limitations and open items

- **No staging deployment.** The environment had no Vercel/Neon/Resend/Cloudinary/Upstash/Sentry credentials. The deploy workflow is written and manual; apply migrations and run `deploy.yml` once secrets exist. Lighthouse and installability were verified against a local production build.
- **Lighthouse 12 has no PWA category.** Installability is asserted via Chrome DevTools’ `Page.getInstallabilityErrors` (zero errors), manifest inspection and an active controlling service worker instead of the removed category score.
- **Logo uploads are square-cropped** using the avatar pipeline. A dedicated non-square brand pipeline can come with the media phase.
- **Moderator/Official roles are modelled and grantable** but have no Phase 0 screens beyond vouching (Official). They are not fake permissions; their future capabilities are simply not built.
- **Deletion is a 30-day soft delete.** A scheduled purge job is intentionally out of Phase 0; the data model records `purgeAfter` so the job has a contract.
- **Sentry is initialised by configuration only.** Without a DSN nothing is sent; production env validation does not require it.
- **No staging deployment for Phase 1 either.** No Vercel/Neon/Resend/Cloudinary/Upstash/Turnstile/Sentry credentials were available. The production build, seed, full unit/integration/Playwright suites and local EXPLAIN plans were verified; deployment awaits secrets.
- **Post images use the same Cloudinary adapter as avatars.** Authenticated ID assets remain private; post media is public by design. A dedicated media pipeline for video or large galleries is out of Phase 1.
- **Feed performance is measured on the local 1,000-post dataset.** The plan, not an absolute latency promise, is the portable result; production p95 should be rechecked after real traffic and Neon warm-up.
