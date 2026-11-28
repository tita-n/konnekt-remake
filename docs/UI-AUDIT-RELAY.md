# UI audit relay

The UI audit relay gives a UI agent that cannot run Prisma or open a browser a
CI-based way to see the real app. For every same-repository pull request whose
head branch starts with `ui/`, GitHub Actions:

1. starts Postgres, applies migrations and runs the demo seed;
2. mints real demo sessions through the normal login form;
3. builds and starts the production app;
4. audits the live route matrix at 13 widths in light and dark;
5. updates one sticky PR comment; and
6. pushes compressed JPEGs and reports to `ui-audit-results`.

It is informational by default. Only infrastructure failures fail the job,
unless the repository variable `UI_AUDIT_STRICT` is set to `true`.

The workflow is `.github/workflows/ui-audit.yml`. It never runs Phase 4 and it
does not replace e2e, axe, Lighthouse or the production security invariants.

## Trigger

- Automatically on `pull_request` `opened`, `synchronize` and `reopened` when
  the PR is from this repository and `github.head_ref` starts with `ui/`.
- Forks are skipped.
- Manually with **Actions → UI audit relay → Run workflow** and the `branch`
  input set to a same-repository `ui/**` branch with an open PR.

The concurrency group is per PR and cancels an older in-progress run. The job
timeout is 25 minutes. Permissions are `contents: write` (only to publish the
results branch) and `pull-requests: write` (only for the sticky comment).

A PR that changes `.github/**` is rejected before the app runs. The workflow
uses the same fake CI environment as `ci.yml`; it never receives a real
service secret. `GITHUB_TOKEN` is automatic and scoped by the permissions
above.

## Route matrix

`design/audit-routes.json` is the audit contract. Each group has a label and
routes:

```json
{
  "id": "pulse-level",
  "path": "/pulse",
  "role": "student",
  "state": "my level",
  "actions": [
    { "type": "click", "role": "button", "name": "My Level" }
  ]
}
```

- `path` may contain `{token}` placeholders.
- `role` is `anonymous`, `student`, `admin` or `platform`; the roles map to the
  seeded demo accounts and the password in the harness.
- `state` names the visual state included in defect rows.
- `actions` reach client-only chips and tabs without inventing query flags.
- `expectedStatus` suppresses an expected non-2xx route from `routeErrors`
  (for example an invite-only community that correctly returns 404).

Seeded IDs are never hard-coded. The `resolvers` block queries the seeded
database at runtime: users by email, a public post by an author, the first
hashtag, a community by name or membership, events and announcements by title,
the pending report and verification request, and the Nova university record.
Run `npm run db:seed` before using the list.

The route list covers welcome, find-university, student-email, ID-card and
vouch signup, login, forgot/reset, public previews, every Pulse chip and
composer type, post detail, drafts, bookmarks filters, hashtags, profiles,
all settings pages, communities and every community tab, community creation
and owner settings, request/invite-only states, events and every event state
plus ticket/scanner/dashboard/edit/create/My Events tabs, the official channel,
all university-admin consoles, all platform consoles, and the offline,
suspended, deleted, invalid-link and not-found states.

Signup account and email-verification screens are not independently routable
without a draft created by an external email/ID step, so the live matrix stops
at the method screens. Their presentation states remain covered by the design
previews and component tests. The app has no standalone `error.tsx` route;
route failures are reported as `routeErrors` rather than rendering a page.

## The audit contract

A UI-owned audit may be added at `design/responsive-audit/run.mjs`. The
workflow prefers it when it exists. It must accept exactly:

```bash
node design/responsive-audit/run.mjs \
  --base-url <url> \
  --routes design/audit-routes.json \
  --widths 320,360,375,390,412,430,600,768,820,1024,1280,1440,1920 \
  --themes light,dark \
  --out <dir>
```

It must write `<dir>/summary.json`, `<dir>/summary.md` and
`<dir>/shots/<route>-<width>-<theme>.jpg` for captured routes. Auth storage
states are available at `$UI_AUDIT_AUTH_DIR/<role>.json`; read that environment
variable rather than bypassing login.

Until that script exists, the workflow runs `scripts/ui-audit-fallback.mjs`
with the same arguments. The fallback detects:

- document horizontal overflow (`scrollWidth > viewport width`);
- interactive targets smaller than 44×44 px, excluding inline text links,
  hidden inputs and native radios/checkboxes;
- overlapping fixed or sticky surfaces;
- clipped single-line text;
- raster images without reserved intrinsic dimensions or a CSS aspect ratio;
- icon-only buttons or links without an accessible name; and
- detectable WCAG AA contrast failures for direct text.

Every defect record contains route, state, width, theme, rule id, selector,
measured value, severity and (when captured) screenshot. The fallback caps
output at 42 defect shots and 18 route-group overviews (60 images total), so
very large runs sample two defect screens per width/theme and retain one
overview per group at 390 and 1280 in light mode. The full defect set is always
in `summary.json`.

## Reading the sticky comment

The comment is updated in place, identified by
`<!-- konnekt-ui-audit -->`. It contains:

- total defects, route states, widths, themes and run duration;
- the current and previous run comparison (`new` and `fixed`);
- defects per route group and per width;
- the top 40 defects with route, state, width, theme, rule, selector/value and
  screenshot path; and
- copy-paste fetch commands.

`summary.json` has the complete list; the comment is deliberately limited so
it stays below GitHub's 65,536-character comment limit.

## Results branch

`ui-audit-results` is an orphan branch containing:

```text
<pr-number>/<run-number>/summary.json
<pr-number>/<run-number>/summary.md
<pr-number>/<run-number>/shots/*.jpg
```

JPEGs are quality 70 with a maximum width of 800 px. Only the last three runs
per PR are kept; older run directories are deleted in the publishing commit.
A run is refused if the branch would exceed 100 MB.

Fetch screenshots locally with:

```bash
git fetch origin ui-audit-results
git checkout origin/ui-audit-results -- <pr>/<run>
open <pr>/<run>/summary.md
open <pr>/<run>/shots
```

`git checkout <ref> -- <path>` stages a copy without switching branches. The UI
agent can also read individual files with
`git show origin/ui-audit-results:<pr>/<run>/summary.json`.

The branch is not merged into `main` and no workflow triggers on pushes to it.
Recommended protection:

1. **Settings → Branches → Add branch protection rule** for
   `ui-audit-results`.
2. Require a pull request before merging **off** (this is a generated artifact
   branch, not a review branch).
3. Restrict deletions **on**; block force pushes **on**. The publisher prunes
   with ordinary commits, so it does not need force-push. If a manual prune
   ever needs a rewrite, an administrator can temporarily allow it.
4. Do not add `ui-audit-results` as a required status check or required
   deployment branch.
5. Keep the branch out of the merge queue and do not create a PR from it.

## Local run

The relay expects the same Node 22 and Postgres tooling as the app. On this VM,
or any VPS with Postgres and Chromium:

```bash
npm ci
npx prisma generate
createdb konnekt_audit
DATABASE_URL=postgresql://postgres@127.0.0.1:5432/konnekt_audit npx prisma migrate deploy
DATABASE_URL=postgresql://postgres@127.0.0.1:5432/konnekt_audit npm run db:seed

# 1. Mint real sessions through the dev login (Turnstile bypass is dev-only).
NODE_ENV=development TURNSTILE_BYPASS=1 \
  DATABASE_URL=postgresql://postgres@127.0.0.1:5432/konnekt_audit \
  AUTH_SECRET=local-only-secret-0123456789abcdefghijklmnop \
  npx next dev -p 3102
# In another shell, with the dev server still running:
node scripts/ui-audit-login.mjs --base-url http://127.0.0.1:3102 --out .ui-audit/auth

# 2. Build and start production with the same AUTH_SECRET and database.
NODE_ENV=production DATABASE_URL=... AUTH_SECRET=... \
  UPSTASH_REDIS_REST_URL=https://example.invalid UPSTASH_REDIS_REST_TOKEN=ci \
  CLOUDINARY_CLOUD_NAME=ci CLOUDINARY_API_KEY=ci CLOUDINARY_API_SECRET=ci \
  RESEND_API_KEY=re_ci TURNSTILE_BYPASS=0 \
  TURNSTILE_SECRET_KEY=1x0000000000000000000000000000000AA \
  NEXT_PUBLIC_TURNSTILE_SITE_KEY=1x00000000000000000000AA \
  npm run build
# Start npx next start -p 3100 with the same production environment.

# 3. Run the fallback against production.
UI_AUDIT_AUTH_DIR="$PWD/.ui-audit/auth" \
  node scripts/ui-audit-fallback.mjs \
  --base-url http://127.0.0.1:3100 \
  --routes design/audit-routes.json \
  --widths 320,390,768,1280 \
  --themes light,dark \
  --out .ui-audit/local
```

Production refuses `TURNSTILE_BYPASS=1`, so the dev login step exists only to
mint sessions; the audited server is always the production build. The session
cookie host is `127.0.0.1`, so use that host for both servers.

To exercise the workflow exactly, push a throwaway `ui/audit-probe` branch with
an open PR containing a deliberate defect and dispatch the workflow against
it. Never merge the probe branch.

## Strict mode and failures

- Unset or `false`: defects are reported but the job succeeds.
- `true`: the job fails after publishing when at least one defect exists.
- Missing database, login failure, production start failure, too many 5xx
  responses or a results push over 100 MB fail the job as infrastructure
  errors.
- The report is uploaded as the `ui-audit-<run>` artifact for seven days even
  when a later step fails.

Set the variable under **Settings → Secrets and variables → Actions →
Variables**, not as a secret. It defaults to false; no repository setting is
required for informational mode.

## Troubleshooting

| Symptom | Check |
| --- | --- |
| `Could not resolve seeded id` | Run `npm run db:seed` against the audit database; the seed gate refuses production. |
| Login button disabled | The dev login server did not receive `TURNSTILE_BYPASS=1`, or it is running in production mode. |
| Rows redirect to `/login` | The dev and production servers have different `AUTH_SECRET` or database URLs, or the cookies were saved from another host. |
| All routes 500 | Check the production server log and `/api/health`; the job treats a widespread 5xx as infrastructure failure. |
| Screenshots are unstyled | The production build was not used, or the page was captured before its CSS loaded. The fallback waits for stylesheets and network idle. |
| Comment missing | The PR must be open and the token needs `pull-requests: write`; dispatch requires an open PR for the branch. |
| Push rejected | Pull the results branch and re-run; concurrent PRs share the branch and a different PR may have published first. |
| Branch over 100 MB | Prune old PR folders only with an ordinary commit, or lower image retention after documenting the change. |
