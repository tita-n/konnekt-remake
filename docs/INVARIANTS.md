# Invariants and their tests

`ci/invariants.json` is the machine-readable source. `npm run check:invariants` fails CI if a file disappears or a named test no longer exists.

| Invariant | Test file | Named test(s) |
| --- | --- | --- |
| Tenant isolation | `tests/integration/tenant-isolation.test.ts` | `only returns rows for the bound university`; `cannot read another university's user even with the exact id`; `refuses a write that names another university` |
| Hidden and nonexistent responses are identical | `e2e/social.spec.ts` | `level and public posts reach exactly the right students` |
| Blocks are symmetric; mutes are private | `tests/unit/posts.test.ts` | `hides content in both directions when either side blocked`; `mutes only the muter's view and never hides the author from themselves` |
| Reposts cannot widen audience | `tests/unit/posts.test.ts` | `inherits the original audience on every repost` |
| Role boundaries | `e2e/admin.spec.ts` | `reviewer cannot reach students or team management`; `student cannot reach either console`; `platform admin creates a space and sees the audit trail` |
| Private ID images require reviewer access | `e2e/admin.spec.ts` | `admin sees the queue and a private ID image` |
| Public share preview privacy | `e2e/privacy.spec.ts` | `public share preview reveals no author, counts or metadata` |
| Service worker never caches private data | `tests/unit/service-worker.test.ts` | `forces API responses to the network and every navigation is network-only` |
| Logout clears caches, IndexedDB and storage | `e2e/social.spec.ts` | `logout clears the cached feed, cookies and IndexedDB` |
| Offline outbox publishes exactly once | `e2e/social.spec.ts` | `offline outbox publishes once after reconnect` |

## Production hardening invariants

| Invariant | Automated check |
| --- | --- |
| Every required env variable fails closed when missing/malformed | `tests/unit/env-validation.test.ts` |
| Rate limit, storage, email and Turnstile never use fallbacks in production | `tests/unit/security-fallbacks.test.ts` |
| Session cookie is httpOnly, Secure, SameSite=Lax | `tests/unit/cookie-flags.test.ts`, plus deployed login in `scripts/smoke-staging.mjs` |
| No mock/in-memory/failover database | `scripts/check-no-mock-db.mjs` |
| Real production headers and route absence | `scripts/security-invariants.mjs` + `security/headers.snapshot.json` |
| Unreachable database fails closed | `scripts/security-invariants.mjs` |
| Demo seed refuses production | `tests/unit/part-a.test.ts` and `scripts/security-invariants.mjs` |
| Feed keeps its index scan at 1,000 posts | `tests/integration/feed-plan.test.ts` |
| E2E cannot touch the demo database | `tests/unit/e2e-guard.test.ts`, `e2e/isolation.spec.ts`, CI before/after checksum |
| Test count cannot silently drop | `ci/test-floor.json` + `scripts/check-test-floor.mjs` |
| UI-only branches cannot alter protected paths | `.github/ui-guard.json` + `scripts/check-ui-guard.mjs` |
