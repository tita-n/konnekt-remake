# Staging deployment log

Real failures found while bringing staging up, with the fix and its guard. No
secret values appear here.

## 2026-11-26 — staged database repaired; health and signup recovered

**Symptom:** after the provider values were corrected, the previously deployed
build still returned `503` with `schemaReady: false`, and `/signup` returned
`500`.

**Root cause:** Vercel environment changes do not reach an already-built
deployment. The runtime was still using the old, wrong `DATABASE_URL`.

**Fix:** the Deploy workflow re-ran, confirmed the runtime and migration URLs
agree, migrated the staging branch and deployed remotely. Health is now `200`,
`/signup` is `200` and the public preview is `200`. The app was always using
the **Neon staging branch**; the Vercel Production label is just the deployment
slot for `konnekt-remake.vercel.app`, not permission to use the production
database.

## 2026-11-26 — private ID-image links never expired

**Symptom:** the real-service check waited past the signed URL's expiry and the
image was still readable.

**Root cause:** `scripts/staging-verify.mjs` and production's
`signedPrivateUrl()` both used `cloudinary.url({ expires_at })`. The Cloudinary
SDK silently ignores `expires_at` in `url()`, so the link was signed but had no
expiry at all.

**Fix:** both now use `cloudinary.utils.private_download_url()`, which binds
`expires_at` into the request signature. **Guard:**
`tests/unit/private-url.test.ts` checks the expiry parameter, the signed
download path and that changing the lifetime changes the signature. The staging
check now signs the same way production does, so it tests the real mechanism.

## 2026-11-26 — generic event preview inherited Open Graph tags

**Symptom:** `/e/<unknown>` returned the generic “This event is private” card
with the root layout's site-wide Open Graph metadata.

**Root cause:** the no-preview metadata branch set robots tags but did not
override `openGraph`/`twitter`, so Next.js inherited the root card. An opted-in
PUBLIC event intentionally has its own share card; the generic/private fallback
must have none.

**Fix:** `/e/[id]` now sets `openGraph: null` and `twitter: null` only on the
private/missing fallback. **Guard:** the E2E privacy test checks the generic
event page has no OG tags and is `noindex`; opted-in public event cards still
work as designed.

## 2026-11-26 — first Deploy run failed before validation

**Symptom:** the run stopped in `Validate deployment environment` with
`sh: 1: tsx: not found` before it ever read the bad configuration.

**Root cause:** the validate job set `NODE_ENV=production` at job level. npm
therefore omitted devDependencies during `npm ci`, and the validator itself
(`tsx scripts/check-env.ts`) was missing.

**Fix:** the workflow installs with `npm ci --include=dev`; validation no longer
inherits a production install environment. **Guard:**
`tests/unit/deploy-workflow.test.ts` fails if any deploy install drops
`--include=dev`.

## 2026-11-26 — staging was being deployed to Vercel Preview

**Symptom:** the workflow built and deployed `--environment=preview`, while the
staging site `https://konnekt-remake.vercel.app` is served by the project's
Vercel **Production** environment. Preview had no staging variables, so a
successful workflow could never exercise the staging site.

**Fix:** this repository's Vercel project is the staging project. The Deploy
workflow is now staging-only and builds/deploys its Production environment with
`--prod`. **Guard:** the same workflow test rejects Preview and a production
menu option.

## 2026-11-26 — local Vercel build saw empty environment values

**Symptom:** validation and migrations passed, then `vercel build` failed while
collecting page data with invalid `APP_URL`, `DATABASE_URL`, `AUTH_SECRET` and
service variables. The live deployment still reported every service configured.

**Root cause:** the project uses Vercel **Sensitive** environment variables.
`vercel pull` cannot decrypt those onto a GitHub runner, so the local prebuilt
build saw empty/malformed values even though Vercel's own builds receive them.

**Fix:** do not pull values or build locally. The workflow writes only the
project/org ids under `.vercel/`, then runs `vercel deploy --prod --yes` so
Vercel builds remotely with the Production environment injected. **Guard:**
`tests/unit/deploy-workflow.test.ts` rejects `vercel pull`, `vercel build` and
`--prebuilt` and requires the remote `vercel deploy --prod`.

## 2026-11-26 — smoke job could not install Playwright

**Symptom:** the first fully successful staging deployment failed in smoke at
`npx playwright install --with-deps chromium` with
`Playwright does not support chromium on ubuntu26.04-x64`. `ubuntu-latest` had
moved to 26.04 while the project pins Playwright 1.56.1.

**Fix:** the deploy smoke job and all staging verification jobs pin
`ubuntu-24.04`, matching the existing CI. **Guard:**
`tests/unit/staging-workflows.test.ts` asserts the pinned runners.

## 2026-11-26 — Cloudinary key cannot create assets

**Symptom:** the real-service verification uploaded a signed authenticated image
and got HTTP 403:
`Request forbidden due to missing permissions (actions=["create"])`.

**Root cause:** the staging Cloudinary API key is restricted and lacks the
`create` permission. Signing itself was accepted; the account policy refused the
upload.

**Status:** blocked on the environment owner creating/using a Cloudinary key
with upload (`create`) permission for the staging cloud. No check was weakened
or skipped. The verification reports the provider's static reason only.

## 2026-11-26 — bootstrap succeeded

`Staging bootstrap` created Nova University with all 15 academic nodes and the
first platform admin, then sent the normal 30-minute password-set link through
Resend to `EMAIL_REDIRECT_TO`. It wrote the `staging.bootstrap` audit entry. A
second run is intentionally a no-op for the tenant, role and email.

## 2026-11-26 — runtime database was not the migrated database

**Symptom:** health passed, `/e/...` worked, but `/p/...` returned 500 with
`PrismaClientKnownRequestError P2021: The table public.Post does not exist in
the current database`. Vercel runtime logs gave the exact Prisma error.

**Root cause:** the Vercel Production `DATABASE_URL` points at a different
database from the `DIRECT_URL` used by `prisma migrate deploy`. The migration
database has every Phase 3 table and migration; the runtime database has no
`Post` table. Health's `SELECT 1` cannot distinguish the two.

**Status:** blocked on the environment owner setting the Vercel Production
`DATABASE_URL` to the **pooled URL of the same Neon staging branch** as
`DIRECT_URL`. This is a secret value, so it was not read or changed here.

**Guard:** `scripts/check-staging-db.mjs` now runs before every deploy and
compares the GitHub runtime/migration URLs. Health also checks that `Post`,
`Event` and `Announcement` actually exist, so a wrong Vercel runtime URL becomes
a failed readiness probe instead of a first-request 500. It prints table names
and status only, never a URL.

## 2026-11-26 — smoke hit Vercel Deployment Protection

**Symptom:** deployment succeeded, then every smoke request returned HTTP 302.

The smoke job used the raw deployment URL
(`konnekt-remake-*.vercel.app`), which is protected by Vercel Authentication.
The public staging domain (`APP_URL`) is the user-facing site and was already
healthy.

**Fix:** smoke the public staging domain instead of disabling Deployment
Protection or inventing a bypass. **Guard:** `tests/unit/staging-workflows.test.ts`
asserts smoke uses `secrets.APP_URL`, not the protected deployment URL.

## 2026-11-26 — startup validation stopped at the first bad variable

**Symptom:** the reported production 500 named only `APP_URL`, so every other
configuration problem would need another deploy cycle to discover.

**Fix:** `productionEnvironmentProblems()` now collects every missing or
malformed required name, including missing service keys, wrong schemes,
quotes, leading/trailing whitespace, a trailing `APP_URL` slash, short
`AUTH_SECRET`, invalid Sentry DSNs and a production Turnstile bypass. The
message is built only from names and static reasons. `check:env` uses the same
collector, and the full schema also rejects an `APP_URL` trailing slash.

**Guard:** unit tests cover every failure type, all-at-once reporting, and a
secret-leak contract that asserts no configured value appears in the error.

## 2026-11-26 — `APP_URL` has a trailing slash in GitHub staging

**Symptom:** the fixed validator now reports:
`APP_URL: must not end with a trailing slash`.

**Root cause:** the GitHub `staging` environment secret for `APP_URL` includes a
trailing `/`. The value itself is never printed.

**Status:** blocked on the environment owner changing the secret (and matching
Vercel value) to `https://konnekt-remake.vercel.app`. No code or check was
weakened. **Guard:** exact reason in `check:env` plus the new deploy workflow
test.

## 2026-11-26 — first-admin creation was manual and unsafe

**Symptom:** staging had no repeatable, audited way to create the Nova tenant and
the first platform administrator without inventing a password.

**Fix:** a staging-guarded bootstrap workflow creates the tenant and admin with
a random unusable password hash, emails the normal reset link, writes an audit
row, refuses production markers, and is idempotent on rerun. **Guard:**
integration test runs it twice and checks one role, one active reset token, one
email, and the full academic tree.
