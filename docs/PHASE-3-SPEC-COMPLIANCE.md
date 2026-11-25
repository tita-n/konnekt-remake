# Phase 3 spec compliance

Audited against the Phase 3 brief. Status values: **IMPLEMENTED**, **PARTIAL**, **MISSING**.
The attack audit lives in `docs/PHASE-3-ATTACK-SURFACE.md`; decisions that differ
from the literal brief are recorded in `docs/DECISIONS.md`.

## Section 2 — Events

| Requirement | Status | Evidence / note |
| --- | --- | --- |
| Events are free; no payment code or paywall | IMPLEMENTED | No payment imports, routes, models or secrets. RSVP never reads a price. |
| Browse For you / This week / Calendar | IMPLEMENTED | `/events` segmented views, category chips, month grid with event dots, per-day filter. |
| Event cards: cover or clay default, date block, title, organiser, venue, avatar stack with +N, RSVP stub | IMPLEMENTED | `src/components/events/event-card.tsx`; avatar stack is only opted-in going students, never waitlist. |
| Event detail: description, host, date/time, venue/map, capacity, attendees, updates, comments | IMPLEMENTED | `/events/[id]`; map link uses campus place coordinates. |
| Create event: title, description, category, audience, start/end, venue, capacity, waitlist, check-in, sharing | IMPLEMENTED | `/events/new`, `EventForm`, all fields validated server-side. |
| Cover photo upload | IMPLEMENTED | Reuses the existing compressed image upload pipeline; stored as `coverPublicId`. |
| Edit event; material changes show “Updated” with log | IMPLEMENTED | PATCH only while scheduled; `materialChanges` append-only log rendered on detail and dashboard. |
| Cancel event with reason; tickets revoked; counts frozen | IMPLEMENTED | `/api/events/[id]/cancel`; status and ticket revocation in one transaction. |
| RSVP Going / Interested / cancel | IMPLEMENTED | Detail actions; idempotent upserts; interested never consumes capacity. |
| Capacity + waitlist, automatic promotion in order | IMPLEMENTED | Conditional counter claim; FIFO `waitlistPosition`; integration concurrency test. |
| QR ticket, single-use check-in, scanner | IMPLEMENTED | Hashed ticket, `/ticket`, `/scan`, camera BarcodeDetector + manual code + name search. |
| Ticket lost → regenerate, old code revoked | IMPLEMENTED | `regenerateTicket` revokes prior active ticket; partial unique index. |
| Attendee list (organiser/host), CSV export, privacy | IMPLEMENTED | Name/username/department/level/status only; hidden attendance omitted from public previews; CSV escaped. |
| Event staff: host and check-in roles, max 6 | IMPLEMENTED | Staff sheet on dashboard, verified students only, server permission checks. |
| My Events: going/interested/waitlisted/past, .ics export | IMPLEMENTED | `/events/mine`, `/api/events/ics`; one .ics per event too. |
| Share sheet with copy link, .ics, public preview toggle | IMPLEMENTED | PUBLIC + toggle only; generic card otherwise; OG image route. |
| Organiser dashboard: views, RSVPs, waitlist, check-in rate, 14-day trend, attendees, export, updates, staff, change log | IMPLEMENTED | `/events/[id]/dashboard`. |
| Venue can be a campus place managed by admin | IMPLEMENTED | `/admin/places`; place picker in composer; legacy free-text venue retained. |
| UTC storage + university timezone display, DST-safe .ics | IMPLEMENTED | `event-time.ts`/`event-display.ts`; all writes ISO UTC, display/input use `University.timezone`; unit tests cover Lagos conversion. |
| Creation limits: 24h account age, 3/day, 10 upcoming | IMPLEMENTED | Enforced in `createEvent` with 403/429 and unit-tested rules. |
| Audience immutability: never widen to people who could not see it | IMPLEMENTED | Original audience retained; community events are always community-only; domain tests. |
| Hidden and nonexistent events identical | IMPLEMENTED | Both return `This event isn't available.` 404; integration test compares them. |
| Attendance privacy | IMPLEMENTED | Public preview only opted-in avatars; hidden count; waitlist never exposed; settings toggle. |

## Section 3 — Official accounts and announcements

| Requirement | Status | Evidence / note |
| --- | --- | --- |
| Admins create/manage official accounts | IMPLEMENTED | `/admin/official`; name/slug normalization, suspend/reactivate, audit. |
| Official staff can post only announcements/events | IMPLEMENTED | `OFFICIAL_ALLOWED_CONTENT`; no post-authoring path for official accounts; server re-checks staff on every write. |
| Announcement feed with brand avatar, category, title, excerpt, time, critical label, edited tag | IMPLEMENTED | `/official`, `AnnouncementCard`; “Edited” appears when `editedAt` is set. |
| Detail with full body and PDF attachments | IMPLEMENTED | `/official/a/[id]`; attachments private, access-checked, signed short-lived. |
| Compose: title, body, category, audience, attachments, critical, schedule | IMPLEMENTED | `/official/compose`; up to 3 PDFs/10 MB; schedule up to 30 days; draft support. |
| Critical banners persist until acknowledged; max 2/day/account | IMPLEMENTED | `CriticalBanner` on Pulse and official channel; server rate limit; ack stored once/user. |
| Normal announcements show a single banner until read | IMPLEMENTED | `OfficialBanner`; read = acknowledgement. |
| Acknowledge-only, no reactions/comments | IMPLEMENTED | No comment/reaction models or endpoints for announcements. |
| Schedule up to 30 days; publish idempotently via cron + lazy publish | IMPLEMENTED | `/api/cron/announcements` with constant-time secret; per-row conditional claim; integration test. |
| Archive announcements | IMPLEMENTED | Admin console and PATCH `archive`; archived notices drop out of student feeds. |
| Audience targeting follows university/academic path | IMPLEMENTED | Domain `announcementAudienceIsAllowed`; staff limited to own path or PUBLIC; admins may target any node in their university. |
| Edited tag | IMPLEMENTED | `editedAt` set on material edits. |

## Section 6 — Security and privacy

| Requirement | Status | Evidence / note |
| --- | --- | --- |
| Tenant isolation for every Phase 3 read/write | IMPLEMENTED | `tenantDb` in every service; integration isolation test. |
| Server-enforced permissions (organiser, staff, official, moderator) | IMPLEMENTED | Pure permission matrices; handlers re-load actor context; no client role trust. |
| CSRF and same-origin protection on mutations | IMPLEMENTED | `socialApi(..., { mutation: true })` + CSRF header on all mutating routes. |
| Rate limits on creation, RSVP, comments, ticket regeneration, check-in, export, critical notices | IMPLEMENTED | Policies in `rate-limit.ts`; integration concurrency does not rely on limits. |
| No secrets to the client; ticket codes hashed at rest | IMPLEMENTED | 128-bit code returned once; SHA-256 stored; attachment URLs signed. |
| XSS-safe rendering | IMPLEMENTED | React text rendering only; no raw HTML in Phase 3. |
| CSV injection defence | IMPLEMENTED | Leading `= + - @ tab CR` neutralised and every cell quoted. |
| Audit rows for moderation, staff, check-in, export, scheduled publish | IMPLEMENTED | `writeAudit` in each service path. |
| Public share leaks no private metadata | IMPLEMENTED | Generic HTML + OG card; integration field test. |
| No real service secrets in the repo | IMPLEMENTED | `.env` only; demo password is documented seed data. |

## Section 7 — Accessibility, states and performance

| Requirement | Status | Evidence / note |
| --- | --- | --- |
| Keyboard and screen-reader semantics for new controls | IMPLEMENTED | Real buttons/links, labels, `aria-pressed`, `aria-current`, progressbar semantics, dialog labels. |
| Contrast in light and dark themes | IMPLEMENTED | Token-based; axe checks on events hub and admin console are part of `e2e/events.spec.ts`. |
| Loading / empty / error / offline / locked states | IMPLEMENTED | Skeletons, `EmptyState`, `ErrorState`, offline Pulse banner, locked community/ticket states. |
| Reduced motion and safe areas | IMPLEMENTED | Existing global rules; floating create button respects safe-area inset. |
| Visual review of new screens | IMPLEMENTED | Mobile + desktop, light + dark screenshots for the events hub, event detail and official channel are in `design/review/`; two issues (wrapped My Events button, cramped map link) were found and fixed. Ticket, scanner and dashboard states were exercised in E2E rather than captured. |
| Bundle budget not regressed | IMPLEMENTED | Shared JS stays 104 kB and middleware 34.1 kB; event routes add page-specific chunks. Recorded in `docs/PERFORMANCE.md`. |

## Deliberately out of scope

Payments, recurring events, chat, push/notifications, following, DMs, Campus
Voice, video, marketplace and extra calendar sync were not built.
