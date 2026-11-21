# Security advisories

Baseline: `npm audit --omit=dev` after hardening.

| Snapshot | Critical | High | Moderate | Low | Total |
| --- | ---: | ---: | ---: | ---: | ---: |
| Before | 1 | 7 | 18 | 0 | 26 |
| After | 0 | 4 | 0 | 0 | 4 |

The remaining four entries are two advisories reported through Prisma's v6 build-time config loader (`@prisma/config`, `deepmerge-ts`, `effect`, `prisma`). They are temporary, expiring allowlist entries in `security/advisory-allowlist.json`; CI fails on any unlisted high/critical advisory or expired entry.

## Direct updates

| Package | Before | After | Semver | Reachability | Decision |
| --- | --- | --- | --- | --- | --- |
| `@sentry/nextjs` | 10.25.0 | 11.16.0 | major | Runtime monitoring (not enabled in the app) | Updated. The v11 API is compatible; the critical tunnel/middleware and PII-header advisories are fixed. |
| `next` | 15.5.28 | 15.5.29 | patch | Production runtime | Updated. The current audit shows three moderate advisories (SVG image-optimizer bypass, HttpOnly cookie exposure on edge routes, and response injection) fixed by this patch. |
| `postcss` | 8.5.6 | 8.5.23 | minor | Build-time CSS processing | Updated, plus a global override so Next's nested copy is patched. |
| `resend` | 6.4.2 | 6.39.0 | minor | Production email | Updated. |
| `sharp` | 0.34.4 | 0.35.5 | 0.x minor | Production image decode/re-encode | Updated; image processing is attacker-facing and the libvips/libheif fixes matter. |
| `zod` | 4.1.12 | 4.6.7 | minor | Production request validation | Updated; this closes a memory-exhaustion validation path. |

`npm audit` still reports four high package entries; they are the same two advisory IDs:

| Advisory | Package path | Exposure | Fix | Decision |
| --- | --- | --- | --- | --- |
| GHSA-ggr8-5vv4-36mx | `prisma` → `@prisma/config` → `deepmerge-ts` | CLI config loading during generate/migrate/build. Repository config is trusted; absent from the server runtime bundle. | Prisma 7 | Deferred behind the Prisma 7 config/client migration; allowlisted until 2027-01-15. |
| GHSA-7589-6fvf-x4pw | `prisma` → `@prisma/config` → `effect` | CLI template-literal validation. Same trusted build-tool boundary. | Prisma 7 | Same deferral. |

## Full before list

| Package | Severity | Why it appeared | State |
| --- | --- | --- | --- |
| `@opentelemetry/core` | moderate | Sentry/OTel baggage memory | gone with Sentry update |
| `@opentelemetry/instrumentation-http` | moderate | Header/log exposure | gone |
| `@opentelemetry/instrumentation-knex` | moderate | DB username span | gone |
| `@opentelemetry/instrumentation-mongoose` | moderate | DB username span | gone |
| `@opentelemetry/instrumentation-mysql` | moderate | DB username span | gone |
| `@opentelemetry/instrumentation-mysql2` | moderate | DB username span | gone |
| `@opentelemetry/instrumentation-pg` | moderate | DB username span | gone |
| `@opentelemetry/instrumentation-tedious` | moderate | DB username span | gone |
| `@prisma/config` | high | deepmerge/effect | allowlisted, build-only |
| `@sentry/bundler-plugin-core` | moderate | glob traversal | gone |
| `@sentry/nextjs` | critical | tunnel middleware bypass / PII headers | fixed 11.16.0 |
| `@sentry/node` | moderate | OTel instrumentation / minimatch | fixed |
| `@sentry/node-core` | moderate | PII header leak | fixed |
| `@sentry/webpack-plugin` | moderate | glob/uuid | fixed |
| `deepmerge-ts` | high | recursive-merge stack exhaustion | allowlisted, build-only |
| `effect` | high | ReDoS in template-literal validation | allowlisted, build-only |
| `glob` | moderate | cancellation bypass/traversal | fixed by Sentry update |
| `minimatch` | moderate | globparts ReDoS | fixed by Sentry update |
| `next` | moderate | SVG image optimizer, edge cookie exposure, response injection | fixed 15.5.29 |
| `postcss` | high | CSS stringify XSS / source-map traversal | fixed 8.5.23 |
| `prisma` | high | @prisma/config | allowlisted, build-only |
| `resend` | moderate | svix/uuid | fixed 6.39.0 |
| `sharp` | high | inherited libvips/libheif/librsvg CVEs | fixed 0.35.5 |
| `svix` | moderate | uuid bounds check | fixed |
| `uuid` | moderate | buffer bounds check | fixed |
| `zod` | high | memory exhaustion on oversized collections | fixed 4.6.7 |

## Enforcement

`npm run audit:prod`:

- fails on any high/critical finding not covered by an allowlist entry;
- requires every accepted entry to have an ID, package list, justification and expiry;
- rejects entries more than 60 days away or already expired;
- prints counts and allowed IDs only, never secret values.

Dependabot is configured for weekly grouped npm updates (production and development) and GitHub Actions. Prisma major updates are intentionally excluded until the v7 migration is scheduled.
