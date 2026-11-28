# UI audit — ui/responsive-system

**2571 defects** across 2626 route states, 13 widths and both themes. Run took 4m 13s.

- Run: [#12](https://github.com/tita-n/konnekt-remake/actions/runs/46149341587)
- Commit: `c8f6b412c7f4`
- Results: `32/12` on `ui-audit-results`
- Images: 156 JPEGs (max 60 per run)
- Change vs previous run: this is the first recorded run for this PR.

## Defects by route group

| Route group | Route states | Defects |
| --- | ---: | ---: |
| Public and auth | 15 | 78 |
| Pulse | 17 | 1121 |
| Profiles and settings | 11 | 132 |
| Communities | 9 | 574 |
| Events and tickets | 18 | 342 |
| Official channel | 4 | 36 |
| University admin | 16 | 260 |
| Platform admin | 5 | 28 |
| System states | 6 | 0 |

## Defects by width

| Width | Defects |
| ---: | ---: |
| 320px | 256 |
| 360px | 242 |
| 375px | 246 |
| 390px | 185 |
| 412px | 184 |
| 430px | 180 |
| 600px | 182 |
| 768px | 182 |
| 820px | 182 |
| 1024px | 185 |
| 1280px | 182 |
| 1440px | 182 |
| 1920px | 183 |

## Top 40 defects

| Route | State | Width | Theme | Rule | Selector / value | Screenshot |
| --- | --- | ---: | --- | --- | --- | --- |
| `/admin/reports/cmx0fylpa00htp4tv2pgo9uxd` | report detail | 320 | dark | Touch target under 44px | `div > div > div:nth-of-type(2) > div:nth-of-type(1) > a — 16×44 px, needs at least 44×44 · flex size-11 items-center justify-center` | — |
| `/admin/reports` | queue | 1024 | dark | Touch target under 44px | `div > div:nth-of-type(1) > header > div[role="group"]:nth-of-type(1) > a:nth-of-type(1) — 114×40 px, needs at least 44×44 · inline-flex h-10 items-center rounded-chip` | — |
| `/admin/settings` | university settings | 1024 | dark | Touch target under 44px | `section:nth-of-type(2) > div > div:nth-of-type(2) > div > input — 283×36 px, needs at least 44×44 · h-9 rounded-input border border-border` | — |
| `/admin/students/cmx0fyjyy001mp4tvlnokb576` | student drawer | 1024 | dark | Touch target under 44px | `div:nth-of-type(2) > ul > li > div > a — 50×20 px, needs at least 44×44 · font-semibold text-accent-ink hover:underline` | — |
| `/admin/verification/cmx0fyldh001wp4tvskp4ob88` | verification detail | 1024 | dark | Touch target under 44px | `div > main > div > div > a — 69×40 px, needs at least 44×44 · inline-flex min-h-10 items-center gap-1.5` | — |
| `/admin` | overview | 1024 | dark | Touch target under 44px | `div > div:nth-of-type(2) > div:nth-of-type(1) > div > a — 49×20 px, needs at least 44×44 · text-small font-semibold text-accent-ink hover:underline` | — |
| `/c/software-engineering-hub` | members | 1024 | dark | Touch target under 44px | `div > div:nth-of-type(3) > ul > li:nth-of-type(10) > button — 36×36 px, needs at least 44×44 · inline-flex shrink-0 items-center justify-center` | — |
| `/communities/new` | create | 1024 | dark | Touch target under 44px | `div > article > div:nth-of-type(1) > div > a — 167×20 px, needs at least 44×44 · line-clamp-1 font-display text-[0.9375rem] font-semibold` | — |
| `/compose?type=poll` | poll composer | 1024 | dark | Touch target under 44px | `#poll-duration — 91×32 px, needs at least 44×44 · h-8 rounded-full bg-accent-soft px-3` | — |
| `/compose?type=question` | question composer | 1024 | dark | Touch target under 44px | `#topic-tag — 640×40 px, needs at least 44×44 · h-10 rounded-[12px] border border-border` | — |
| `/drafts` | drafts | 1024 | dark | Touch target under 44px | `li > div > div:nth-of-type(1) > div > button — 40×40 px, needs at least 44×44 · -mr-2 -mt-1 flex size-10` | — |
| `/events/seed-event-scanner/dashboard` | organiser dashboard | 1024 | dark | Touch target under 44px | `main > div > div > div > a:nth-of-type(1) — 127×20 px, needs at least 44×44 · text-small font-semibold text-accent-ink underline` | — |
| `/events/seed-event-scanner/ticket` | ticket | 1024 | dark | Touch target under 44px | `main > div > div > div:nth-of-type(4) > a — 95×16 px, needs at least 44×44 · font-semibold underline underline-offset-4` | — |
| `/events/seed-event-updated` | materially updated | 1024 | dark | Touch target under 44px | `div > div > div:nth-of-type(2) > details > summary — 394×32 px, needs at least 44×44 · min-h-8 cursor-pointer list-none text-small` | — |
| `/events` | calendar | 1024 | dark | Touch target under 44px | `div:nth-of-type(3) > div > div > div:nth-of-type(1) > button:nth-of-type(1) — 40×40 px, needs at least 44×44 · inline-flex size-10 items-center justify-center` | — |
| `/official/a/seed-announcement-registration/edit` | edit | 320 | dark | Horizontal overflow | `div > main > div > form > fieldset:nth-of-type(1) — document 418px vs viewport 320px; widest edge 418px` | — |
| `/official` | channel | 1024 | dark | Touch target under 44px | `div > div:nth-of-type(1) > section:nth-of-type(2) > div > a — 302×19 px, needs at least 44×44 · mt-0.5 line-clamp-2 text-small font-semibold` | — |
| `/p/55237b81-78b7-49d7-8bef-7cc5648b5658` | public post preview | 1024 | dark | Touch target under 44px | `body > main > footer > a:nth-of-type(1) — 41×44 px, needs at least 44×44 · inline-flex min-h-11 items-center hover:text-fg` | — |
| `/platform` | overview | 1024 | dark | Touch target under 44px | `div > div:nth-of-type(2) > div:nth-of-type(1) > div > a — 63×20 px, needs at least 44×44 · text-small font-semibold text-accent-ink hover:underline` | — |
| `/profile/aisha_bello` | other profile | 1024 | dark | Touch target under 44px | `main > div > header > div > button — 40×40 px, needs at least 44×44 · flex size-10 items-center justify-center` | — |
| `/pulse` | all | 1024 | dark | Touch target under 44px | `div:nth-of-type(1) > div > section:nth-of-type(2) > div > a — 298×19 px, needs at least 44×44 · mt-0.5 line-clamp-2 text-small font-semibold` | — |
| `/search` | community search | 1024 | dark | Touch target under 44px | `div > main > div > div:nth-of-type(2) > button:nth-of-type(1) — 43×44 px, needs at least 44×44 · inline-flex min-h-11 items-center gap-1.5` | — |
| `/settings/account` | account and sessions | 1024 | dark | Touch target under 44px | `div > div > section:nth-of-type(1) > details > summary — 386×20 px, needs at least 44×44 · cursor-pointer text-small font-semibold text-accent-ink` | — |
| `/settings/blocked` | blocked and muted | 1024 | dark | Touch target under 44px | `div > div > div > div[role="tablist"]:nth-of-type(1) > button[role="tab"]:nth-of-type(1) — 211×36 px, needs at least 44×44 · h-9 rounded-full text-small font-semibold` | — |
| `/signup` | find university | 1024 | dark | Touch target under 44px | `div > div:nth-of-type(2) > div > p > button — 113×20 px, needs at least 44×44 · font-semibold text-accent-ink underline-offset-2 hover:underline` | `32/12/shots/find-university-1024-dark.jpg` |
| `/admin/academic` | academic tree | 320 | dark | Clipped single-line text | `ul[role="group"] > li[role="treeitem"] > div > span:nth-of-type(1) > span:nth-of-type(1) — ellipsis hides 5px of 104px and nothing exposes the full text (add a title, or make the r` | — |
| `/admin/communities` | communities | 320 | dark | touch-spacing | `div > ul > li:nth-of-type(11) > div > div:nth-of-type(1) — 2px between ul > li:nth-of-type(11) > div > div:nth-of-type(1) > a and ul > li:nth-of-type(11) > div > div:nth-of-type(3)` | — |
| `/admin/reports` | queue | 1024 | dark | touch-spacing | `div > div > div:nth-of-type(1) > header > div[role="group"]:nth-of-type(2) — 6px between div > div:nth-of-type(1) > header > div[role="group"]:nth-of-type(2) > a:nth-of-type(1) and` | — |
| `/c/software-engineering-hub` | members | 320 | dark | touch-spacing | `main > div > div:nth-of-type(3) > ul > li:nth-of-type(3) — 3px between div > div:nth-of-type(3) > ul > li:nth-of-type(3) > button and div:nth-of-type(2) > nav > ul > li:nth-of-type` | `32/12/shots/community-members-320-dark.jpg` |
| `/events/mine?tab=going` | going | 1024 | dark | Clipped single-line text | `li:nth-of-type(4) > article > div:nth-of-type(2) > div > span — ellipsis hides 64px of 125px and nothing exposes the full text (add a title, or make the row a link) · truncate text` | — |
| `/events/seed-event-scanner/dashboard` | organiser dashboard | 320 | dark | Clipped single-line text | `section:nth-of-type(3) > ul > li:nth-of-type(1) > div > p:nth-of-type(2) — ellipsis hides 129px of 304px and nothing exposes the full text (add a title, or make the row a link) · t` | — |
| `/events` | calendar | 320 | dark | touch-spacing | `div > div:nth-of-type(3) > div > div > div:nth-of-type(2) — 4px between div:nth-of-type(3) > div > div > div:nth-of-type(2) > button:nth-of-type(1) and div:nth-of-type(3) > div > d` | `32/12/shots/events-calendar-320-dark.jpg` |
| `/hashtag/csc204` | top | 375 | dark | touch-spacing | `article:nth-of-type(2) > div:nth-of-type(2) > div > div > p — 4px between div:nth-of-type(2) > div > div > p > a and div:nth-of-type(2) > nav > ul > li:nth-of-type(5) > a, needs at` | — |
| `/platform` | overview | 320 | dark | Clipped single-line text | `div:nth-of-type(1) > ul > li:nth-of-type(2) > span:nth-of-type(1) > span:nth-of-type(2) — ellipsis hides 28px of 215px and nothing exposes the full text (add a title, or make the r` | — |
| `/pulse` | my department | 390 | dark | touch-spacing | `article:nth-of-type(1) > div:nth-of-type(2) > div > div > p — 4px between div:nth-of-type(2) > div > div > p > a and div:nth-of-type(2) > nav > ul > li:nth-of-type(3) > button, nee` | — |
| `/settings/privacy` | privacy settings | 360 | dark | touch-spacing | `div > div > form > section:nth-of-type(3) > label — 6px between div > form > section:nth-of-type(3) > label > input and div:nth-of-type(2) > nav > ul > li:nth-of-type(4) > a, needs` | `32/12/shots/settings-privacy-360-dark.jpg` |
| `/admin/reports/cmx0fylpa00htp4tv2pgo9uxd` | report detail | 320 | light | Touch target under 44px | `div > div > div:nth-of-type(2) > div:nth-of-type(1) > a — 16×44 px, needs at least 44×44 · flex size-11 items-center justify-center` | `32/12/shots/admin-report-detail-320-light.jpg` |
| `/admin/reports/cmx0fylpa00htp4tv2pgo9uxd` | report detail | 360 | dark | Touch target under 44px | `div > div > div:nth-of-type(2) > div:nth-of-type(1) > a — 40×44 px, needs at least 44×44 · flex size-11 items-center justify-center` | — |
| `/admin/reports/cmx0fylpa00htp4tv2pgo9uxd` | report detail | 360 | light | Touch target under 44px | `div > div > div:nth-of-type(2) > div:nth-of-type(1) > a — 40×44 px, needs at least 44×44 · flex size-11 items-center justify-center` | — |
| `/admin/reports` | queue | 1024 | dark | Touch target under 44px | `div > div:nth-of-type(1) > header > div[role="group"]:nth-of-type(1) > a:nth-of-type(2) — 123×40 px, needs at least 44×44 · inline-flex h-10 items-center rounded-chip` | — |

_2531 more defects are in `summary.json`._

## Fetch the screenshots

```bash
git fetch origin ui-audit-results
git checkout origin/ui-audit-results -- 32/12
open 32/12/summary.md   # macOS; xdg-open on Linux
open 32/12/shots        # all JPEGs for this run
```

_Informational run: defects do not fail the PR unless the repository variable `UI_AUDIT_STRICT` is `true`. Infrastructure failures still fail the workflow._

## Distinct defects (deduplicated across widths and themes)

The run reported **2571** rows, which is **144** distinct problems: the same element at several widths is one fix.

| Rule | Distinct | Rows |
| --- | ---: | ---: |
| touch-target | 117 | 2412 |
| touch-spacing | 18 | 87 |
| clipped-text | 8 | 62 |
| horizontal-overflow | 1 | 10 |

Routes skipped because their seeded id could not be resolved: 0.
Route errors (navigation, missing actions, status codes): 0.
Per-page reporting caps reached (1 route/rule pairs): events-calendar · touch-target.

_Engine: `design/responsive-audit/run.mjs` — rules horizontal-overflow, masked-overflow, touch-target, touch-spacing, fixed-bar-collision, overlap, clipped-text, image-aspect, accessible-name, missing-label, layout-shift, contrast. Defects are informational unless `UI_AUDIT_STRICT` is true._
