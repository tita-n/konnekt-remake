# Staging deployment

This is the one-time setup from empty accounts to a smoke-tested staging deployment. Nothing here asks you to paste a secret into chat or commit one. Run `npm run check:env -- staging` locally with the values in your shell before using GitHub.

## 1. Accounts to create

| Service | Plan | What to create | Values you get |
| --- | --- | --- | --- |
| **Neon** | Free/starter | One project. Create **three branches/databases**: `production`, `staging`, and `e2e`. Keep production isolated. | Pooled `DATABASE_URL`, unpooled `DIRECT_URL` for each branch |
| **Vercel** | Hobby/pro | One project linked to `tita-n/konnekt-remake`. Add the staging domain. | `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID` |
| **Resend** | Free/pro | Add and verify the sending domain (e.g. `konnekt.ng`). Create one API key. | `RESEND_API_KEY`, `EMAIL_FROM` |
| **Cloudinary** | Free/pro | One cloud. Note the cloud name, API key and secret. | `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` |
| **Upstash Redis** | Free | One Redis database in the same region as Vercel. | `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` |
| **Cloudflare Turnstile** | Free | One widget for the staging hostname; add `localhost` for local dev. | `NEXT_PUBLIC_TURNSTILE_SITE_KEY`, `TURNSTILE_SECRET_KEY` |
| **Sentry** | Free | One Next.js project. Copy the DSN. | `NEXT_PUBLIC_SENTRY_DSN`, `SENTRY_DSN` |

Use separate values for staging and production. Do not reuse the production Neon branch, Vercel project environment or Turnstile secret for e2e.

## 2. Environment variables

Every deployed server (staging and production) requires all of these. `NEXT_PUBLIC_*` values are public by design; everything else is server-only.

| Variable | Where to find it | Staging example |
| --- | --- | --- |
| `NODE_ENV` | Set by Vercel | `production` |
| `APP_URL` | Your staging URL, no trailing slash | `https://staging.konnekt.ng` |
| `DATABASE_URL` | Neon → branch → pooled connection string | `postgresql://.../konnekt?sslmode=require` |
| `DIRECT_URL` | Neon → branch → unpooled connection string | `postgresql://.../konnekt?sslmode=require` |
| `AUTH_SECRET` | `openssl rand -base64 48` | 32+ random characters |
| `SESSION_TTL_DAYS` | Choose 1–90 | `30` |
| `RESEND_API_KEY` | Resend → API Keys | `re_...` |
| `EMAIL_FROM` | Verified sender | `Konnekt <hello@konnekt.ng>` |
| `EMAIL_REDIRECT_TO` | Optional staging safety net, comma separated | your inbox |
| `CLOUDINARY_CLOUD_NAME` | Cloudinary dashboard | `konnekt-staging` |
| `CLOUDINARY_API_KEY` | Cloudinary dashboard | numeric key |
| `CLOUDINARY_API_SECRET` | Cloudinary dashboard | secret |
| `UPSTASH_REDIS_REST_URL` | Upstash → REST API | `https://...upstash.io` |
| `UPSTASH_REDIS_REST_TOKEN` | Upstash → REST API | token |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | Turnstile widget | site key |
| `TURNSTILE_SECRET_KEY` | Turnstile widget | secret key |
| `TURNSTILE_BYPASS` | Must be `0` | `0` |
| `NEXT_PUBLIC_SENTRY_DSN` | Sentry project settings | optional but recommended |
| `SENTRY_DSN` | Sentry project settings | optional but recommended |
| `SENTRY_ENVIRONMENT` | Choose a label | `staging` |
| `SEED_PLATFORM_ADMIN_EMAIL` | First platform admin for the guarded bootstrap workflow | a real inbox you control |

Never run `db:seed` against staging: it creates demo accounts and a known password. `SEED_PLATFORM_ADMIN_EMAIL` is used only by the guarded Staging bootstrap workflow, which creates one admin with no usable password and emails a reset link.

## 3. Database setup

1. In Neon, create the staging branch and copy its pooled and unpooled URLs.
2. Locally, run the migration directly against the unpooled URL:

   ```bash
   DATABASE_URL="<staging unpooled URL>" npx prisma migrate deploy
   ```

3. Do **not** run `npm run db:seed`; the seed guard refuses production but there is no reason to put demo accounts in staging.
4. Create a test account through the real signup flow for the smoke login, or leave `SMOKE_TEST_EMAIL` empty and the smoke test will skip only the login section.

The e2e database is separate. For a Neon e2e branch, set `E2E_DATABASE_URL` to a branch/database ending in `_e2e`, set `E2E_ALLOW_REMOTE=1`, and run `npm run e2e:db:prepare`.

## 4. Vercel project settings

- Framework preset: **Next.js**.
- Root directory: repository root.
- Node.js: **22.x**.
- Build command: `npm run build`.
- Install command: `npm ci`.
- Production branch: `main`.
- **This repository's `konnekt-remake` project is the staging project.** Its
  Vercel **Production** environment is staging, and `konnekt-remake.vercel.app`
  is that environment. Do not add real production tenants or production secrets
  to this project.
- Put every variable above in the Vercel **Production** environment only. The
  Deploy workflow is staging-only and no longer deploys Preview.
- Set `APP_URL` to the staging origin with **no trailing slash and no quotes**.
- Disable Vercel Authentication for the staging domain, or create an automation bypass secret and store it as `VERCEL_AUTOMATION_BYPASS_SECRET`.
- Do not enable Vercel's own Cron or build cache overrides that skip `prisma generate`.

## 5. GitHub secrets

Create a GitHub **Environment** named `staging` with these secrets. This repository has no production environment: every staging workflow is hard-guarded to `environment: staging`.

Required:

- `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID`
- `APP_URL`, `DATABASE_URL`, `DIRECT_URL`, `AUTH_SECRET`
- `RESEND_API_KEY`, `EMAIL_FROM`, `EMAIL_REDIRECT_TO`
- `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`
- `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`
- `NEXT_PUBLIC_TURNSTILE_SITE_KEY`, `TURNSTILE_SECRET_KEY`, `TURNSTILE_BYPASS=0`
- `SEED_PLATFORM_ADMIN_EMAIL` — the first platform admin created by the bootstrap workflow.

Recommended:

- `NEXT_PUBLIC_SENTRY_DSN`, `SENTRY_DSN`

Scheduler (optional):

- `ANNOUNCEMENT_CRON_SECRET` — must also be set in the Vercel Production environment; the scheduler skips with a notice until both exist.

Smoke-only (optional):

- `SMOKE_TEST_EMAIL`, `SMOKE_TEST_PASSWORD` — a real staging student account.
- `SMOKE_PUBLIC_POST_PATH` — a public post path to check the blurred preview.
- `SMOKE_PRIVATE_MARKER` — a body/author string that must never appear in public HTML.
- `VERCEL_AUTOMATION_BYPASS_SECRET` — only if deployment protection is enabled.

The workflow first installs dev dependencies (the validator needs `tsx`), then runs `check:env`, checks every required Vercel variable **name**, applies migrations with `DIRECT_URL`, builds/deploys the staging project's Production environment, and runs the smoke test. `check:env` reports all missing or malformed variables in one pass and never prints a value. A failed step fails the deployment run.

## 6. Email deliverability (SPF and DKIM)

In Resend → Domains → your domain:

1. Add the DKIM TXT record Resend gives you.
2. Add the SPF record Resend gives you (`v=spf1 include:... ~all`) or merge its include into your existing SPF record. Never create a second SPF record on the same name.
3. Add the DMARC record if you do not have one: start with `v=DMARC1; p=none; rua=mailto:dmarc@yourdomain`.
4. Wait for Resend to show **Verified**, then send a test email.
5. Set `EMAIL_FROM` to an address on the verified domain. For staging, set `EMAIL_REDIRECT_TO` so real student addresses never receive test mail.

## 7. Cloudinary

- Create the cloud and copy the three values.
- ID card uploads use **signed** uploads (`type: authenticated`) from the server. Do not create an unsigned upload preset; unsigned presets are intentionally not used.
- Keep the default "block public access to authenticated assets" behaviour. The app generates 120-second signed URLs only after a reviewer check.
- Post images use signed direct uploads with a server-issued signature, restricted public delivery and random IDs.
- Optionally create a `konnekt` folder; the code creates subfolders itself.

## 8. Turnstile

- Add the staging hostname to the widget.
- Keep the secret server-side.
- Production validation rejects `TURNSTILE_BYPASS=1`. Use the documented test keys only in CI/local.

## 9. Deploy and verify

1. Push the branch and wait for CI green.
2. Run the **Deploy** workflow with `environment=staging`.
3. The workflow validates env before touching Vercel, migrates the Neon branch, deploys, and runs:

   ```bash
   npm run smoke:staging -- https://staging.example
   ```

4. The smoke test checks health, headers, `/design` 404, PWA manifest/service worker, public-preview privacy and (when credentials are set) a real login with cookie flags.
5. If smoke fails, do not promote. Fix the reported check and rerun the workflow.
6. `APP_URL` with a trailing slash now fails before any deployment with the exact reason; remove the slash in the GitHub staging secret and in Vercel.

## 10. Announcement scheduler

Scheduled announcements need one recurring caller for
`/api/cron/announcements`. Set `ANNOUNCEMENT_CRON_SECRET` in the staging and
production environments (at least 32 random bytes, separate per environment),
and never put it in a public URL that is logged.

Use Vercel Cron or any external scheduler to send a `POST` (or `GET`) every
minute, for example:

```bash
curl -fsS -X POST https://staging.example/api/cron/announcements \
  -H "Authorization: Bearer $ANNOUNCEMENT_CRON_SECRET"
```

The endpoint accepts a Bearer token or `?secret=` for providers that cannot set
headers. It compares the secret in constant time, returns a generic 401 for a
missing or wrong secret, fails closed if the variable is unset in production,
is limited to 30 calls per 10 minutes per caller and sends `Cache-Control:
no-store`. A due notice is claimed conditionally, so overlapping cron runs and
lazy read-time publishing still publish it exactly once. If the scheduler is
down, reads still publish due notices on demand; the scheduler is not the only
correctness mechanism. Do not enable Vercel's own cron for this route unless it
sends the secret.

## 11. First staging tenant and platform admin

Run **Staging bootstrap** (`workflow_dispatch`, environment `staging`) once. It:

1. Refuses unless the selected environment is exactly `staging` and no
   production marker (`VERCEL_ENV`, `APP_ENV`, `KONNEKT_ENV`, `ENVIRONMENT`) is set.
2. Applies migrations with `DIRECT_URL`.
3. Creates Nova University and the full seed academic tree only when missing.
4. Creates the account in `SEED_PLATFORM_ADMIN_EMAIL` with a random,
   unguessable password hash and the `PLATFORM_ADMIN` role, then emails the
   normal `/reset-password?token=...` link through Resend (redirected by
   `EMAIL_REDIRECT_TO`). No password or token is printed or stored in plaintext.
5. Writes an append-only `staging.bootstrap` audit entry.

It is safe to rerun: entities are reused, the role is not duplicated, and no
email is sent again while a reset link is active or after one is used.

## 12. Announcement scheduler

The optional **Staging announcement scheduler** workflow calls
`POST ${APP_URL}/api/cron/announcements` every five minutes with
`Authorization: Bearer $ANNOUNCEMENT_CRON_SECRET`, exactly as §10 requires. It
only runs on `main`, only uses the `staging` environment, and skips with a
notice if the secret is absent. Add the secret to both GitHub staging and the
Vercel Production environment before relying on it.

## 13. Staging verification

Run **Staging verification** manually with the staging URL. It has three jobs:

- Check every required Vercel variable **name** in Production (no values are
  requested).
- Run the Playwright smoke test, including cookie flags when `SMOKE_TEST_EMAIL`
  and `SMOKE_TEST_PASSWORD` exist.
- Run `scripts/staging-verify.mjs` against the real services: health, exact
  security-header snapshot, `/design` 404, PWA, public privacy, Turnstile
  missing/invalid token rejection, Resend acceptance, Cloudinary signed
  authenticated upload/read/expiry/deletion, Upstash limiting, applied
  migrations and the feed index, and signed Phase 3 attachment expiry.

It never prints a secret, signed URL, email address or token. Turnstile cannot
be completed by a bot; do one real-browser sign-up manually.

## What you must do by hand (minimum)

1. Create the Vercel, Neon, Resend, Cloudinary, Upstash, Turnstile and Sentry accounts.
2. Create the Neon production/staging/e2e branches and copy the six database URLs (pooled and unpooled for each branch).
3. Verify the Resend domain and publish its SPF/DKIM/DMARC DNS records.
4. Create the Vercel project, connect the repo, add the staging domain and set all environment variables in Vercel.
5. Add the GitHub environment secrets listed above.
6. Create one real staging account for the smoke login (optional but recommended).
7. Run the Deploy workflow once and confirm the smoke job is green.
