# Decisions

Short records of choices made while building that were not fixed by the product
brief. Format: what we chose, why, and what it costs us.

## Phase 2 communities

### Counters move only when a membership row changes

`memberCount` is updated in the same transaction as the membership write, and
the increment/decrement is skipped when the conditional write affected zero
rows. This makes duplicate joins, racing joins and repeated leaves idempotent
without a lock. Cost: the count can still drift if a row is edited outside the
service layer, so membership writes must stay in `communities.ts`.

### Invite acceptance claims a use optimistically

Accepting an invite issues a conditional `updateMany` on
`{ status: ACTIVE, uses: <observed> }`. A loser of the race gets 410 rather than
overrunning `maxUses`. Cost: a user can see "invite expired" when it was in fact
just exhausted, which is the honest outcome anyway.

### Community slugs are stable

The slug is derived from the name once and only regenerated when the normalised
name changes. Changing the description, privacy or icon leaves the URL alone.
Cost: renaming still breaks old links; redirects are out of scope for Phase 2.

### Tenant extension expands compound unique keys

`tenantDb` rewrites `findUnique`/`upsert` keys such as `universityId_tag` to the
matching `where` clauses instead of requiring every caller to hand-build them.
Cost: the extension has a small list of known compound keys to maintain.

### Hashtag search uses the post visibility predicate

Tag counts are filtered by `visiblePostsWhere` plus readable community ids, so
a tag that only exists inside an invite-only community is invisible to
outsiders rather than merely unclickable.

### Signed resource links use Cloudinary private downloads

`cloudinary.url` accepts `expires_at` but does not enforce it. We switched to
`private_download_url`, which produces an authenticated, attachment-only URL
whose expiry is part of the signature. Cost: links cannot be hot-linked in an
`<img>` tag; they are download links by design.

### e2e runs need a reset database

Community creation is capped at three per day per user, enforced in the
database. `npm run e2e:db:reset` is required between local runs; the previous
`prepare` script only migrated and left earlier rows in place. CI already starts
from an empty database, so the floor is unchanged.

### Admin console shows human labels

Privacy and category are rendered through the same label maps as the student
UI, not raw enum values.

### Accessibility fixes belong in the components

The icon-only create link and icon file input got explicit labels, and `cn()`
now registers the custom type scale with `tailwind-merge` so colour utilities
are no longer dropped on small buttons. The Danger zone heading uses the normal
foreground colour on the soft danger surface to reach 4.5:1.

### Small doc edit

The only documentation change requested for this audit was to record the gap
check itself. It was asked for by the project owner in the task brief; no
existing document was rewritten, and no third party requested an edit.

### E2E Postgres must bind to loopback

`playwright.config.ts`/the e2e database script published port 55433 on
`0.0.0.0`. Locally it was overridden to `127.0.0.1:55433` so the database is not
reachable from the network. Follow-up: the script default should do this too.

## Open Dependabot pull requests (reviewed, not merged)

- #3 `github-actions` group — patch/minor action bumps; safe, but CI-only.
- #4 `production-deps` group — minor version bumps; needs a build + e2e run.
- #5 `development-deps` group — minor bumps; low risk.
- #6 `@types/node` 26.6.6 — types only, no runtime effect.
- #7 `lucide-react` 1.75.0 — icon package; MAJOR version jump, needs a visual
  pass because icon names/shapes can change.
- #8 `typescript` 7.0.2 — MAJOR compiler change; do not merge without a full
  typecheck of the repo and the Next.js plugin.

None were merged in this branch: the audit should not also move the toolchain.

## Phase 3 — Events and the Official Channel

### Two schema additions beyond the brief

- `Community.allowMemberEvents` is the server-side switch behind the requirement
  that a community may (or may not) let ordinary members create events. Without
  it the setting would have been UI-only.
- `Event.materialChanges` is an append-only JSON log of time and venue edits.
  The brief requires an “Updated” state that tells attendees what changed; a
  single timestamp cannot do that without a second table.
- `University.timezone`, `User.showEventAttendance` and the Phase 3 enums/models
  are additive. All migrations are forward-only and were applied with
  `prisma migrate diff` because `migrate dev` cannot create a shadow database in
  this sandbox.

### Visibility stays in the domain layer

`canSeeEvent`, `audienceIsOnViewerPath`, `organizerAudienceIsValid`,
`canSeeAnnouncement` and `eventPermissions` are pure functions. Feeds, detail
pages, share cards, .ics files, attendee lists and mutations all call them, so a
hidden event and a missing event produce the same 404 and the same generic share
card.

### Tickets are hashes, not codes

The database stores only `SHA-256(code)`; the raw 128-bit code is returned once
when a ticket is generated and is never recoverable from the server. A partial
unique index (`EventTicket_one_active_per_user`) allows history but exactly one
active code per student per event. Regenerating revokes the previous code.

### Capacity and waitlist are conditional updates

`Event.goingCount` is the counter and the conditional `updateMany` is the lock:
a going slot is claimed only when `goingCount < capacity`. Cancellation promotes
the oldest waiter with another conditional claim. The pure `goingOutcome` helper
mirrors the decision for unit tests. This avoids serializable-transaction
retries while remaining correct under concurrent RSVPs (integration test).

### Check-in is idempotent per device action

Every scan carries a client-generated `clientScanId`; `EventCheckIn` is unique
on `(eventId, clientScanId)` and on `(eventId, userId)`. A retry returns
`duplicate: true` instead of double-counting. The counter is incremented in the
same transaction as the insert.

### Scheduled announcements use per-row claims

The cron route and the lazy read-time publisher both call
`publishDueAnnouncements`, which claims each row with
`updateMany({ id, status: "SCHEDULED", publishAt: { lte: now } })`. Only one
caller can flip a row, so double firing is harmless. The cron secret is compared
in constant time and fails closed in production.

### Official accounts are separate from communities

Official accounts have their own staff table and posting rights. They may author
announcements and events, never ordinary posts. Critical rights are a per-staff
flag; university admins implicitly hold them. Staff and critical rights are
re-read on every write, never trusted from a JWT or the client.

### Phase 3 UI adds one dependency

`react-qr-code` renders the ticket QR locally; no ticket code or student data is
sent to a third party to render it. It is the only Phase 3 runtime dependency.

### Event and announcement audiences are built from the viewer’s real path

The composer derives university / college / faculty / department / level
audiences from `studentPath` and `lineage`, not from client-supplied labels. The
server re-validates the chosen prefix, so a crafted request cannot target a
different department.

### Public share cards are generic unless explicitly shared

A PUBLIC event still needs `allowOutsideSharing`. Both the HTML preview and the
OG image return a generic “something’s happening” card otherwise, with no title,
venue, counts or organiser identity.

### Official work is attributed to the account, not the staff member

Events and announcements are shown under the official account or community name.
Serializers never include the creating/posting user, even for admin lists, so a
staff member's name cannot leak through an API payload. The staff identity stays
server-side for permission checks and the audit trail.
