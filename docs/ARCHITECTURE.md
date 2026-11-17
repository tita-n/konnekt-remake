# Architecture

## Shape of the app

```
Browser (PWA)
  ├─ public pages      /, /login, /signup/[slug]/*, /legal/*
  ├─ student shell     /pulse, /communities, /events, /inbox, /profile/*, /settings/*
  ├─ university console /admin/*        (UNIVERSITY_ADMIN, REVIEWER)
  └─ platform console   /platform/*     (PLATFORM_ADMIN)

Next.js App Router (Node runtime on Vercel)
  ├─ Server Components  read through services; no client secrets
  ├─ Server Actions     mutations; re-check auth, tenant, CSRF-by-cookie/session action origin
  ├─ Route Handlers     uploads, private images, data export, dev email outbox, waitlist CSV
  ├─ Services           src/lib/services/*  — all business rules
  └─ Prisma             tenantDb(id) extension + platformDb (restricted)
PostgreSQL (Neon)       migrations, partial indexes, audit trigger
Cloudinary / Resend / Upstash / Turnstile / Sentry
```

The browser never receives a secret. Public IDs and signed URLs are produced after a server-side authorisation check. Client-side validation mirrors Zod schemas for feedback; the server copy is authoritative.

## Request lifecycle

1. **Middleware** generates a CSP nonce, sets the request/response CSP and security headers, and passes `x-nonce` to the app. It does **not** authenticate (sessions need the database; route layouts do that).
2. **Layout/page** calls a guard: `requireSessionUser`, `requireStudent`, `requireUniversityRole([...])`, or `requirePlatformAdmin`. Guards redirect for unauthenticated users, `notFound()` for authenticated-but-unauthorised users (so tenant cross-access is indistinguishable from absence).
3. **Service** performs the operation. Every tenant-owned query goes through `tenantDb(universityId)`. Platform operations are explicit and audited.
4. **Audit** is written for admin/security actions. For critical decisions the audit write is part of the transaction’s success path.
5. **UI** renders with the university accent injected as CSS variables (`--accent`, `--accent-fg`); tinted surfaces derive from `color-mix` per theme.

## Data tenancy

- `src/lib/db/platform.ts` is the unscoped Prisma client. Only platform-admin APIs, infrastructure, migrations and tests import it; ESLint enforces the boundary.
- `src/lib/db/tenant.ts` returns a proxy with a Prisma extension:
  - `findFirst`/`findMany`/`count`/aggregates: `AND` the tenant filter.
  - `findUnique`: resolve through the raw client with `AND`, so another tenant’s id yields `null`.
  - `update`/`delete`: verify ownership with a raw lookup, then run the unique query; the extension does not weaken Prisma’s unique-input contract.
  - `updateMany`/`deleteMany`: tenant `AND`.
  - `create`/`createMany`: inject `universityId`; reject a conflicting explicit value.
  - `upsert`: reject if the existing unique row belongs to another tenant.
  - Non-tenant models (`university`, `waitlistEntry`) throw at runtime and are absent from the type.
- `withTenantTransaction(id, fn)` runs an interactive transaction on the extended client; extension behaviour inside transactions is covered by integration tests.

Tenant models: `AcademicNode`, `User`, `RoleAssignment`, `VerificationRequest`, `EmailCode`, `Session`, `AuditLog`, `RoleInvite`. Platform-only: `University`, `WaitlistEntry`.

## Identity and verification

```
Signup
  university → method (student email | ID card | vouch)
  student email: 6-digit code hashed per email/purpose/code, 10-minute expiry, attempt limit
       ↓ verified email + password + consent → User (VERIFIED) → onboarding
  ID card: SignupDraft holds image ref + matric → account creation → PENDING
       ↓ reviewer approves → VERIFIED → onboarding
  vouch: draft selects an Official/Reviewer → request → voucher or admin decides
```

Existing accounts use the same pipeline without a draft. Verification requests are capped at 3 per 24 hours. Matric format is validated against the university pattern; approved matric numbers are unique per university by partial index. A decision deletes the image and emails the student (approved, reason, or note).

Status transitions are explicit (`src/lib/domain/status.ts`): `PENDING → VERIFIED | REJECTED`, `VERIFIED → SUSPENDED | ALUMNI`, `SUSPENDED → VERIFIED`, and so on. Illegal jumps throw before touching the database.

## Sessions and CSRF

- `konnekt_session`: 32-byte random token, httpOnly, Secure in production, SameSite=Lax, 30-day TTL. Only its SHA-256 is stored.
- `konnekt_csrf`: readable cookie containing `HMAC(AUTH_SECRET, "csrf:" + sessionToken)`. Route handlers require `x-konnekt-csrf` to equal it and the cookie. Same-origin is also checked for state-changing requests.
- `getSession()` resolves the token, loads the user with roles and university, and touches `lastSeenAt` at most hourly.
- Login, suspension, role removal, password reset and university switch-off revoke sessions. Revocation is a database update, not a cookie trick.

Rate limits use Upstash sliding windows in production, with separate policies per action and identifier/IP. Development and tests use an in-process limiter.

## Media

| Asset | Storage | Access |
| --- | --- | --- |
| ID card | Cloudinary `authenticated` (`konnekt/verification/*`) or `.private-media/` locally | `GET /api/admin/verification/[id]/image` after reviewer/admin check; 120-second signed URL or local bytes; `no-store` |
| Avatar / logo | Cloudinary public or `public/uploads/avatars/` locally | Public URL; re-encoded 512 px WebP, EXIF stripped |

`sharp` decodes and re-encodes every upload. Upload ceilings are 6 MB input / ~900 KB stored. Filenames are random; user input never becomes a path.

## PWA

- `src/app/manifest.ts` describes the installable app (`/pulse`, standalone, icons, shortcuts).
- `src/app/sw.ts` is bundled by `@serwist/next` to `/sw.js` for production only.
  - Precaches build assets and `/offline`.
  - Navigation requests use the cached page/app shell; document fallback is `/offline`.
  - `/api/*` is `NetworkOnly`.
  - `skipWaiting: false`; `PwaProvider` watches for a waiting worker and offers a reload.
- `PwaProvider` registers the worker, handles update prompts; `OfflineBanner` reflects connectivity; `InstallPrompt` appears only after a second visit and can be dismissed permanently.
- CSP excludes service-worker/manifest/static paths from nonce middleware and allows `worker-src 'self' blob:`.

## Testing

| Layer | Tool | Scope |
| --- | --- | --- |
| Unit | Vitest | matric, email domains, colour contrast, password strength, CSV parsing, status machines, slugs |
| Integration | Vitest + real Postgres | tenant isolation (reads/writes/upserts), DB constraints, audit immutability, verification decisions, invitations |
| E2E | Playwright | student shell/profile/settings, admin queue and private image, role boundaries, platform create/audit/export |
| Accessibility | axe via Playwright | public pages, student shell/settings, verification queue/detail |
| Performance | Lighthouse CI | production build: Performance ≥90, Accessibility ≥95 |

CI runs quality + integration, e2e, and Lighthouse jobs. The integration database is migrated with `prisma migrate deploy`; seeds are deterministic and idempotent.

## Failure behaviour

- Env validation fails fast at server start in production. During `next build` validation is skipped because runtime secrets are absent by definition.
- Email delivery failures are logged and surfaced where the flow can continue; verification decisions commit before email is attempted.
- Storage failures abort uploads with a generic message; no partial record is written.
- Database errors on decisions surface as “Could not save that decision” and never as success.
- Missing Upstash/Cloudinary in development degrade to in-memory/local implementations; production validation prevents that.
