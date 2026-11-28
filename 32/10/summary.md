# UI audit — ui/responsive-system

**6446 defects** across 2626 route states, 13 widths and both themes. Run took 4m 21s.

- Run: [#10](https://github.com/tita-n/konnekt-remake/actions/runs/46146343692)
- Commit: `9f1cb260b8ab`
- Results: `32/10` on `ui-audit-results`
- Images: 156 JPEGs (max 60 per run)
- Change vs previous run: this is the first recorded run for this PR.

## Defects by route group

| Route group | Route states | Defects |
| --- | ---: | ---: |
| Public and auth | 15 | 78 |
| Pulse | 17 | 1225 |
| Profiles and settings | 11 | 210 |
| Communities | 9 | 1042 |
| Events and tickets | 18 | 646 |
| Official channel | 4 | 152 |
| University admin | 16 | 2327 |
| Platform admin | 5 | 766 |
| System states | 6 | 0 |

## Defects by width

| Width | Defects |
| ---: | ---: |
| 320px | 526 |
| 360px | 524 |
| 375px | 524 |
| 390px | 466 |
| 412px | 464 |
| 430px | 462 |
| 600px | 464 |
| 768px | 504 |
| 820px | 502 |
| 1024px | 504 |
| 1280px | 502 |
| 1440px | 502 |
| 1920px | 502 |

## Top 40 defects

| Route | State | Width | Theme | Rule | Selector / value | Screenshot |
| --- | --- | ---: | --- | --- | --- | --- |
| `/admin/academic` | academic tree | 1024 | dark | Touch target under 44px | `li[role="treeitem"] > div > span:nth-of-type(2) > form:nth-of-type(1) > button — 28×28 px, needs at least 44×44 · flex size-7 items-center justify-center` | — |
| `/admin/academic` | academic tree | 320 | dark | Horizontal overflow | `div > div > div > div > div:nth-of-type(1) — document 449px vs viewport 320px; widest edge 449px · rounded-card border border-border bg-surface` | — |
| `/admin/announcements` | announcements | 320 | dark | Horizontal overflow | `div > div > div > header > a — document 331px vs viewport 320px; widest edge 331px · relative inline-flex select-none items-center` | — |
| `/admin/events` | event moderation | 1024 | dark | Touch target under 44px | `div > div > div > div:nth-of-type(2) > button:nth-of-type(1) — 43×44 px, needs at least 44×44 · min-h-11 rounded-chip border px-3` | — |
| `/admin/reports/cmx0eo2pn00hvp0au06fsqy9g` | report detail | 1024 | dark | Touch target under 44px | `div > div > div:nth-of-type(2) > div:nth-of-type(1) > a — 40×40 px, needs at least 44×44 · flex size-10 items-center justify-center` | — |
| `/admin/reports` | queue | 1024 | dark | Touch target under 44px | `div > div:nth-of-type(1) > header > div[role="group"]:nth-of-type(1) > a:nth-of-type(1) — 114×40 px, needs at least 44×44 · inline-flex h-10 items-center rounded-chip` | — |
| `/admin/settings` | university settings | 1024 | dark | Touch target under 44px | `#label-college — 279×40 px, needs at least 44×44 · h-10 rounded-input border border-border` | — |
| `/admin/students/cmx0eo0zd001mp0auv3qvvasd` | student drawer | 1024 | dark | Touch target under 44px | `div:nth-of-type(2) > ul > li > div > a — 50×20 px, needs at least 44×44 · font-semibold text-accent-ink hover:underline` | — |
| `/admin/students` | directory | 1024 | dark | Touch target under 44px | `table > tbody > tr:nth-of-type(1) > td:nth-of-type(1) > a — 16×16 px, needs at least 44×44 · flex size-4 items-center justify-center` | — |
| `/admin/team` | team | 1024 | dark | Touch target under 44px | `#invite-email — 266×40 px, needs at least 44×44 · h-10 rounded-input border border-border` | — |
| `/admin/team` | team | 320 | dark | Horizontal overflow | `main > div > div > div > div — document 374px vs viewport 320px; widest edge 374px · space-y-4` | — |
| `/admin/verification/cmx0eo2dl001wp0aulmej1kxy` | verification detail | 1024 | dark | Touch target under 44px | `div > div:nth-of-type(1) > div:nth-of-type(2) > div:nth-of-type(2) > a — 134×40 px, needs at least 44×44 · inline-flex min-h-10 items-center gap-1.5` | — |
| `/admin/verification` | review queue | 1024 | dark | Touch target under 44px | `#q — 362×40 px, needs at least 44×44 · h-10 rounded-input border border-border` | — |
| `/admin` | overview | 1024 | dark | Touch target under 44px | `div > div:nth-of-type(2) > div:nth-of-type(1) > div > a — 49×20 px, needs at least 44×44 · text-small font-semibold text-accent-ink hover:underline` | — |
| `/admin` | overview | 320 | dark | Horizontal overflow | `main > div > div > div:nth-of-type(2) > div:nth-of-type(1) — document 372px vs viewport 320px; widest edge 372px · rounded-card border border-border bg-surface` | — |
| `/c/software-engineering-hub/settings` | owner settings | 1024 | dark | Touch target under 44px | `div > main > section:nth-of-type(3) > div:nth-of-type(2) > textarea — 360×40 px, needs at least 44×44 · mt-1 resize-none bg-transparent text-small` | — |
| `/c/software-engineering-hub` | members | 1024 | dark | Touch target under 44px | `div > div:nth-of-type(3) > ul > li:nth-of-type(10) > button — 36×44 px, needs at least 44×44 · inline-flex min-h-11 shrink-0 items-center` | — |
| `/communities/new` | create | 1024 | dark | Touch target under 44px | `div > article > div:nth-of-type(1) > div > a — 167×20 px, needs at least 44×44 · line-clamp-1 font-display text-[0.9375rem] font-semibold` | — |
| `/compose?type=poll` | poll composer | 1024 | dark | Touch target under 44px | `#poll-duration — 91×32 px, needs at least 44×44 · h-8 rounded-full bg-accent-soft px-3` | — |
| `/compose?type=question` | question composer | 1024 | dark | Touch target under 44px | `#topic-tag — 640×40 px, needs at least 44×44 · h-10 rounded-[12px] border border-border` | — |
| `/drafts` | drafts | 1024 | dark | Touch target under 44px | `li > div > div:nth-of-type(1) > div > button — 40×40 px, needs at least 44×44 · -mr-2 -mt-1 flex size-10` | — |
| `/events/new` | create event | 1024 | dark | Touch target under 44px | `#event-place — 396×40 px, needs at least 44×44 · min-h-10 rounded-button border border-border` | — |
| `/events/seed-event-cancelled` | cancelled | 1024 | dark | Touch target under 44px | `div > div:nth-of-type(2) > section:nth-of-type(2) > div:nth-of-type(1) > a — 89×20 px, needs at least 44×44 · text-small font-semibold text-accent-ink underline` | — |
| `/events/seed-event-past` | past | 1024 | dark | Touch target under 44px | `div > div:nth-of-type(2) > section:nth-of-type(2) > div:nth-of-type(1) > a — 89×20 px, needs at least 44×44 · text-small font-semibold text-accent-ink underline` | — |
| `/events/seed-event-scanner/dashboard` | organiser dashboard | 1024 | dark | Touch target under 44px | `div > div > section:nth-of-type(3) > div[role="group"]:nth-of-type(3) > button:nth-of-type(1) — 41×44 px, needs at least 44×44 · min-h-11 shrink-0 rounded-chip border` | — |
| `/events/seed-event-scanner/ticket` | ticket | 1024 | dark | Touch target under 44px | `main > div > div > div:nth-of-type(4) > a — 95×16 px, needs at least 44×44 · font-semibold underline underline-offset-4` | — |
| `/events/seed-event-updated/edit` | edit event | 1024 | dark | Touch target under 44px | `#event-place — 396×40 px, needs at least 44×44 · min-h-10 rounded-button border border-border` | — |
| `/events/seed-event-updated` | materially updated | 1024 | dark | Touch target under 44px | `div > div > div:nth-of-type(2) > details > summary — 394×32 px, needs at least 44×44 · min-h-8 cursor-pointer list-none text-small` | — |
| `/events` | calendar | 1024 | dark | Touch target under 44px | `div > main > div > div[role="group"]:nth-of-type(2) > button:nth-of-type(1) — 43×44 px, needs at least 44×44 · min-h-11 shrink-0 rounded-chip border` | — |
| `/hashtag/csc204?sort=latest` | latest | 1024 | dark | Touch target under 44px | `main > div > div:nth-of-type(1) > div[role="group"]:nth-of-type(2) > a:nth-of-type(1) — 209×36 px, needs at least 44×44 · flex h-9 items-center justify-center` | — |
| `/hashtag/csc204` | top | 1024 | dark | Touch target under 44px | `main > div > div:nth-of-type(1) > div[role="group"]:nth-of-type(2) > a:nth-of-type(1) — 209×36 px, needs at least 44×44 · flex h-9 items-center justify-center` | — |
| `/official/a/seed-announcement-registration/edit` | edit | 1024 | dark | Touch target under 44px | `main > div > form > header > a — 51×20 px, needs at least 44×44 · mt-1 text-small font-semibold text-fg-muted` | — |
| `/official/a/seed-announcement-registration/edit` | edit | 320 | dark | Horizontal overflow | `div > main > div > form > fieldset:nth-of-type(1) — document 418px vs viewport 320px; widest edge 418px` | — |
| `/official/compose` | compose | 1024 | dark | Touch target under 44px | `main > div > form > header > a — 51×20 px, needs at least 44×44 · mt-1 text-small font-semibold text-fg-muted` | — |
| `/official` | channel | 1024 | dark | Touch target under 44px | `div > div:nth-of-type(1) > section:nth-of-type(2) > div > a — 302×19 px, needs at least 44×44 · mt-0.5 line-clamp-2 text-small font-semibold` | — |
| `/p/d9a9fe07-e126-478b-b54f-619266e58f9e` | public post preview | 1024 | dark | Touch target under 44px | `body > main > footer > a:nth-of-type(1) — 41×44 px, needs at least 44×44 · inline-flex min-h-11 items-center hover:text-fg` | — |
| `/platform/audit` | audit log | 1024 | dark | Touch target under 44px | `#action — 451×40 px, needs at least 44×44 · h-10 rounded-input border border-border` | — |
| `/platform/universities/cmx0eo0xo0000p0au3kn6358f` | university detail | 1024 | dark | Touch target under 44px | `#admin-email — 253×40 px, needs at least 44×44 · h-10 rounded-input border border-border` | — |
| `/platform/universities` | universities | 1024 | dark | Touch target under 44px | `#new-accent — 273×40 px, needs at least 44×44 · h-10 rounded-input border border-border` | — |
| `/platform/universities` | universities | 320 | dark | Horizontal overflow | `main > div > div > div > div:nth-of-type(1) — document 395px vs viewport 320px; widest edge 395px · space-y-3` | — |

_6406 more defects are in `summary.json`._

## Fetch the screenshots

```bash
git fetch origin ui-audit-results
git checkout origin/ui-audit-results -- 32/10
open 32/10/summary.md   # macOS; xdg-open on Linux
open 32/10/shots        # all JPEGs for this run
```

_Informational run: defects do not fail the PR unless the repository variable `UI_AUDIT_STRICT` is `true`. Infrastructure failures still fail the workflow._

## Distinct defects (deduplicated across widths and themes)

The run reported **6446** rows, which is **304** distinct problems: the same element at several widths is one fix.

| Rule | Distinct | Rows |
| --- | ---: | ---: |
| touch-target | 265 | 6066 |
| touch-spacing | 23 | 266 |
| horizontal-overflow | 7 | 42 |
| clipped-text | 5 | 48 |
| overlap | 2 | 3 |
| image-aspect | 1 | 14 |
| layout-shift | 1 | 7 |

Routes skipped because their seeded id could not be resolved: 0.
Route errors (navigation, missing actions, status codes): 0.
Per-page reporting caps reached (3 route/rule pairs): events-calendar · touch-target, admin-students · touch-target, admin-academic · touch-target.

_Engine: `design/responsive-audit/run.mjs` — rules horizontal-overflow, masked-overflow, touch-target, touch-spacing, fixed-bar-collision, overlap, clipped-text, image-aspect, accessible-name, missing-label, layout-shift, contrast. Defects are informational unless `UI_AUDIT_STRICT` is true._
