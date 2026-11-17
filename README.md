# Konnekt — Phase 0

Konnekt is a PWA-only social network for **verified students at Nigerian universities**. Phase 0 builds the foundation: a real multi-tenant data layer, identity and verification, branded campus spaces, student profiles and settings, and the two consoles that run the network. Later-phase social features are deliberately absent; their tabs show final empty states rather than fake content.

## What is built

- **Campus spaces (multi-tenant from line one).** Every tenant-owned query goes through `tenantDb(universityId)`, a Prisma client extension that injects `universityId` into reads and writes. Cross-tenant access is covered by integration tests.
- **Signup and verification.** University picker, waitlist, student-email verification, private ID-card upload with manual review, and voucher requests. A pre-account `SignupDraft` lets proof arrive before the account exists, with a 24-hour expiry.
- **Auth.** Argon2id passwords, database-backed sessions with httpOnly/Secure/SameSite=Lax cookies, CSRF double-submit, session listing/revocation, password reset, rate limits, Turnstile, and an append-only audit log enforced by a Postgres trigger.
- **Onboarding and student app.** Academic tree selection, level, interests, branded shell, profile (own and others, privacy-aware), settings (profile, account, privacy, appearance/Data saver, data export, deletion), and legal pages.
- **University console.** Verification queue with private image access, approve/decline with reasons and notes, student management (suspend/reinstate/alumni), academic tree editor with CSV preview/import, university branding with a WCAG contrast gate, and staff invitations.
- **Platform console.** Create and switch universities on/off, phase flags, first-admin invitations, waitlist with CSV export, audit viewer, and a live system-health panel.
- **PWA.** Installable manifest, maskable icons, Serwist app-shell worker, offline fallback, install prompt after a second visit, new-version reload prompt, and online/offline banner.
- **Quality gates.** Vitest unit + integration tests, Playwright e2e with axe, strict TypeScript, ESLint, GitHub Actions, Lighthouse CI.

## Stack

Next.js 15 App Router · React 19 · TypeScript (strict) · Tailwind with CSS-variable tokens · Prisma 6 + PostgreSQL (Neon) · Zod · Resend · Cloudinary (authenticated ID assets) · Cloudflare Turnstile · Upstash Redis · Serwist · Sentry · Vitest · Playwright + axe · Lighthouse CI.

## Local setup

Requirements: Node 20.11+ (22 recommended), PostgreSQL 15+.

```bash
npm install
cp .env.example .env            # fill in DATABASE_URL and AUTH_SECRET at minimum
npm run db:migrate              # applies Prisma migrations
npm run db:seed                 # demo university, students, staff
npm run dev                     # http://localhost:3000
```

If Postgres runs locally on a non-default port, point `DATABASE_URL` at it. In development and tests every missing integration degrades safely and visibly:

| Service | Without credentials |
| --- | --- |
| Resend | Messages go to an in-process outbox, readable at `GET /api/dev/last-email` (blocked in production) |
| Cloudinary | ID images and avatars are stored in local, gitignored folders and served through the same authorised routes |
| Upstash | Rate limits fall back to in-memory counters |
| Turnstile | Set `TURNSTILE_BYPASS=1`; the widget is hidden |

All demo accounts use the password `KonnektDemo123!`:

| Account | Role |
| --- | --- |
| `admin@konnekt.ng` | Platform admin |
| `admin@demo.edu.ng` | University admin (Demo University) |
| `reviewer@demo.edu.ng` | Reviewer (verification queue only) |
| `courserep@demo.edu.ng` | Official (can vouch) |
| `student@demo.edu.ng` | Verified student, 300L Computer Science |
| `pending@demo.edu.ng` | Account with a request in review |
| `rejected@demo.edu.ng` | Declined verification |
| `suspended@demo.edu.ng` | Suspended account |
| `alumni@demo.edu.ng` | Alumni |

Demo University: slug `demo-university`, accent `#147A57`, matric pattern `^[A-Z]{2,4}/\d{4}/\d{3,4}$`, student domains `student.demo.edu.ng` and `demo.edu.ng`.

## Scripts

| Command | Purpose |
| --- | --- |
| `npm run dev` | Development server |
| `npm run build` / `npm start` | Production build and server |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | Next/ESLint (includes the tenant-import boundary rule) |
| `npm test` | Vitest unit tests |
| `npm run test:integration` | Vitest against `konnekt_test` (set `TEST_DATABASE_URL`) |
| `npm run test:e2e` | Playwright + axe (starts the dev server) |
| `npm run db:migrate` / `db:deploy` / `db:seed` | Prisma workflows |
| `npm run icons` | Regenerate PWA icons from the flat mark |
| `npm run lighthouse` | Lighthouse CI against `LHCI_URL` or `http://localhost:3100` |

Integration tests need a migrated test database:

```bash
createdb konnekt_test
DATABASE_URL=postgresql://postgres@127.0.0.1:5432/konnekt_test npx prisma migrate deploy
npm run test:integration
```

## Verification (local run)

- `tsc --noEmit`: clean.
- `next build`: production build succeeds; `/sw.js` is emitted.
- Unit: 16 passed. Integration: 11 passed (tenant isolation, DB constraints, append-only audit, verification decisions, invitations).
- Playwright: 12 passed (student shell, profile/settings, admin queue + private image, role boundaries, platform creation/audit/export, axe scans).
- Chrome installability: no installability errors and no manifest errors; service worker active and controlling; app-shell caches populate.
- Lighthouse 12 (production build, local): **Performance 97, Accessibility 100, Best Practices 100, SEO 90**. Lighthouse 12 removed the PWA category; installability is verified through DevTools’ installability checks instead (see above).

## Deploy

The app targets Vercel + Neon. `.github/workflows/deploy.yml` is manual and expects the full secret set; it applies `prisma migrate deploy` using the unpooled Neon URL before building and deploying. Phase 0 was developed without deployment credentials, so no staging URL is attached — see **Limitations** in `DECISIONS.md`.

## Documentation

- [`DECISIONS.md`](./DECISIONS.md) — product, security and design decisions, including deviations.
- [`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md) — request flow, data tenancy, auth, media, PWA.
- [`docs/ENV.md`](./docs/ENV.md) — every environment variable and production requirements.

## Phase boundaries

Not built, by design: posts, feed, communities, events, messaging, Campus Voice, push notifications and marketplace. Pulse, Communities, Events and Inbox are final empty states; the Create sheet marks every option “Coming soon”; the API and data model expose no placeholder endpoints for them.
