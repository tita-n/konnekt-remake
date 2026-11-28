# UI audit — ui/responsive-system

**3891 defects** across 2626 route states, 13 widths and both themes. Run took 4m 17s.

- Run: [#11](https://github.com/tita-n/konnekt-remake/actions/runs/46148051842)
- Commit: `2959edeab88f`
- Results: `32/11` on `ui-audit-results`
- Images: 156 JPEGs (max 60 per run)
- Change vs previous run: this is the first recorded run for this PR.

## Defects by route group

| Route group | Route states | Defects |
| --- | ---: | ---: |
| Public and auth | 15 | 78 |
| Pulse | 17 | 1121 |
| Profiles and settings | 11 | 210 |
| Communities | 9 | 730 |
| Events and tickets | 18 | 420 |
| Official channel | 4 | 36 |
| University admin | 16 | 1060 |
| Platform admin | 5 | 236 |
| System states | 6 | 0 |

## Defects by width

| Width | Defects |
| ---: | ---: |
| 320px | 356 |
| 360px | 343 |
| 375px | 348 |
| 390px | 286 |
| 412px | 286 |
| 430px | 282 |
| 600px | 284 |
| 768px | 284 |
| 820px | 284 |
| 1024px | 286 |
| 1280px | 284 |
| 1440px | 284 |
| 1920px | 284 |

## Top 40 defects

| Route | State | Width | Theme | Rule | Selector / value | Screenshot |
| --- | --- | ---: | --- | --- | --- | --- |
| `/admin/reports/cmx0fex6t00hvmaamto0yt5xm` | report detail | 1024 | dark | Touch target under 44px | `div > div > div:nth-of-type(2) > div:nth-of-type(1) > a — 40×40 px, needs at least 44×44 · flex size-10 items-center justify-center` | — |
| `/admin/reports` | queue | 1024 | dark | Touch target under 44px | `div > div:nth-of-type(1) > header > div[role="group"]:nth-of-type(1) > a:nth-of-type(1) — 114×40 px, needs at least 44×44 · inline-flex h-10 items-center rounded-chip` | — |
| `/admin/settings` | university settings | 1024 | dark | Touch target under 44px | `div:nth-of-type(2) > section:nth-of-type(1) > div:nth-of-type(1) > div > button:nth-of-type(1) — 49×24 px, needs at least 44×44 · rounded-chip px-2.5 py-1 transition` | — |
| `/admin/students/cmx0fevnl001mmaamzqlcf8zp` | student drawer | 1024 | dark | Touch target under 44px | `div:nth-of-type(2) > ul > li > div > a — 50×20 px, needs at least 44×44 · font-semibold text-accent-ink hover:underline` | — |
| `/admin/students` | directory | 1024 | dark | Touch target under 44px | `div > div > div:nth-of-type(3) > nav > a:nth-of-type(4) — 36×44 px, needs at least 44×44 · relative inline-flex select-none items-center` | — |
| `/admin/team` | team | 1024 | dark | Touch target under 44px | `section:nth-of-type(1) > ul > li:nth-of-type(1) > form > button — 50×18 px, needs at least 44×44 · text-[0.75rem] font-semibold text-danger hover:underline` | — |
| `/admin/verification/cmx0fewuw001wmaam64v0tqhh` | verification detail | 1024 | dark | Touch target under 44px | `div > main > div > div > a — 69×40 px, needs at least 44×44 · inline-flex min-h-10 items-center gap-1.5` | — |
| `/admin` | overview | 1024 | dark | Touch target under 44px | `div > div:nth-of-type(2) > div:nth-of-type(1) > div > a — 49×20 px, needs at least 44×44 · text-small font-semibold text-accent-ink hover:underline` | — |
| `/c/software-engineering-hub/settings` | owner settings | 1024 | dark | Touch target under 44px | `div > main > section:nth-of-type(3) > div:nth-of-type(2) > textarea — 360×40 px, needs at least 44×44 · mt-1 resize-none bg-transparent text-small` | — |
| `/c/software-engineering-hub` | members | 1024 | dark | Touch target under 44px | `div > div:nth-of-type(3) > ul > li:nth-of-type(10) > button — 36×44 px, needs at least 44×44 · inline-flex min-h-11 shrink-0 items-center` | — |
| `/communities/new` | create | 1024 | dark | Touch target under 44px | `div > article > div:nth-of-type(1) > div > a — 167×20 px, needs at least 44×44 · line-clamp-1 font-display text-[0.9375rem] font-semibold` | — |
| `/compose?type=poll` | poll composer | 1024 | dark | Touch target under 44px | `#poll-duration — 91×32 px, needs at least 44×44 · h-8 rounded-full bg-accent-soft px-3` | — |
| `/compose?type=question` | question composer | 1024 | dark | Touch target under 44px | `#topic-tag — 640×40 px, needs at least 44×44 · h-10 rounded-[12px] border border-border` | — |
| `/drafts` | drafts | 1024 | dark | Touch target under 44px | `li > div > div:nth-of-type(1) > div > button — 40×40 px, needs at least 44×44 · -mr-2 -mt-1 flex size-10` | — |
| `/events/seed-event-cancelled` | cancelled | 1024 | dark | Touch target under 44px | `div > div:nth-of-type(2) > section:nth-of-type(2) > div:nth-of-type(1) > a — 89×20 px, needs at least 44×44 · text-small font-semibold text-accent-ink underline` | — |
| `/events/seed-event-past` | past | 1024 | dark | Touch target under 44px | `div > div:nth-of-type(2) > section:nth-of-type(2) > div:nth-of-type(1) > a — 89×20 px, needs at least 44×44 · text-small font-semibold text-accent-ink underline` | — |
| `/events/seed-event-scanner/dashboard` | organiser dashboard | 1024 | dark | Touch target under 44px | `main > div > div > div > a:nth-of-type(1) — 127×20 px, needs at least 44×44 · text-small font-semibold text-accent-ink underline` | — |
| `/events/seed-event-scanner/ticket` | ticket | 1024 | dark | Touch target under 44px | `main > div > div > div:nth-of-type(4) > a — 95×16 px, needs at least 44×44 · font-semibold underline underline-offset-4` | — |
| `/events/seed-event-updated` | materially updated | 1024 | dark | Touch target under 44px | `div > div > div:nth-of-type(2) > details > summary — 394×32 px, needs at least 44×44 · min-h-8 cursor-pointer list-none text-small` | — |
| `/events` | calendar | 1024 | dark | Touch target under 44px | `div:nth-of-type(3) > div > div > div:nth-of-type(1) > button:nth-of-type(1) — 40×40 px, needs at least 44×44 · inline-flex size-10 items-center justify-center` | — |
| `/official/a/seed-announcement-registration/edit` | edit | 320 | dark | Horizontal overflow | `div > main > div > form > fieldset:nth-of-type(1) — document 418px vs viewport 320px; widest edge 418px` | `32/11/shots/official-edit-320-dark.jpg` |
| `/official` | channel | 1024 | dark | Touch target under 44px | `div > div:nth-of-type(1) > section:nth-of-type(2) > div > a — 302×19 px, needs at least 44×44 · mt-0.5 line-clamp-2 text-small font-semibold` | — |
| `/p/4911ee7a-b0c4-4342-9407-bf5d5bc34bee` | public post preview | 1024 | dark | Touch target under 44px | `body > main > footer > a:nth-of-type(1) — 41×44 px, needs at least 44×44 · inline-flex min-h-11 items-center hover:text-fg` | — |
| `/platform` | overview | 1024 | dark | Touch target under 44px | `div > div:nth-of-type(2) > div:nth-of-type(1) > div > a — 63×20 px, needs at least 44×44 · text-small font-semibold text-accent-ink hover:underline` | — |
| `/profile/aisha_bello` | other profile | 1024 | dark | Touch target under 44px | `main > div > header > div > button — 40×40 px, needs at least 44×44 · flex size-10 items-center justify-center` | — |
| `/pulse` | all | 1024 | dark | Touch target under 44px | `div:nth-of-type(1) > div > section:nth-of-type(2) > div > a — 298×19 px, needs at least 44×44 · mt-0.5 line-clamp-2 text-small font-semibold` | — |
| `/search` | community search | 1024 | dark | Touch target under 44px | `div > main > div > div:nth-of-type(2) > button:nth-of-type(1) — 43×44 px, needs at least 44×44 · inline-flex min-h-11 items-center gap-1.5` | — |
| `/settings/about` | about | 1024 | dark | Touch target under 44px | `div > section:nth-of-type(2) > ul > li:nth-of-type(1) > a — 386×40 px, needs at least 44×44 · flex items-center gap-2.5 py-2.5` | — |
| `/settings/account` | account and sessions | 1024 | dark | Touch target under 44px | `div > div > section:nth-of-type(1) > details > summary — 386×20 px, needs at least 44×44 · cursor-pointer text-small font-semibold text-accent-ink` | — |
| `/settings/blocked` | blocked and muted | 1024 | dark | Touch target under 44px | `div > div > div > div[role="tablist"]:nth-of-type(1) > button[role="tab"]:nth-of-type(1) — 211×36 px, needs at least 44×44 · h-9 rounded-full text-small font-semibold` | — |
| `/signup` | find university | 1024 | dark | Touch target under 44px | `div > div:nth-of-type(2) > div > p > button — 113×20 px, needs at least 44×44 · font-semibold text-accent-ink underline-offset-2 hover:underline` | `32/11/shots/find-university-1024-dark.jpg` |
| `/admin/academic` | academic tree | 320 | dark | Clipped single-line text | `ul[role="group"] > li[role="treeitem"] > div > span:nth-of-type(1) > span:nth-of-type(1) — ellipsis hides 5px of 104px and nothing exposes the full text (add a title, or make the r` | — |
| `/admin/communities` | communities | 320 | dark | touch-spacing | `div > ul > li:nth-of-type(11) > div > div:nth-of-type(1) — 2px between ul > li:nth-of-type(11) > div > div:nth-of-type(1) > a and ul > li:nth-of-type(11) > div > div:nth-of-type(3)` | — |
| `/admin/reports` | queue | 1024 | dark | touch-spacing | `div > div > div:nth-of-type(1) > header > div[role="group"]:nth-of-type(2) — 6px between div > div:nth-of-type(1) > header > div[role="group"]:nth-of-type(2) > a:nth-of-type(1) and` | — |
| `/admin/students` | directory | 1024 | dark | touch-spacing | `main > div > div > div:nth-of-type(3) > nav — 6px between div > div > div:nth-of-type(3) > nav > a:nth-of-type(3) and div > div > div:nth-of-type(3) > nav > a:nth-of-type(4), needs` | — |
| `/c/software-engineering-hub` | members | 320 | dark | touch-spacing | `main > div > div:nth-of-type(3) > ul > li:nth-of-type(3) — 3px between div > div:nth-of-type(3) > ul > li:nth-of-type(3) > button and div:nth-of-type(2) > nav > ul > li:nth-of-type` | `32/11/shots/community-members-320-dark.jpg` |
| `/events/mine?tab=going` | going | 1024 | dark | Clipped single-line text | `li:nth-of-type(4) > article > div:nth-of-type(2) > div > span — ellipsis hides 64px of 125px and nothing exposes the full text (add a title, or make the row a link) · truncate text` | — |
| `/events/seed-event-scanner/dashboard` | organiser dashboard | 320 | dark | Clipped single-line text | `section:nth-of-type(3) > ul > li:nth-of-type(1) > div > p:nth-of-type(2) — ellipsis hides 129px of 304px and nothing exposes the full text (add a title, or make the row a link) · t` | — |
| `/events` | calendar | 320 | dark | touch-spacing | `div > div:nth-of-type(3) > div > div > div:nth-of-type(2) — 4px between div:nth-of-type(3) > div > div > div:nth-of-type(2) > button:nth-of-type(1) and div:nth-of-type(3) > div > d` | `32/11/shots/events-calendar-320-dark.jpg` |
| `/hashtag/csc204` | top | 375 | dark | touch-spacing | `article:nth-of-type(2) > div:nth-of-type(2) > div > div > p — 4px between div:nth-of-type(2) > div > div > p > a and div:nth-of-type(2) > nav > ul > li:nth-of-type(5) > a, needs at` | — |

_3851 more defects are in `summary.json`._

## Fetch the screenshots

```bash
git fetch origin ui-audit-results
git checkout origin/ui-audit-results -- 32/11
open 32/11/summary.md   # macOS; xdg-open on Linux
open 32/11/shots        # all JPEGs for this run
```

_Informational run: defects do not fail the PR unless the repository variable `UI_AUDIT_STRICT` is `true`. Infrastructure failures still fail the workflow._

## Distinct defects (deduplicated across widths and themes)

The run reported **3891** rows, which is **192** distinct problems: the same element at several widths is one fix.

| Rule | Distinct | Rows |
| --- | ---: | ---: |
| touch-target | 165 | 3707 |
| touch-spacing | 18 | 112 |
| clipped-text | 8 | 62 |
| horizontal-overflow | 1 | 10 |

Routes skipped because their seeded id could not be resolved: 0.
Route errors (navigation, missing actions, status codes): 0.
Per-page reporting caps reached (1 route/rule pairs): events-calendar · touch-target.

_Engine: `design/responsive-audit/run.mjs` — rules horizontal-overflow, masked-overflow, touch-target, touch-spacing, fixed-bar-collision, overlap, clipped-text, image-aspect, accessible-name, missing-label, layout-shift, contrast. Defects are informational unless `UI_AUDIT_STRICT` is true._
