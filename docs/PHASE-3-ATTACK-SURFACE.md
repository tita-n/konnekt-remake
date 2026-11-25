# Phase 3 attack surface — Events and the Official Channel

Scope: every Phase 3 HTTP handler under `src/app/api/events`, `src/app/api/announcements`, `src/app/api/official`, `src/app/api/admin/{events,campus-places,official-accounts,announcements}` and `src/app/api/cron/announcements`, plus the public share routes `/e/[id]` and `/e/[id]/opengraph-image`.

## Endpoint, permission and test table

Legend: **S** verified student, **O** organiser / official staff with posting rights, **H** event host, **C** check-in staff, **M** university moderator/admin, **P** platform admin, **–** logged out.

| Endpoint | Method | Who | Permission / limit | Primary tests |
| --- | --- | --- | --- | --- |
| `/api/events` | GET | S | Tenant-bound visibility; category/tab filters; pagination | unit visibility; integration isolation |
| `/api/events` | POST | S | ≥24h account, 3/day, ≤10 upcoming, own-path audience, community/official organiser re-checked | unit creation rules; event service |
| `/api/events/[id]` | GET | S | Hidden and missing share one 404; view recorded once/day | integration isolation |
| `/api/events/[id]` | PATCH | O/H | Edit only while scheduled; material changes appended; audience may not widen | unit permissions; service |
| `/api/events/[id]/cancel` | POST | O/H/M | Reason required; revokes tickets; counts frozen | unit permissions; service |
| `/api/events/[id]/rsvp` | POST | S | Visible event, open RSVP, one RSVP/user, capacity claimed atomically, waitlist FIFO | integration concurrency |
| `/api/events/[id]/rsvp` | DELETE | S | Own RSVP only; promotion exactly once | integration promotion |
| `/api/events/[id]/ticket` | GET | S | Own ticket presence only; never returns the code | integration ticket |
| `/api/events/[id]/ticket` | POST | S | Going only; revokes prior active ticket; single active index; 5/day | integration ticket |
| `/api/events/[id]/checkin` | POST | O/H/C | Check-in window, scheduled event, hashed code, idempotent `clientScanId`, one check-in/user, rate-limited | integration check-in |
| `/api/events/[id]/checkin/search` | GET | O/H/C | Attendee search, no phone/email, tenant-bound | service review |
| `/api/events/[id]/attendees` | GET | O/H/M | Attendee privacy fields only; search and status | service review |
| `/api/events/[id]/attendees/export` | GET | O/H | 3/day, audit row, CSV formula neutralised | service review |
| `/api/events/[id]/comments` | POST | S | Visible event, 10/day, sanitised text, reportable | service review |
| `/api/events/[id]/updates` | POST | O/H/C | 20/day, attendee-visible log | service review |
| `/api/events/[id]/staff` | GET/POST/DELETE | O | Max 6, verified students only, audit | service review |
| `/api/events/[id]/staff/search` | GET | O | Verified students, 2-char minimum | service review |
| `/api/events/mine` | GET | S | Own RSVPs only | integration privacy |
| `/api/events/ics` | GET | S | Own visible events only; no attendee data | unit ICS |
| `/api/events/[id]/ics` | GET | S | Visible event only | unit ICS |
| `/api/events/[id]/share` | POST | O | PUBLIC + explicit toggle only | integration public preview |
| `/api/announcements` | GET | S | Audience-filtered published only; unread filter | unit announcements |
| `/api/announcements/banners` | GET | S | Critical first, then latest unacked, audience-filtered | unit announcements |
| `/api/announcements/[id]` | GET | S | Published + in-audience or 404 | unit announcements |
| `/api/announcements/[id]` | PATCH | O/M | Posting rights, audience rules, edited tag, archive | service review |
| `/api/announcements/[id]/ack` | POST | S | Own ack, idempotent, 60/min | integration/service |
| `/api/announcements/[id]/attachments/[attachmentId]` | GET | S | Visible announcement, access check, short-lived signed URL | unit resource URL |
| `/api/announcements/attachments` | POST | O | PDF only, 10 MB, official posting rights | unit attachments |
| `/api/official/[slug]/announcements` | GET/POST | S/O | Feed by audience; critical ≤2/day/account; schedule ≤30 days | unit announcements |
| `/api/official/[slug]` | GET | S | Active account only | service review |
| `/api/profile/events-privacy` | POST | S | Own toggle only | service review |
| `/api/admin/events` | GET | M | Tenant-bound moderation queue | integration/service |
| `/api/admin/events/[id]/moderate` | POST | M | Remove/restore only, audit | unit permissions |
| `/api/admin/campus-places` | GET/POST | M (admin) | Name validation, coordinates range | service review |
| `/api/admin/campus-places/[id]` | PATCH/DELETE | M (admin) | Deactivate when events reference it | service review |
| `/api/admin/official-accounts` | GET/POST | M (admin) | Name/slug reserved checks, audit | unit official |
| `/api/admin/official-accounts/[id]` | PATCH | M (admin) | Suspend/reactivate, audit | service review |
| `/api/admin/official-accounts/[id]/staff` | GET/POST | M (admin) | Max 12, verified students, critical flag | service review |
| `/api/admin/official-accounts/[id]/staff/[userId]` | DELETE | M (admin) | Audit | service review |
| `/api/admin/announcements` | GET | M | Tenant-wide admin list with ack counts | service review |
| `/api/cron/announcements` | GET/POST | secret | Constant-time secret compare; per-row claim | integration idempotency |
| `/e/[id]` | GET | – | PUBLIC + share toggle + scheduled only; generic otherwise | integration public preview |
| `/e/[id]/opengraph-image` | GET | – | Same gate; generic card otherwise | integration public preview |

## Active attack audit

Each line names the attack, the mitigation in code, and where it is exercised.

1. **Cross-tenant IDOR** — every service starts from `tenantDb(viewer.universityId)`; `Event`, `Announcement`, `EventRsvp`, `EventTicket` and `EventCheckIn` carry `universityId` and the tenant client refuses foreign writes. Verified in `tests/integration/events.test.ts` ("never serves another university's event") and `tenant-isolation.test.ts`.
2. **Audience escalation** — `canSeeEvent`, `audienceIsOnViewerPath`, `organizerAudienceIsValid` and `canSeeAnnouncement` are the only visibility decisions; `getEventDetail` returns the same 404 for hidden and nonexistent rows. Covered by the hidden/missing integration test and unit visibility tests.
3. **Audience widening on edit** — `updateEvent` keeps the original audience unless the caller is allowed to choose a new one, and the UI never offers it for community events. Event `materialChanges` records time/venue edits only.
4. **Private event leak through sharing** — `getPublicEventPreview` requires `PUBLIC`, `allowOutsideSharing` and `SCHEDULED`; it returns only title, times, venue and university name. Both `/e/[id]` and the OG image fall back to a generic card. Integration test verifies opt-in and field absence.
5. **Attendee enumeration** — public detail exposes at most 5 opted-in going avatars and a hidden count; waitlist identities are never exposed. Integration test proves a hidden RSVP is absent from the preview.
6. **Ticket brute force / theft** — 128-bit opaque code, SHA-256 at rest, constant-time compare, one active ticket per user via partial unique index, regeneration revokes the old code, 5 regenerations/day. Integration test proves old code rejection and new code success.
7. **Check-in replay and races** — client-generated scan id is unique per event, `EventCheckIn` has a unique `(eventId,userId)`, the insert race is caught and returned as a duplicate, and the check-in counter increments only on a new row. Integration test verifies the second scan is a duplicate and `checkedInCount` stays 1.
8. **Waitlist/oversell race** — going slots are claimed with conditional `updateMany` (`goingCount < capacity`); cancellation promotes exactly one waiter with a conditional claim. Integration test runs three concurrent RSVPs into two seats.
9. **CSV formula injection** — attendee cells starting with `= + - @ tab CR` are prefixed with `'` and every field is quoted. Export is organiser/host only, rate-limited and audited.
10. **PDF upload abuse** — attachment endpoint requires official posting rights, `application/pdf`, 10 MB max; `storeResourceFile` validates magic bytes. Attachments are served only after an announcement visibility check using a short-lived signed URL (Cloudinary authenticated raw in production, local private files in dev).
11. **Scheduled-publish double fire** — cron and lazy read-time publish both use a per-row conditional claim; the integration test runs the publisher twice and asserts one publish.
12. **Critical-notice spam** — critical flag requires `canPublishCritical`; rate limit is two per account per day; banners persist until each student acknowledges.
13. **CSRF** — all mutating handlers go through `socialApi(request, { mutation: true })` and require the double-submit header; client helpers send `x-konnekt-csrf`. Same-origin cookies remain `SameSite=Lax`.
14. **XSS** — titles, bodies, venues and comments render as text (React escaping); no `dangerouslySetInnerHTML` in Phase 3. Attachment names are rendered as text.
15. **Role escalation** — official posting rights and critical rights are re-derived from `OfficialAccountStaff` + admin role on every write; event permissions are derived by `eventPermissions`, never from the client. Admin handlers call `listCampusPlaces`/`listEventsForModeration` etc., which enforce admin/moderator roles server-side.
16. **Cron secret leakage** — constant-time SHA-256 comparison, header or query accepted, absent secret fails closed in production, responses are `no-store`.

### Findings fixed during this audit

- `eventPermissions.canCheckIn` stayed true after an event ended, which could show the scanner to staff on a past event. Fixed to require `!ended`; the service already rejected it.
- The moderation list reported RSVP count under a `removedReportCount` name. Replaced with truthful `rsvpCount` and a grouped `reportCount`.
- Client code imported report labels from a `server-only` service, which broke the production build. Labels moved to `lib/domain/moderation.ts`; the service re-exports them.
- Event serialization exposed the creating staff member for official/community events, and announcement serialization exposed the posting staff member. Both now expose only the official account or community name; the staff identity stays server-side.
- Switching from Going to Interested decremented the seat without promoting a waiter. Both cancellation and the switch now share `promoteFirstWaiter`; an integration test covers the switch.

### Residual risks accepted for Phase 3

- QR display depends on the third-party `react-qr-code` renderer; the payload is still the opaque code and no secret is embedded.
- Browser camera scanning depends on `BarcodeDetector`; unsupported browsers fall back to typing the code, so check-in never becomes impossible.
- Attachment malware scanning is out of scope; PDFs are private, access-checked and short-lived, but not content-scanned.
- Rate limiting relies on the shared limiter; in local development it uses the in-process fallback, so limits are best-effort when running multiple dev servers.
