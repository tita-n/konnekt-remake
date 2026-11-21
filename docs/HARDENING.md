# Hardening runbook

The hardening branch closes the gaps found after the UI sync and keeps them closed.

## What runs in CI

| Job | Fails when |
| --- | --- |
| `Types, lint, unit and integration` | type/lint error, no mock-DB guard hit, missing invariant test, unit/integration failure |
| `End-to-end and accessibility` | Playwright or axe failure, unsafe e2e database, or the demo user/post checksums change during the run |
| `Lighthouse (installable, performance, accessibility)` | Performance < 90, Accessibility < 95, contrast/title/lang/viewport failure, or PWA manifest/service worker missing |
| `Production security invariants` | env/header snapshot drift, `/design` or dev route reachable, writes not 429 with Redis down, health not 503 with DB down, or demo seed succeeding in production |
| `Performance budgets` | key route/shared/middleware growth > 10% without a baseline update |
| `Production dependency audit` | unlisted or expired high/critical advisory |
| `UI-only presentation guard` | a `ui/*` branch or `ui-only` PR changes protected paths |
| `Test floor and skipped-test guard` | below 75 unit / 12 integration / 22 e2e, or any skipped/focused test |
| `Secret scan` | gitleaks finds a committed secret |

`ci/invariants.json` maps each product invariant to named tests. `security/headers.snapshot.json` is deliberately committed: loosening a header requires an explicit diff. `security/advisory-allowlist.json` expires the two Prisma v6 build-tool exceptions on 2027-01-15.

## Local commands

```bash
npm run e2e:db:reset && npm run test:e2e
npm run test:security           # needs a production build + seeded e2e DB
npm run perf:build
npm run audit:prod
npm run check:invariants
npm run check:test-floor        # after unit/integration/e2e JSON reports exist
npm run check:ui-guard
npm run smoke:staging -- https://staging.example
```

## Do not

- Do not point `E2E_DATABASE_URL` at a demo or production database.
- Do not lower a test floor or performance threshold to make CI pass.
- Do not add a mock/failover database; the grep guard and production checks reject it.
- Do not update `perf/baseline.json` or the header snapshot without reviewing the actual change.
