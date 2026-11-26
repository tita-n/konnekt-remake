# Staging deployment log

Real failures found while bringing staging up, with the fix and its guard. No
secret values appear here.

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
