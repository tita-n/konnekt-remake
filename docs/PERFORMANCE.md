# Performance baseline and budgets

## Build size baseline

Measured by `npm run perf:build` on 2026-11-21 from a clean install with the hardened dependencies. First Load JS is the value Next reports for the route.

| Metric | Baseline |
| --- | ---: |
| Shared JS | **104 kB** |
| Middleware | **34.1 kB** (33.1 kB before the dependency-free boot assertion) |
| `/` (welcome) | **118 kB** |
| `/pulse` | **146 kB** |
| `/p/[id]` | **139 kB** |
| `/signup/[slug]` | **117 kB** |
| `/compose` | **133 kB** |
| `/admin/verification` | **108 kB** |
| `/communities` | **137 kB** (118 kB before Phase 2) |
| `/c/[slug]` | **152 kB** (new in Phase 2) |
| `/admin/communities` | **128 kB** (new in Phase 2) |

Phase 2 did not change the shared JS chunk (**104 kB**) or middleware (**34.1 kB**). The `/design/preview/[screen]` route grew from 220 kB to 249 kB because it now imports every community surface for screenshot review; it is development-only and not part of a student route.

`perf/baseline.json` is the source of truth. `npm run perf:build` builds production, writes `perf/current.json` and fails if a key route, shared JS or middleware grows more than **10%** over baseline. Updating the baseline is an explicit, reviewable change; the CI job prints the route and percentage that failed.

## Lighthouse baseline

Lighthouse CI runs mobile emulation with simulated slow 4G (`rttMs: 150`, `throughputKbps: 1638.4`) and 4x CPU slowdown against the local production server.

| Category | Threshold | Baseline |
| --- | ---: | ---: |
| Performance | ≥ 90 | **99** |
| Accessibility | ≥ 95 | **100** |
| Best Practices | ≥ 90 (warn) | **100** |
| SEO | ≥ 90 (warn) | **90** |
| LCP | — | **2.3 s** |
| CLS | — | **0** |
| TBT | — | **20 ms** |

The Phase 2 rerun kept all category scores unchanged (99/100/100/90). LCP moved from 2.0 s to 2.3 s within run variance; TBT measured 20 ms. The landing page remains the audited URL, so community route bundles are covered by the build-size budget rather than Lighthouse.

Lighthouse 12 removed the PWA category. CI checks installability explicitly: manifest with icons and start URL, plus a served service worker (`npm run check:pwa`).

## Dataset

The demo seed (`konnekt_dev`) contains 52 students/staff, ~530 posts (440 posts, 45 questions, 45 polls), 30 communities, community memberships, resources and moderation history. The query-plan regression test uses a dedicated tenant with **1,000 posts**, so it does not depend on the demo seed size.

## Query shape

The first Pulse page asks for 21 candidates (`20 + 1` to detect a next page), newest first:

```sql
SELECT id, "rankAt"
FROM "Post"
WHERE "universityId" = $1
  AND status = 'ACTIVE'
  AND (
    "audienceKind" = 'PUBLIC'
    OR "audiencePath" = ARRAY[$1]
    OR "audiencePath" = ARRAY[$1, $college]
    OR "audiencePath" = ARRAY[$1, $college, $faculty]
    OR "audiencePath" = ARRAY[$1, $college, $faculty, $department]
    OR "audiencePath" = ARRAY[$1, $college, $faculty, $department, $level]
  )
ORDER BY "rankAt" DESC, id DESC
LIMIT 21;
```

## EXPLAIN at 1,000 posts

`tests/integration/feed-plan.test.ts` creates the tenant and posts, runs `ANALYZE`, then asserts this plan. A representative run:

```text
Limit  (cost=0.28..5.91 rows=21 width=34) (actual time=0.024..0.048 rows=21.00 loops=1)
  Buffers: shared hit=4
  ->  Index Scan Backward using "Post_universityId_status_rankAt_id_idx" on "Post"
        (cost=0.28..268.52 rows=1000 width=34) (actual time=0.021..0.041 rows=21.00 loops=1)
        Index Cond: (("universityId" = '...'::text) AND (status = 'ACTIVE'::"PostStatus"))
        Filter: (("audienceKind" = 'PUBLIC'::"AudienceKind") OR ("audiencePath" = '{...}'::text[]) OR ...)
        Index Searches: 1
        Buffers: shared hit=4
Planning:
  Buffers: shared hit=117
Planning Time: 0.643 ms
Execution Time: 0.079 ms
```

What matters:

- `Index Scan Backward` on `Post_universityId_status_rankAt_id_idx`; no sort node.
- The limit stops after 21 matching rows; the audience predicate filters that scan.
- **4 shared buffers** and **0.079 ms** in the test tenant.
- The integrated test fails on a sequential scan or a different index.

## Indexes

Defined in `prisma/migrations/20261117220532_phase1_posts/migration.sql`:

| Index | Supports |
| --- | --- |
| `Post_universityId_status_rankAt_id_idx` | Feed first page, audience filter, keyset cursor |
| `Post_universityId_audienceKind_rankAt_idx` | Filtered feed tabs (level, department, public) |
| `Post_universityId_authorId_createdAt_idx` | Profile post lists |
| `Post_createdAt_idx` | New-post count and housekeeping |
| `PostHashtag_universityId_hashtagId_postId_idx` | Hashtag pages |
| `Report_universityId_status_createdAt_idx` | Moderation queue |
| `ModerationAction_universityId_targetType_targetId_idx` | Moderation history |
| `block_one_per_user`, `mute_one_per_user`, `report_one_per_user` | Relationship/report uniqueness |
| `Community_universityId_status_privacy_category_idx` | Discover by category and privacy |
| `Community_universityId_status_lastActivityAt_idx` | Trending and recent activity |
| `CommunityMember_universityId_userId_status_idx` | A student's joined-community set and feed filter |
| `CommunityMember_communityId_status_role_joinedAt_idx` | Member list and staff ordering |
| `Community_universityId_nameNormalized_key`, `Community_universityId_slug_key` | Name/slug uniqueness after lookalike normalization |
| `Post_universityId_communityId_status_rankAt_id_idx` | Community post page and pins, keyset ordered |
| `CommunityResource_universityId_communityId_status_category__idx` | Resource tab filters |
| `CommunityInvite_tokenHash_key` | Constant-time invite token lookup |
| `Community_name_trgm_idx`, `Community_description_trgm_idx` | Bounded community search |

## Community query shape

Community discovery and the community post page reuse the bounded keyset pattern. The post tab reads `Post` by `(universityId, communityId, status, rankAt, id)` and never falls back to an academic feed. Access is resolved once per request with a batched `CommunityMember` lookup, then applied as pure domain rules; the service does not issue per-card membership queries. Member lists are capped and cursor-paginated. Resource rows carry no public URL: downloads resolve a short-lived signature only after server-side access checks.

## Pagination and client work

Feed pages use a keyset cursor `(rankAt, id)`, not `OFFSET`, so page cost is proportional to page size and rows do not shift when new posts arrive. Only the latest Pulse page is cached in IndexedDB, keyed by user id. The service worker never caches `/api/*` or signed-in HTML. Attachments are re-encoded client-side where supported.

## Reproduce

```bash
npm run perf:build
npm run test:integration -- feed-plan
```

For a real deployment, run `LHCI_URL=https://staging.example npx lhci autorun` after warm-up and compare the plan, not just the absolute millisecond value.

## Phase 3 build snapshot

Measured with `npm run build` on 2026-11-25 after the Phase 3 pages landed:

| Metric | Baseline | Phase 3 |
| --- | --- | --- |
| Shared first-load JS | 104 kB | 104 kB |
| Middleware | 34.1 kB | 34.1 kB |
| `/events` | new | 4.0 kB page, 133 kB first load |
| `/official` | new | 4.5 kB page, 129 kB first load |
| `/events/[id]` | new | 8.6 kB page, 131 kB first load |
| `/events/[id]/dashboard` | new | 7.4 kB page, 126 kB first load |
| `/events/[id]/scan` | new | 6.5 kB page, 125 kB first load |
| `/events/[id]/ticket` | new | 11.0 kB page, 126 kB first load (QR renderer is route-local) |
| `/admin/events` | new | 3.1 kB page, 122 kB first load |
| `/admin/places` | new | 4.1 kB page, 119 kB first load |
| `/admin/official` | new | 6.1 kB page, 125 kB first load |
| `/admin/announcements` | new | 3.0 kB page, 121 kB first load |

The QR renderer is route-local to the ticket screen. Shared JS and middleware are
unchanged, so Pulse, auth, signup and the Phase 2 community routes keep their
previous budgets. The extra page weight is entirely in the new event routes.
