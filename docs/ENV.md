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

## Production requirements

At server start with `NODE_ENV=production` (outside `next build`), these must be set or startup fails with a precise message:

- `AUTH_SECRET`
- `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`
- `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`
- `NEXT_PUBLIC_TURNSTILE_SITE_KEY`, `TURNSTILE_SECRET_KEY`
- `RESEND_API_KEY`
- `TURNSTILE_BYPASS` must be `0`

`APP_URL` and `DATABASE_URL` are always required. `NEXT_PUBLIC_SENTRY_DSN` is optional but recommended.

## Suggested secret generation

```bash
openssl rand -base64 48        # AUTH_SECRET
```

Turnstile keys: Cloudflare dashboard → Turnstile → site. Use the documented test keys only in CI/local, never in production.

## Development outbox

With no `RESEND_API_KEY`, email is captured in memory. `GET /api/dev/last-email?to=you@example.com` returns the latest message (including verification codes). The route returns 404 in production. The outbox keeps the last 50 messages.

## CI-only values

GitHub Actions supplies throwaway values for secrets in the Lighthouse job (the audited page is public and does not call email, storage or rate limits), and a local Postgres service for tests. See `.github/workflows/ci.yml`. Real deployments use the repository secrets listed in `.github/workflows/deploy.yml`.
