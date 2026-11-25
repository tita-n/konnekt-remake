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

To be completed after the fixes land. The final table will use the same eight
requirements and will name the automated test proving each one.
