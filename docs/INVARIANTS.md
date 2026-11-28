# Invariants and their tests

`ci/invariants.json` is the machine-readable source. `npm run check:invariants` fails CI if a file disappears or a named test no longer exists.

| Invariant | Test file | Named test(s) |
| --- | --- | --- |
| Tenant isolation | `tests/integration/tenant-isolation.test.ts` | `only returns rows for the bound university`; `cannot read another university's user even with the exact id`; `refuses a write that names another university` |
| Hidden and nonexistent responses are identical | `e2e/social.spec.ts` | `level and public posts reach exactly the right students` |
| Blocks are symmetric; mutes are private | `tests/unit/posts.test.ts` | `hides content in both directions when either side blocked`; `mutes only the muter's view and never hides the author from themselves` |
| Reposts cannot widen audience | `tests/unit/posts.test.ts` | `inherits the original audience on every repost`; `keeps a community repost out of every academic audience` |
| One plain repost per user and original | `tests/integration/reposts.test.ts` | `creates exactly one repost per user under concurrent requests and counts distinct users`; `undoes exactly once and is idempotent`; `reposting a repost targets the original`; `allows one quote per user/original and puts it in the feed`; `keeps plain reposts out of the feed and shows each original once`; `keeps the earliest duplicate, soft-deletes the rest and recomputes counters` |
| Reposting cannot bypass visibility or blocks | `tests/integration/reposts.test.ts` | `cannot repost what the viewer cannot see`; `cannot reach another tenant's post through the repost endpoint`; `cannot repost a blocked author's post`; `refuses to repost your own post` |
| Moderator removal keeps repost counters correct | `tests/integration/reposts.test.ts` | `decrements a plain repost counter without changing the community post count` |
| Drafts are versioned, idempotent and private | `tests/integration/drafts.test.ts` | `is idempotent per client draft id and increments the version`; `rejects a stale version and accepts a newer one`; `returns null for another account's draft and keeps tenants apart`; `purges drafts older than 30 days`; `caps a student at 20 drafts` |
| Draft writes collapse typing bursts and order by version | `tests/unit/drafts.test.ts` | `collapses a typing burst into one trailing write`; `rejects an older version`; `at the same version, the newer device time wins` |
| Local drafts survive reload and disappear on logout | `e2e/drafts.spec.ts` | `typing then reloading restores the draft`; `offline typing syncs when the connection returns`; `logout clears local drafts on a shared phone` |
| Role boundaries | `e2e/admin.spec.ts` | `reviewer cannot reach students or team management`; `student cannot reach either console`; `platform admin creates a space and sees the audit trail` |
| Private ID images require reviewer access | `e2e/admin.spec.ts` | `admin sees the queue and a private ID image` |
| Public share preview privacy | `e2e/privacy.spec.ts` | `public share preview reveals no author, counts or metadata` |
| Service worker never caches private data | `tests/unit/service-worker.test.ts` | `forces API responses to the network and every navigation is network-only` |
| Logout clears caches, IndexedDB and storage | `e2e/social.spec.ts` | `logout clears the cached feed, cookies and IndexedDB` |
| Offline outbox publishes exactly once | `e2e/social.spec.ts` | `offline outbox publishes once after reconnect` |
| Community names normalize and reserved names stay blocked | `tests/unit/communities.test.ts` | `normalizes lookalike names before uniqueness checks`; `reserves official, university and academic names` |
| Community visibility follows privacy, archived and suspended rules | `tests/unit/communities.test.ts` | `keeps REQUEST metadata visible while its content stays member-only`; `makes INVITE_ONLY indistinguishable from a missing community to outsiders`; `keeps archived communities readable by members only` |
| Community permissions and ownership are table-driven | `tests/unit/communities.test.ts` | `enforces owner, moderator and member actions with mute and upload rules`; `chooses a moderator first and never transfers to an inactive owner` |
| Community posts never widen into academic feeds | `tests/unit/communities.test.ts` | `keeps community posts out of academic feeds and honours access` |
| Community invites are hashed and single-purpose | `tests/unit/communities.test.ts` | `stores only a hash of a high-entropy invite token` |
| Community discovery and request joins are server-authorized | `tests/integration/communities.test.ts` | `keeps invite-only communities out of discovery for outsiders`; `keeps request joins pending until a moderator approves them`; `never exposes another university's communities through the tenant client` |
| Communities always retain at least one owner | `tests/integration/communities.test.ts` | `transfers ownership and protects the last owner from leaving`; `the database refuses to remove the last owner even outside the service` |
| Invite-only communities are indistinguishable from missing ones | `e2e/communities.spec.ts` | `invite-only communities are indistinguishable from missing ones for outsiders` |

## Production hardening invariants

| Invariant | Automated check |
| --- | --- |
| Every required env variable fails closed when missing/malformed | `tests/unit/env-validation.test.ts` |
| Rate limit, storage, email and Turnstile never use fallbacks in production | `tests/unit/security-fallbacks.test.ts` |
| Session cookie is httpOnly, Secure, SameSite=Lax | `tests/unit/cookie-flags.test.ts`, plus deployed login in `scripts/smoke-staging.mjs` |
| No mock/in-memory/failover database | `scripts/check-no-mock-db.mjs` |
| Real production headers and route absence | `scripts/security-invariants.mjs` + `security/headers.snapshot.json` |
| Unreachable database fails closed | `scripts/security-invariants.mjs` |
| Demo seed refuses production | `tests/unit/part-a.test.ts` and `scripts/security-invariants.mjs` |
| Feed keeps its index scan at 1,000 posts | `tests/integration/feed-plan.test.ts` |
| E2E cannot touch the demo database | `tests/unit/e2e-guard.test.ts`, `e2e/isolation.spec.ts`, CI before/after checksum |
| Test count cannot silently drop | `ci/test-floor.json` + `scripts/check-test-floor.mjs` |
| Every production config problem is reported without printing a value | `tests/unit/part-a.test.ts` |
| Staging deploy targets the staging project's Production environment | `tests/unit/deploy-workflow.test.ts` |
| Staging bootstrap refuses production and is idempotent | `tests/integration/staging-bootstrap.test.ts` |
| UI-only branches cannot alter protected paths | `.github/ui-guard.json` + `scripts/check-ui-guard.mjs` |

### Phase 3 invariants

| Invariant | Test file | Named test(s) |
| --- | --- | --- |
| Hidden and nonexistent events are indistinguishable | `tests/integration/events.test.ts` | `gives hidden and nonexistent events the same response` |
| Event capacity never oversells and promotes exactly one waiter | `tests/integration/events.test.ts` | `never oversells under concurrent RSVPs and promotes exactly one waiter` |
| Attendance privacy holds in public previews | `tests/integration/events.test.ts` | `does not leak attendee identity when a student hides attendance` |
| Tickets are hashed, single-active and idempotent at check-in | `tests/integration/events.test.ts` | `issues a ticket once, revokes on regeneration and makes scans idempotent` |
| Public sharing requires an explicit toggle | `tests/integration/events.test.ts` | `returns no public preview until the organiser opts in` |
| Scheduled announcements publish exactly once | `tests/integration/events.test.ts` | `publishes a due announcement exactly once across repeated cron runs` |
| Event permissions and audiences are table-driven | `tests/unit/events.test.ts` | `gives the creator edit, staff and check-in rights only while bookable`; `never lets an organiser compose above their own path` |

