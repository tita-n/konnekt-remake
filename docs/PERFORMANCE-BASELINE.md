# Performance baseline (stabilization pass, November 2026)

Measured **before** any optimization in this pass, on the VPS, against a local
production build (`npm run build && npm start`) with the demo seed (500 posts,
30 communities, 11 events) and a local PostgreSQL 15 container. The point is to
rank causes, not to promise a production latency. Staging is measured separately
with the diagnostics workflow because vendor regions and cold starts differ.

## Method

- `scripts/perf-journeys.mjs` creates a real database session for
  `student@nova.edu.ng`, calls the same API endpoints the app uses with
  `x-perf-trace`, and records the median of five warm requests: wall time
  (TTFB), server total, database queries, Redis commands and payload bytes from
  `Server-Timing`.
- `scripts/perf-browser.mjs` drives Chromium (390×844) with CDP network
  emulation: **200 ms added latency, 1.6 Mbps down, 4× CPU slowdown**, and
  records navigation TTFB and first contentful paint.
- Cold-versus-warm was not reproducible locally: local Postgres never scales to
  zero. The cold probe belongs on staging (`staging-diagnostics.yml` plus a
  >5-minute idle) and is listed as a manual step below.
- No secrets are read or printed. The trace is inert without `PERF_TRACE_SECRET`.

## Warm API journeys (local, median of 5)

| Journey | Status | Wall | Server | DB queries | Redis commands | Payload |
| --- | --- | --- | --- | --- | --- | --- |
| Pulse feed, first page | 200 | 21.4 ms | 16.0 ms | **12** | 0 | 9.6 kB |
| Pulse feed, next page | 200 | 19.1 ms | 13.5 ms | **13** | 0 | 10.1 kB |
| Communities hub | 200 | 23.5 ms | 18.9 ms | **25** | 0 | 12.4 kB |
| Events hub | 200 | 33.3 ms | 27.1 ms | **15** | 0 | 12.8 kB |
| Event detail (participant) | 404 in this seed sample | 13.2 ms | 8.3 ms | 11 | 0 | — |
| Pulse page (server-rendered HTML) | 200 | 58.7 ms | — | — | — | **355 kB** |
| Welcome page | 200 | 19 ms | — | — | — | 41 kB |
| Login page | 200 | 15 ms | — | — | — | 24 kB |

The 3-round-trip target in the brief is missed by **4–8×** on every list
endpoint. Local query time is small, so today's perceived slowness on a phone is
dominated by serialized round trips over a distant database plus the client
waterfall, not by Postgres CPU.

## Throttled browser journeys (local, profile above)

| Journey | TTFB | FCP | First-load JS (build output) |
| --- | --- | --- | --- |
| Welcome | 264 ms | 1076 ms | 118 kB |
| Login | 466 ms | 948 ms | 118 kB |
| Pulse | 57 ms (client nav) | 552 ms | 118 kB |
| Communities hub | 216 ms | 284 ms | 118 kB |
| Events hub | 224 ms | 300 ms | 118 kB |

## Ranked bottlenecks and causes

1. **Chatty feed reads (12–13 queries).** `getFeed` loads relationships,
   joined communities, the page, the community-access map, viewer state and poll
   votes as separate awaits, then serializes. Several of those are independent
   but sequential. This is the first target for a single-query loader and
   per-request `cache()`.
2. **Communities hub: 25 queries.** Discovery plus membership, categories and
   per-community metadata are loaded separately. This is the worst offender and
   explains the slow first tap on the Communities tab.
3. **Sequential auth waterfall.** `socialApi` does session lookup, then
   `loadSocialViewer` (user + academic lineage + relationships) before the
   endpoint's own queries start. Every request pays it before useful work.
4. **355 kB of server-rendered Pulse HTML.** The first feed page ships the full
   post payload plus shell in one document. It is re-sent on every navigation
   and on a 1.6 Mbps link costs most of a second.
5. **Session lookup is not cached.** At 5,000 users this is one indexed query
   per request, but it sits in front of everything and prevents sharing a
   cacheable feed computation.
6. **No shared feed cache.** Every viewer recomputes the same public posts.
7. **Image delivery:** demo images are SVG/local; production Cloudinary URLs
   are passed through without a fixed named-transformation width set. This will
   multiply transformations and bandwidth at scale.
8. **Rate limiting calls Redis for every limited action**, even when a local
   bucket would be enough, and has no in-memory burst layer.

## Region findings (staging)

Pending: `Staging diagnostics` workflow must run once with `PERF_TRACE_SECRET`
in the staging environment. It reports only the function region, database/Redis
region segments and cold/warm round trips. Until it runs, no region change is
justified; the local build gives no evidence about Vercel/Neon distance.

## Cold-start plan

Do not add a keep-warm cron. Neon free compute would be consumed. The app shell
and skeletons render from the static service-worker precache, and the client
sends one lightweight warm-up request on open so the database wakes while the
shell paints. Measure the >5-minute idle case on staging after PR4.

## Re-measurement

After PR4 run the same two scripts and record the second table in this file.
Budgets: feed/detail server p95 < 200 ms, ≤3 database round trips per list or
detail request, first useful paint from cache < 1 s, feedback within 100 ms.

### Second measurement — 27 November 2026, after PR2/PR3/PR4

Same script, same local production build, warm, on `konnekt_dev`:

| Journey | Wall | Server | DB queries | Redis | Bytes |
| --- | --- | --- | --- | --- | --- |
| Welcome | 16.0 ms | 0 ms | 0 | 0 | 41,063 |
| Login | 13.5 ms | 0 ms | 0 | 0 | 24,421 |
| Pulse feed (first) | 27.0 ms | 21.9 ms | 12 | 0 | 9,627 |
| Pulse feed (next page) | 33.0 ms | 27.4 ms | 13 | 0 | 10,133 |
| Communities hub | 35.6 ms | 29.9 ms | 25 | 0 | 17,020 |
| Events hub | 34.9 ms | 29.2 ms | 15 | 0 | 13,647 |
| Pulse page (HTML) | 65.9 ms | — | — | — | 360,528 |

These are within run-to-run noise of the first table. **No query-count reduction
is claimed**: the academic-tree cache removes one full-tree query on repeat
requests inside 60 s, but the three measured journeys still load a viewer-scoped
department per request, and they do not repeat that tree load within one run.
The 3-round-trip target is still not met (12 / 25 / 15 queries) and needs the
shared read model described in DECISIONS.md, which was not built in this pass.
