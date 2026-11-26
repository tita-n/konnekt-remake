# Environment

Copy `.env.example` to `.env` (or `.env.local`). Never commit real secrets. Only `NEXT_PUBLIC_*` values reach the browser.

## Required everywhere

| Variable | Notes |
| --- | --- |
| `DATABASE_URL` | PostgreSQL connection string. Neon pooled URL in deployments; local unpooled URL in development. |
| `AUTH_SECRET` | ≥32 characters, random. Signs CSRF tokens and hashes IPs. Rotating it invalidates CSRF/session-derived material. |
| `APP_URL` | Public origin, no trailing slash. Used in emails, absolute links and CSP. |

## Recommended / optional

| Variable | Default | Purpose |
| --- | --- | --- |
| `DIRECT_URL` | — | Unpooled Neon URL used by CI migrations. The app uses `DATABASE_URL`. |
| `NODE_ENV` | `development` | `production` enables Secure cookies, HSTS, COOP and strict env validation. |
| `SESSION_TTL_DAYS` | `30` | Session lifetime (1–90). |
| `TURNSTILE_BYPASS` | `0` | `1` accepts the local bypass. **Must be `0` in production.** |
| `RESEND_API_KEY` | — | Enables real email. Without it, development uses the in-process outbox. |
| `EMAIL_FROM` | `Konnekt <hello@konnekt.ng>` | Verified Resend sender. |
| `EMAIL_REDIRECT_TO` | — | Send all mail to one address in staging (comma separated). |
| `CLOUDINARY_CLOUD_NAME` / `CLOUDINARY_API_KEY` / `CLOUDINARY_API_SECRET` | — | Private ID assets and public avatars/logos. Without them development uses local storage. |
| `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` | — | Sliding-window rate limits. Without them development uses an in-memory limiter. |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | — | Rendered in the login/signup widget. |
| `TURNSTILE_SECRET_KEY` | — | Server verification of Turnstile tokens. |
| `NEXT_PUBLIC_SENTRY_DSN` / `SENTRY_DSN` | — | Error monitoring. |
| `SENTRY_ENVIRONMENT` | — | Sentry environment label. |
| `SEED_PLATFORM_ADMIN_EMAIL` | `admin@konnekt.ng` | Platform admin created by the seed. |
| `ANNOUNCEMENT_CRON_SECRET` | — | Bearer/query secret for `/api/cron/announcements`. Leave unset to keep the cron endpoint closed; feed reads still publish due announcements lazily. |

## Dedicated e2e database

Playwright is hard-guarded away from the demo database. Configure `.env.e2e.local` (ignored):

```bash
E2E_DATABASE_URL=postgresql://postgres@127.0.0.1:55433/konnekt_e2e
DEV_DATABASE_URL=postgresql://postgres@127.0.0.1:55432/konnekt_dev
```

`E2E_DATABASE_URL` must be different from `DATABASE_URL`/`DEV_DATABASE_URL`, must end in `_e2e` or `_test`, and must not look production-like. Remote databases are refused unless `E2E_ALLOW_REMOTE=1`, and are only appropriate for a dedicated Neon branch/database. The Playwright server overrides `DATABASE_URL` with the e2e URL; the app never receives the demo URL. `npm run e2e:db:up` uses Docker; without Docker create a Neon branch and use `E2E_ALLOW_REMOTE=1`.

## Checking a deployment environment

```bash
npm run check:env -- staging
npm run check:env -- production
# or validate a file
npm run check:env -- staging --env-file .env.staging
```

It reports **all** missing or malformed variables in one pass, using names and static reasons only, never values. It requires every production service plus `DIRECT_URL`, rejects `TURNSTILE_BYPASS=1`, and rejects a non-HTTPS, quoted or trailing-slash `APP_URL`. The boot check uses the same collector, so a deployment cannot stop at only the first bad value.

## Adapters and startup checks

Every external dependency has a real and a local implementation, selected by the keys above (`src/lib/adapters.ts`). At server start (outside `next build`), `assertProductionServices` lists any required production adapter that is missing and refuses to boot. `GET /api/health` and the platform console expose the same status without secrets.

| Adapter | Real provider | Local fallback | Required in production |
| --- | --- | --- | --- |
| Email | Resend | In-process outbox | Yes |
| Image storage | Cloudinary | Local gitignored folders | Yes |
| Rate limits | Upstash Redis | In-memory counters | Yes |
| Bot protection | Cloudflare Turnstile | Bypass in local/dev only | Yes |
| Error tracking | Sentry | No-op logging | No |

Phase 1 adds no new environment variables. Post media uses the existing Cloudinary adapter; authenticated ID-card delivery remains restricted to verification reviewers.

## Production requirements

At server start with `NODE_ENV=production` (outside `next build`), `src/instrumentation.ts` runs `assertProductionServices` before requests are served. These must be set or startup fails with a precise message:

- `DATABASE_URL` (a valid `postgres://` URL)
- `AUTH_SECRET` (32+ characters)
- `APP_URL` (http/https)
- `EMAIL_FROM` (must contain an address)
- `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`
- `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`
- `NEXT_PUBLIC_TURNSTILE_SITE_KEY`, `TURNSTILE_SECRET_KEY`
- `RESEND_API_KEY`
- `TURNSTILE_BYPASS` must be `0`

`APP_URL` and `DATABASE_URL` are always required. In production `APP_URL` must be an HTTPS origin with no quotes and no trailing slash. `NEXT_PUBLIC_SENTRY_DSN` is optional but recommended.

## Suggested secret generation

```bash
openssl rand -base64 48        # AUTH_SECRET
```

Turnstile keys: Cloudflare dashboard → Turnstile → site. Use the documented test keys only in CI/local, never in production.

## Development outbox

With no `RESEND_API_KEY`, email is captured in memory. `GET /api/dev/last-email?to=you@example.com` returns the latest message (including verification codes). The route returns 404 in production. The outbox keeps the last 50 messages.

## CI-only values

GitHub Actions supplies throwaway values for secrets in the Lighthouse job (the audited page is public and does not call email, storage or rate limits), and a local Postgres service for tests. See `.github/workflows/ci.yml`. Real deployments use the repository secrets listed in `.github/workflows/deploy.yml`.
