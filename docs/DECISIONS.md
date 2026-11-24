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
