# Phase 2 gap check — communities vertical

Date: 2026-11-24
Branch: `phase-2/gap-check`

This document records an independent audit of the Phase 2 community surface
against the product brief, what was missing or only partially wired, and the
evidence collected while closing the gaps. It intentionally does not describe
Phase 3 work.

## How the community domain is put together

Communities are an ordinary tenant-scoped feature that borrows a few of the
academic rules. Every row that belongs to a university (directly or through a
parent) is reached through `tenantDb(...)`, a Prisma client extension that
injects the active `universityId` into reads and writes and refuses to update
or delete a row owned by somebody else. The extension also expands compound
unique keys such as `universityId_tag` so service code can upsert by a natural
key without spelling out the tenant column each time.

The rule layer lives under `src/lib/domain/`. `community.ts` owns naming,
lookalike detection, visibility decisions and the join-state machine;
`community-invite.ts` owns token creation, hashing, expiry and use limits;
`community-permissions.ts` holds the action matrix. These are pure functions so
the matrices can be tested at every cell without a database.

`src/lib/services/communities.ts` is the only place that writes membership:
join, leave, invite acceptance, join-request decisions, bans and ownership
transfer. It keeps the denormalised `memberCount` in step with membership rows
in the same transaction and uses conditional updates rather than read-then-write
so concurrent requests cannot double count. `src/lib/services/posts.ts` applies
the same visibility predicate to community feeds, hashtags and search results,
which is what keeps invite-only content out of every discovery surface.

The UI is the App Router plus server actions: `/communities` (discovery and the
viewer's hub), `/communities/new`, `/c/[slug]` (about, posts, resources,
members, settings), `/c/[slug]?invite=...` (invite landing) and
`/admin/communities` for university staff. Client components only handle local
state; every privileged mutation goes back through an action that re-checks the
permission matrix server-side.

## Audit results

All fifteen areas below were found either complete or repairable in-phase; the
final column names the check that now covers the area. "Fixed" means a real
defect was found and repaired, not documented around.

| # | Area | Status | Where | Evidence |
|---|------|--------|-------|----------|
| 1 | Prisma models, tenancy and indexes | IMPLEMENTED | `prisma/schema.prisma`, `src/lib/db/tenant.ts` | `tests/integration/community-hardening.test.ts` — "never returns another university's community rows from the tenant client" |
| 2 | Creation, validation and duplicate names | IMPLEMENTED | `src/lib/services/communities.ts`, `/api/communities`, `/communities/new` | `tests/unit/community-matrices.test.ts` — name normalization, lookalikes, reserved words; `e2e/communities.spec.ts` |
| 3 | Discovery list, search, filters and pagination | IMPLEMENTED | `listDiscoverCommunities`, `/communities` | `e2e/communities.spec.ts`; invite-only leak tests below |
| 4 | Join modes (public, request, invite-only) | IMPLEMENTED | `joinCommunity`, `/api/communities/[id]/join` | `tests/unit/community-matrices.test.ts` — join state machine; integration ban test |
| 5 | Invites: tokens, expiry, max uses, revocation | IMPLEMENTED (fixed) | `src/lib/domain/community-invite.ts`, invite accept action | `tests/unit/community-matrices.test.ts` — invite tokens; `tests/integration/community-hardening.test.ts` — "still serves members and the invite landing page" |
| 6 | Settings, rename, slug, archive and delete | IMPLEMENTED (fixed) | `updateCommunity`, `/c/[slug]/settings` | `tests/integration/community-hardening.test.ts` — "keeps the URL stable when other settings change and moves it on rename" |
| 7 | Members, roles, mute, ban and ownership transfer | IMPLEMENTED (fixed) | `src/lib/services/communities.ts`, members tab | "removes content access and blocks rejoining"; "prefers the oldest moderator, then the oldest member" |
| 8 | Feed, posts, pins and community-only visibility | IMPLEMENTED (fixed) | `getCommunityFeed`, `canSeePostInCommunity` | "keeps the post out of feeds, author pages, hashtags and search" |
| 9 | Resources and expiring download links | IMPLEMENTED (fixed) | `src/lib/media/resource-store.ts`, resources tab | `tests/unit/resource-url.test.ts` — signed URLs; `e2e/communities.spec.ts` — manage rules, invites, resources, members |
| 10 | Rules editor and member-facing rules | IMPLEMENTED | settings tab, about tab | `e2e/communities.spec.ts` |
| 11 | Moderation of community content and reports | IMPLEMENTED | reports, pins, removal services | `tests/integration/community-hardening.test.ts` — audit trail test |
| 12 | University admin console | IMPLEMENTED (fixed) | `/admin/communities`, `src/components/admin/community-console.tsx` | `e2e/a11y.spec.ts` — admin console screen; `e2e/communities.spec.ts` |
| 13 | Onboarding communities step | IMPLEMENTED | `src/components/student/onboarding-wizard.tsx` | `npm run shots` covers the step; existing onboarding e2e |
| 14 | Invite landing page and redemption | IMPLEMENTED | `/c/[slug]?invite=...` | "still serves members and the invite landing page" |
| 15 | Privacy isolation and failure modes | IMPLEMENTED (fixed) | `visiblePostsWhere`, hashtag search, tenant extension | "hides the community from every discovery surface"; `tests/integration/community-hardening.test.ts` entire `invite-only communities never leak` block |

## Defects fixed during the audit

- **Member counter races.** Join and leave used read-then-write updates.
  They now use `createMany({ skipDuplicates: true })` plus a conditional
  `updateMany`, and `memberCount` moves only when a membership row was actually
  inserted or deleted. Covers duplicate concurrent joins too.
- **Invite use limit.** Acceptance read `uses` then incremented. It now claims
  an active invite with `updateMany({ where: { status: ACTIVE, uses } })` and
  returns 410 when the claim loses the race.
- **Slug churn.** Saving settings regenerated the slug from the display name,
  so changing the description moved the URL. The slug is now recomputed only
  when the normalised name changes, excluding the community itself from the
  uniqueness lookup.
- **Tenant compound unique keys.** Upserts using `universityId_tag` failed
  because the extension did not rewrite compound keys. `expandUniqueWhere` now
  applies to `findUnique`, ownership-checked updates/deletes and upsert
  verification.
- **Hashtag search leak.** `searchHashtags` counted tags from posts the viewer
  could not see. It now filters by the same visibility predicate used by feeds.
- **Signed resource links.** `cloudinary.url` ignored `expires_at`, so links
  never expired. `signedResourceUrl` now uses `private_download_url` and signs
  an authenticated, attachment-only download.
- **Admin console labels.** Privacy and category rendered raw enum values
  (`invite_only`); they are now human-readable.
- **Colour contrast on small primary buttons.** `tailwind-merge` treated the
  custom `text-small` size as a colour and dropped `text-accent-fg`, producing
  dark text on the accent fill (2.9:1). `cn()` now registers the project's type
  scale. The Danger zone heading also moved to `text-fg` on the danger surface.
- **Accessible names.** The icon-only create link on the hub and the icon file
  input on the creation form gained labels.

## Test coverage added

- `tests/unit/community-matrices.test.ts` — visibility matrix, 27-action
  permission matrix, join states, naming/lookalikes/reserved names, invite
  tokens and expiry, ownership succession, resource link validation and
  membership statuses.
- `tests/unit/resource-url.test.ts` — signed URLs expire, signatures bind the
  expiry, local keys are refused.
- `tests/integration/community-hardening.test.ts` — tenant isolation on eight
  community tables, INVITE_ONLY non-disclosure across discover/search/page/
  feed/hashtag/bookmarks/preview/repost, ban enforcement, concurrent join/leave
  counters, audit rows per privileged action, and slug stability.
- `e2e/communities.spec.ts` — managing rules, invites, resources and members.
- `e2e/a11y.spec.ts` — axe scan of the Phase 2 screens, light and dark.

## Screens reviewed

`npm run shots` rendered every Phase 2 screen into `design/review/` (light and
dark, mobile 390×844, desktop 1440×900). The hub, settings, members, resources,
request-locked state and admin console were reviewed against
`docs/UI-CONVENTIONS.md`; no screens from the brief are missing. The regenerated
images were reviewed locally and left uncommitted to avoid binary churn from
relative timestamps.

## Known limits

- Rate limits are exercised through the existing limiter unit tests; the e2e
  suite deliberately avoids tripping the DB-backed community-creation cap, so
  integration runs must start from a reset database (`npm run e2e:db:reset`).
- Screenshot comparison is human review only; there is no pixel baseline.
