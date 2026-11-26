# Phase 3 gap check — events and the official channel

Date: 2026-11-25
Branch: `phase-3/gap-check`
Base: `main` at `0970078` (merge of PR #11)

This is an independent verification pass over the Phase 3 surface. Nothing in
the previous Phase 3 report is treated as proven unless it is present in code
and covered by a named automated test. This document records the BEFORE state
first, then the fixes and the AFTER evidence.

## Baseline on main

All baseline gates were green before the branch was created:

| Gate | Result |
| --- | --- |
| `npm run typecheck` | Pass |
| `npm run lint` | Pass |
| `npm run test` | 178 passed |
| `npm run test:integration` | 37 passed |
| `npm run perf:build` (production build + budget) | Pass |
| `npm run check:invariants` | Pass (24 invariants) |
| `npm run test:security` | Pass |
| `npm run audit:prod` | Pass |
| Playwright against `konnekt_e2e` | 31 passed |

## BEFORE — section 2 requirements

| # | Requirement | Status before | Evidence / gap |
| --- | --- | --- | --- |
| 1 | Offline check-in queue, visible pending/failed state, replay, idempotent `clientScanId`, deterministic duplicates, server-enforced window | **PARTIAL** | Server has a unique `(eventId, clientScanId)`, one check-in per attendee, a transactional duplicate path and a server-side `checkInWindow`. The scanner has no local queue, no pending count, no failed-scan retry and no reconnect replay. A device that loses connectivity loses the scan UI state. |
| 2 | `BarcodeDetector` plus lazy fallback decoder under 20 KB gzipped, route-only loading, manual/name fallback, denied/no-camera/low-light states, browser support docs | **PARTIAL** | `checkin-scanner.tsx` uses only native `BarcodeDetector`; unsupported browsers get a text error. Manual code and name search exist. Camera denial and unsupported-browser copy exist; low light and a real fallback decoder do not. `docs/ARCHITECTURE.md` does not document browser support. |
| 3 | Parallel-proof capacity, exactly-once/FIFO promotion under simultaneous cancels and Going→Interested switches, capacity-increase promotion, concurrent cron/read publish, regeneration races, correct counters | **PARTIAL** | Concurrent Going RSVPs are tested with `Promise.all`. A single cancel and a single switch promote correctly. Capacity increases do **not** promote waiters. There is no simultaneous-cancel/switch FIFO proof, no ticket-regeneration race test, no concurrent cron+read publish test and no acknowledgement-counter test. |
| 4 | Failing-closed tests for every Phase 3 limit: create 3/day, RSVP 60/h, scans 600/h/device, announcements 10/day/account, critical 2/day, share card 20/h, CSV 10/day, 10 upcoming | **PARTIAL** | Policy numbers exist and the in-process/Redis limiter fails closed in production. Creation/upcoming checks exist. There is no named test for the full policy matrix, ticket regeneration has **no** rate limit, and critical/announcement limiter keys include the staff user id instead of being per official account. |
| 5 | Timezone, UTC storage, crossing midnight, check-in boundaries, 14-day maximum, future start, `.ics` escaping/timezone/visibility | **PARTIAL** | Unit tests cover Lagos conversion, one check-in boundary and a basic escaped `.ics`. There is no crossing-midnight display test, no 14-day boundary test, no exact open/close boundary pair, and no integration proof that `.ics` only contains events the student can see. |
| 6 | Attendance privacy and blocks in avatar stacks, attendee lists and counts; organiser sees full list; RSVP disclosure; CSV organiser/HOST-only + audit | **PARTIAL** | Opt-in previews, hidden counts, organiser attendee list, disclosure copy, CSV role gate and audit exist. Event detail still counts blocked attendees in the student-facing count, and blocked authors' event comments/updates are not filtered. No automated block test exists for these surfaces. |
| 7 | Playwright + axe for all fourteen required flows | **MISSING** | Only three Phase 3 E2E tests exist: RSVP/QR, critical acknowledgement and admin list axe. Create/RSVP-by-another, capacity/waitlist, manual/duplicate/offline check-in, Updated/change log, cancel, community visibility, department announcement, sharing privacy, My Events/.ics, attendance privacy, staff removal and shared-phone logout are not covered end-to-end. |
| 8 | Cron constant-time secret, no failure information leak, rate limited, fail closed without secret, lazy publish; staging scheduler docs | **PARTIAL** | Constant-time hash comparison, generic 401, production fail-closed and lazy publish are implemented. The endpoint has **no rate limit**, concurrent cron+read publishing has no test, and `docs/STAGING.md` has no scheduler section. |

**BEFORE counts: IMPLEMENTED 0 · PARTIAL 7 · MISSING 1.**

## BEFORE — attack-pass findings

| Finding | Severity | Status before |
| --- | --- | --- |
| Ticket regeneration has no rate limit despite the attack table claiming 5/day | Medium | Open |
| Cron endpoint has no rate limit | Medium | Open |
| Waiters are not promoted when capacity is increased | High | Open |
| Student-facing event count includes blocked attendees; blocked comments/updates remain visible | High | Open |
| Announcement/critical limiter keys are per staff member, not per official account | Medium | Open |
| Ticket regeneration races can return a P2002 instead of converging to one active ticket | Medium | Open |
| Admin announcement payload contains a meaningless `goingCount: 0` | Low | Open |
| No test for attachment expiry/tamper on the announcement path | Medium | Untested |

## AFTER — fixes and evidence

**AFTER counts: IMPLEMENTED 8 · PARTIAL 0 · MISSING 0.**

| # | Requirement | Status after | Named evidence |
| --- | --- | --- | --- |
| 1 | Offline queue, pending/failed state, replay, idempotent scans, server window | **IMPLEMENTED** | `e2e/events.spec.ts` › “the scanner checks in once, reports duplicates and replays an offline scan”; `tests/integration/events.test.ts` › “issues a ticket once, revokes on regeneration and makes scans idempotent”; “rejects check-in before the two-hour window”. The queue lives in the existing `konnekt-offline` database (version 2, `checkins` store), and logout still deletes it. |
| 2 | `BarcodeDetector` + lazy fallback <20 KB, route-only, manual/name, denied/no-camera/low-light, browser docs | **IMPLEMENTED** | `checkin-scanner.tsx` dynamically imports `qr/decode.js` only after the camera starts; esbuild minified/browser ESM bundle measured **16,932 bytes gzipped**. Camera denial, missing camera and low-light hints have explicit copy. Browser support is documented in `docs/ARCHITECTURE.md`; the offline and camera states were screenshotted. |
| 3 | Parallel capacity, FIFO, cancel/switch, capacity increase, concurrent publish, regeneration races, counters | **IMPLEMENTED** | `tests/integration/events.test.ts` › “never oversells under concurrent RSVPs and promotes exactly one waiter”; “promotes every waiter freed by simultaneous cancellation and Going-to-Interested switch”; “promotes waiters when the organiser raises capacity”; “converges to exactly one active ticket under simultaneous regeneration”; “publishes and acknowledges exactly once under parallel cron and reads”. Capacity changes are transactional and promotion claims a real seat conditionally. |
| 4 | Failing-closed tests for every Phase 3 limit, including 10 upcoming | **IMPLEMENTED** | `tests/integration/events.test.ts` › “enforces every Phase 3 rate limit policy” pins create 3/day, RSVP 60/h, scans 600/h, CSV 10/day, share 20/h, regeneration 5/day, announcement 10/day/account, critical 2/day/account and cron 30/10 min. › “refuses an eleventh upcoming event for the same organiser”. `tests/unit/security-fallbacks.test.ts` proves the production limiter fails closed, and `tests/unit/cron-announcements.test.ts` proves the cron route is rate limited before auth. Announcement keys are per account and ticket regeneration now has a policy. |
| 5 | Timezone/midnight/boundaries/14-day/future/.ics escaping/visibility | **IMPLEMENTED** | `tests/unit/events.test.ts` › “formats events that cross midnight with both local dates”; “opens check-in exactly two hours before and closes exactly at the end”; “allows exactly 14 days, rejects longer events and past starts”; the escaped `.ics` unit test. `tests/integration/events.test.ts` › “exports only events the student can currently see to the calendar” and E2E “My Events lists RSVPs and exports a valid .ics with only visible events”. |
| 6 | Attendance privacy and blocks in stacks/lists/counts, organiser full list, disclosure, CSV role + audit | **IMPLEMENTED** | `tests/integration/events.test.ts` › “removes blocked students from event counts, comments and updates but keeps the organiser list complete” and “does not leak attendee identity when a student hides attendance”. E2E “hiding attendance removes a student from another student's attendee preview”. Existing hidden-count, disclosure and CSV audit tests remain green. |
| 7 | Playwright + axe for all fourteen required flows | **IMPLEMENTED** | `e2e/events.spec.ts` now has 14 tests covering: find/RSVP/QR; critical acknowledgement; admin list + axe; create + second-student RSVP; capacity/waitlist promotion; manual/duplicate/offline check-in; updated change log + cancellation; community visibility; departmental announcement; private share card; My Events/.ics; attendance privacy; staff add/remove; shared-phone logout. The existing axe checks on hub/admin remain. |
| 8 | Cron constant-time secret, no information leak, rate limited, fail closed, lazy publish, staging docs | **IMPLEMENTED** | `tests/unit/cron-announcements.test.ts` covers missing secret in production, wrong bearer/query secret and rate limiting before the secret is read. `tests/integration/events.test.ts` covers six concurrent publishers and four concurrent acknowledgements. `docs/STAGING.md` §10 documents the scheduler, `ANNOUNCEMENT_CRON_SECRET`, call shape, limits and lazy fallback. |

## Attack findings — resolved

| Finding | Status after | Evidence |
| --- | --- | --- |
| Ticket regeneration had no rate limit | **Fixed** | 5/day policy + policy-matrix test. |
| Cron endpoint had no rate limit | **Fixed** | 30/10 min per caller, enforced before the secret check; unit test proves the flood is rejected before the database. |
| Waiters were not promoted on capacity increase | **Fixed** | Transactional capacity update + promotion; named integration test. |
| Blocked attendees counted and blocked comments/updates visible | **Fixed** | Visibility filtering in `getEventDetail`; block integration test. |
| Announcement/critical limiter keyed per staff member | **Fixed** | Keyed by official account; matrix pins limits. |
| Ticket regeneration races raised P2002 | **Fixed** | Bounded retry/revoke loop; simultaneous-regeneration integration test. |
| Admin announcement payload had bogus `goingCount: 0` | **Fixed** | Field removed from the admin payload and type. |
| Attachment access/expiry/tamper untested | **Fixed** | Audience recheck integration test + existing signed-URL expiry/tamper unit tests. |
| Staff search crashed the dashboard (`{candidates}` vs array) | **Fixed** | Correct response typing; staff add/remove E2E. |
| Mobile form action bar sat under the bottom nav | **Fixed** | Inline action bar on mobile, fixed only on desktop; E2E create flow and screenshots. |
| Small icon buttons clipped their labels | **Fixed** | Inner label span is an inline flex row; organiser/admin screenshots recaptured. |

## Screenshots

`npm run shots` now covers the Phase 3 product surface. `SHOTS_ONLY=...` produced
**56 Phase 3 PNGs** in `design/review/` across light/dark and 390×844/1440×900:
events hub, upcoming/live/full/past/cancelled/updated/departmental details,
RSVP confirmation, waitlist confirmation, share sheet, create/edit forms,
organiser dashboard, scanner, offline queue, ticket/generated QR, My Events,
official channel, announcement detail, admin events and admin official accounts.
The review fixed the mobile action bar/nav overlap, clipped icon-button labels
and the staff-search crash; all Phase 3 screenshots were recaptured afterwards.

## Final verification

| Gate | Result |
| --- | --- |
| `npm run typecheck` | Pass |
| `npm run lint` | Pass |
| `npm test` | 184 passed |
| `npm run test:integration` | 46 passed |
| Playwright Events spec | 14 passed |
| Playwright full suite | 42 passed |
| `npm run perf:build` | Pass (shared JS 104 kB, middleware 34.1 kB) |
| `npm run test:security` | Pass |
| `npm run audit:prod` | Pass |
| `npm run check:invariants` | Pass (30 invariants) |
| `npm run check:no-mock-db` | Pass |
| `npm run shots` | 56 Phase 3 screenshots captured and reviewed |
