# Feed performance

## Dataset

Local development database (`konnekt_dev`) after `npm run db:seed`:

| Table | Rows |
| --- | --- |
| `User` (verified students) | 52 + staff accounts |
| `Post` | 530 (440 posts, 45 questions, 45 polls) |
| `Comment` | 200+ |
| `Report` | seeded reports for the moderation queue |

The dataset is intentionally small enough to fit in memory and large enough to exercise the ranking index. These are single-run local measurements, not a latency SLA.

## Query shape

The first Pulse page asks for 21 candidates (`20 + 1` to detect a next page), newest first, for one viewer:

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

Prisma generates the same equality predicates from `visibleAudienceFilter`. Labels, names and user input never become SQL fragments.

## EXPLAIN (ANALYZE, BUFFERS)

Run against the seeded Nova posts and a 300L Software Engineering viewer:

```text
Limit  (cost=0.28..75.64 rows=21 width=42) (actual time=0.046..0.109 rows=21.00 loops=1)
  Buffers: shared hit=22
  ->  Index Scan Backward using "Post_universityId_status_rankAt_id_idx" on "Post"
        (cost=0.28..617.53 rows=172 width=42) (actual time=0.043..0.103 rows=21.00 loops=1)
        Index Cond: (("universityId" = '...'::text) AND (status = 'ACTIVE'::"PostStatus"))
        Filter: (("audienceKind" = 'PUBLIC'::"AudienceKind") OR
                 ("audiencePath" = '{...}'::text[]) OR ...)
        Index Searches: 1
        Buffers: shared hit=22
Planning:
  Buffers: shared hit=252
Planning Time: 0.935 ms
Execution Time: 0.148 ms
```

What matters:

- `Index Scan Backward` on `Post_universityId_status_rankAt_id_idx` — no sort node.
- The limit stops after 21 matching rows; the audience predicate is a filter on that scan.
- **22 shared buffers** for the page; no sequential scan.

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

## Pagination

Feed pages use a keyset cursor `(rankAt, id)`, not `OFFSET`. The next page adds:

```sql
AND ("rankAt" < $cursorRankAt OR ("rankAt" = $cursorRankAt AND id < $cursorId))
```

This keeps page cost proportional to the page size and avoids rows shifting when new posts arrive. The client keeps the cursor opaque; it is not a user id or timestamp exposed as authority.

## Client-side work

- Only the latest Pulse page is cached in IndexedDB, keyed by user id. A cached feed is never reused for another account.
- The service worker does not cache `/api/*` or signed-in HTML, so feed data cannot be replayed between users on a shared device.
- Image attachments are re-encoded client-side before upload where supported, and rendered with intrinsic dimensions to avoid layout shift.

## Reproduce

```bash
npm run db:seed
psql "$DATABASE_URL" -c 'EXPLAIN (ANALYZE, BUFFERS) SELECT ...'
```

Replace the audience arrays with the viewer’s actual academic path. On Neon, run the same query after a warm-up and compare the plan, not the absolute millisecond value.
