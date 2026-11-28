# UI audit — ui/responsive-system

**14075 defects** across 2626 route states, 13 widths and both themes. Run took 4m 59s.

- Run: [#9](https://github.com/tita-n/konnekt-remake/actions/runs/46144267609)
- Commit: `8756e037d68b`
- Results: `32/9` on `ui-audit-results`
- Images: 149 JPEGs (max 60 per run)
- Change vs previous run: this is the first recorded run for this PR.

## Defects by route group

| Route group | Route states | Defects |
| --- | ---: | ---: |
| Public and auth | 15 | 922 |
| Pulse | 17 | 2620 |
| Profiles and settings | 11 | 404 |
| Communities | 9 | 1340 |
| Events and tickets | 18 | 2916 |
| Official channel | 4 | 340 |
| University admin | 16 | 3797 |
| Platform admin | 5 | 1320 |
| System states | 6 | 416 |

## Defects by width

| Width | Defects |
| ---: | ---: |
| 320px | 1011 |
| 360px | 1009 |
| 375px | 1005 |
| 390px | 1000 |
| 412px | 998 |
| 430px | 974 |
| 600px | 937 |
| 768px | 1232 |
| 820px | 1225 |
| 1024px | 1219 |
| 1280px | 1160 |
| 1440px | 1153 |
| 1920px | 1152 |

## Top 40 defects

| Route | State | Width | Theme | Rule | Selector / value | Screenshot |
| --- | --- | ---: | --- | --- | --- | --- |
| `/` | welcome | 1024 | dark | Touch target under 44px | `div > div:nth-of-type(2) > footer > nav > a:nth-of-type(1) — 38×44 px, needs at least 44×44 · inline-flex min-h-11 items-center hover:text-fg` | — |
| `/account/deleted` | deleted | 1024 | dark | Touch target under 44px | `body > div:nth-of-type(2) > header > a:nth-of-type(1) — 119×36 px, needs at least 44×44 · flex items-center gap-2.5 rounded-button` | — |
| `/admin/academic` | academic tree | 1024 | dark | Touch target under 44px | `div:nth-of-type(2) > div > aside > nav > a:nth-of-type(1) — 215×40 px, needs at least 44×44 · flex items-center gap-2.5 rounded-button` | — |
| `/admin/academic` | academic tree | 320 | dark | Horizontal overflow | `div > div > div > div > div:nth-of-type(1) — document 449px vs viewport 320px; widest edge 449px · rounded-card border border-border bg-surface` | — |
| `/admin/announcements` | announcements | 1024 | dark | Touch target under 44px | `div:nth-of-type(2) > div > aside > nav > a:nth-of-type(1) — 215×40 px, needs at least 44×44 · flex items-center gap-2.5 rounded-button` | — |
| `/admin/announcements` | announcements | 320 | dark | Horizontal overflow | `div > div > div > header > a — document 331px vs viewport 320px; widest edge 331px · relative inline-flex select-none items-center` | — |
| `/admin/communities` | communities | 1024 | dark | Touch target under 44px | `div:nth-of-type(2) > div > aside > nav > a:nth-of-type(1) — 215×40 px, needs at least 44×44 · flex items-center gap-2.5 rounded-button` | — |
| `/admin/events` | event moderation | 1024 | dark | Touch target under 44px | `div > div > div > div:nth-of-type(2) > button:nth-of-type(1) — 43×36 px, needs at least 44×44 · min-h-9 rounded-chip border px-3` | — |
| `/admin/official` | official accounts | 1024 | dark | Touch target under 44px | `div:nth-of-type(2) > div > aside > nav > a:nth-of-type(1) — 215×40 px, needs at least 44×44 · flex items-center gap-2.5 rounded-button` | — |
| `/admin/places` | places | 1024 | dark | Touch target under 44px | `div:nth-of-type(2) > div > aside > nav > a:nth-of-type(1) — 215×40 px, needs at least 44×44 · flex items-center gap-2.5 rounded-button` | — |
| `/admin/reports/cmx0drknj00hv0ia6hvi0ot3y` | report detail | 1024 | dark | Touch target under 44px | `div > div > div:nth-of-type(2) > div:nth-of-type(1) > a — 40×40 px, needs at least 44×44 · flex size-10 items-center justify-center` | — |
| `/admin/reports` | queue | 1024 | dark | Touch target under 44px | `div > div:nth-of-type(1) > header > div[role="group"]:nth-of-type(1) > a:nth-of-type(1) — 114×40 px, needs at least 44×44 · inline-flex h-10 items-center rounded-chip` | — |
| `/admin/settings` | university settings | 1024 | dark | Touch target under 44px | `#uni-name — 373×40 px, needs at least 44×44 · h-10 rounded-input border border-border` | — |
| `/admin/students/cmx0drk4y001m0ia625pa238n/moderation` | moderation history | 1024 | dark | Touch target under 44px | `div > main > div > div > a — 77×20 px, needs at least 44×44 · inline-flex items-center gap-1.5 text-small` | — |
| `/admin/students/cmx0drk4y001m0ia625pa238n` | student drawer | 1024 | dark | Touch target under 44px | `div > main > div > div > a — 86×20 px, needs at least 44×44 · inline-flex items-center gap-1.5 text-small` | — |
| `/admin/students` | directory | 1024 | dark | Touch target under 44px | `div:nth-of-type(2) > div > aside > nav > a:nth-of-type(1) — 215×40 px, needs at least 44×44 · flex items-center gap-2.5 rounded-button` | — |
| `/admin/team` | team | 1024 | dark | Touch target under 44px | `div:nth-of-type(2) > div > aside > nav > a:nth-of-type(1) — 215×40 px, needs at least 44×44 · flex items-center gap-2.5 rounded-button` | — |
| `/admin/team` | team | 320 | dark | Horizontal overflow | `main > div > div > div > div — document 374px vs viewport 320px; widest edge 374px · space-y-4` | — |
| `/admin/verification/cmx0drk7n001w0ia6tri1ua59` | verification detail | 1024 | dark | Touch target under 44px | `div > div:nth-of-type(1) > div:nth-of-type(2) > div:nth-of-type(2) > button — 104×40 px, needs at least 44×44 · inline-flex min-h-10 items-center gap-1.5` | — |
| `/admin/verification` | review queue | 1024 | dark | Touch target under 44px | `#q — 362×40 px, needs at least 44×44 · h-10 rounded-input border border-border` | — |
| `/admin` | overview | 1024 | dark | Touch target under 44px | `div > div:nth-of-type(2) > div:nth-of-type(1) > div > a — 49×20 px, needs at least 44×44 · text-small font-semibold text-accent-ink hover:underline` | — |
| `/admin` | overview | 320 | dark | Horizontal overflow | `main > div > div > div:nth-of-type(2) > div:nth-of-type(1) — document 372px vs viewport 320px; widest edge 372px · rounded-card border border-border bg-surface` | — |
| `/c/book-and-film-club` | request to join | 1024 | dark | Touch target under 44px | `div > main > div > div:nth-of-type(1) > a — 40×40 px, needs at least 44×44 · glass absolute left-4 top-3` | — |
| `/c/book-and-film-club` | request to join | 320 | dark | fixed-bar-collision | `div:nth-of-type(3) > div:nth-of-type(1) > div > div > button — control centre 842px is under the bottom nav bar (779–844px) · relative inline-flex select-none items-center` | — |
| `/c/software-engineering-hub/settings` | owner settings | 1024 | dark | fixed-bar-collision | `main > section:nth-of-type(2) > div:nth-of-type(2) > label:nth-of-type(3) > input — control centre 829px is under the bottom div bar (827–900px) · mt-1 size-4 accent-[var(--accent)` | — |
| `/c/software-engineering-hub/settings` | owner settings | 1024 | dark | Touch target under 44px | `div > main > section:nth-of-type(3) > div:nth-of-type(2) > textarea — 360×40 px, needs at least 44×44 · mt-1 resize-none bg-transparent text-small` | — |
| `/c/software-engineering-hub/settings` | owner settings | 412 | dark | Overlapping fixed/sticky UI | `div > main > div > main > div — fixed bar overlaps body > div:nth-of-type(2) > nav by 1px of height · action-bar action-bar-fixed` | — |
| `/c/software-engineering-hub` | about | 1024 | dark | Touch target under 44px | `div > main > div > div:nth-of-type(1) > a — 40×40 px, needs at least 44×44 · glass absolute left-4 top-3` | — |
| `/c/software-engineering-hub` | about | 600 | dark | fixed-bar-collision | `section:nth-of-type(3) > ul > li:nth-of-type(1) > div > a — control centre 985px is under the bottom nav bar (959–1024px) · truncate text-small font-semibold text-fg` | — |
| `/communities/new` | create | 1024 | dark | Icon-only control without a name | `section:nth-of-type(5) > div > div > article > a — icon-only control has no accessible name · shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-` | — |
| `/communities/new` | create | 1024 | dark | Touch target under 44px | `div > article > div:nth-of-type(1) > div > a — 167×20 px, needs at least 44×44 · line-clamp-1 font-display text-[0.9375rem] font-semibold` | — |
| `/communities/new` | create | 320 | dark | fixed-bar-collision | `#_R_f55fiv5uabsdb_ — control centre 825px is under the bottom nav bar (779–844px) · rounded-input border px-3.5 text-body` | — |
| `/communities/new` | create | 412 | dark | Overlapping fixed/sticky UI | `div:nth-of-type(2) > div > main > div > div — fixed bar overlaps body > div:nth-of-type(2) > nav by 1px of height · action-bar action-bar-fixed` | — |
| `/communities` | hub | 320 | dark | fixed-bar-collision | `main > div > section > div:nth-of-type(3) > a:nth-of-type(4) — control centre 815px is under the bottom nav bar (779–844px) · flex min-h-[72px] items-center gap-3` | — |
| `/compose?type=poll` | poll composer | 1024 | dark | Touch target under 44px | `#poll-duration — 91×32 px, needs at least 44×44 · h-8 rounded-full bg-accent-soft px-3` | — |
| `/compose?type=question` | question composer | 1024 | dark | Touch target under 44px | `#topic-tag — 640×40 px, needs at least 44×44 · h-10 rounded-[12px] border border-border` | — |
| `/drafts` | drafts | 1024 | dark | Touch target under 44px | `div > main > div > header > a — 40×40 px, needs at least 44×44 · flex size-10 items-center justify-center` | — |
| `/events/mine?tab=going` | going | 1024 | dark | Icon-only control without a name | `div > ul > li:nth-of-type(1) > article > a — icon-only control has no accessible name · block focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus` | — |
| `/events/mine?tab=going` | going | 1024 | dark | Touch target under 44px | `ul > li:nth-of-type(1) > article > div:nth-of-type(2) > a — 79×36 px, needs at least 44×44 · inline-flex h-9 shrink-0 items-center` | — |
| `/events/mine?tab=going` | going | 320 | dark | Horizontal overflow | `div > main > div > div > div[role="tablist"] — document 324px vs viewport 320px; widest edge 324px · no-scrollbar -mx-4 flex gap-2` | — |

_14035 more defects are in `summary.json`._

## Fetch the screenshots

```bash
git fetch origin ui-audit-results
git checkout origin/ui-audit-results -- 32/9
open 32/9/summary.md   # macOS; xdg-open on Linux
open 32/9/shots        # all JPEGs for this run
```

_Informational run: defects do not fail the PR unless the repository variable `UI_AUDIT_STRICT` is `true`. Infrastructure failures still fail the workflow._

## Distinct defects (deduplicated across widths and themes)

The run reported **14075** rows, which is **875** distinct problems: the same element at several widths is one fix.

| Rule | Distinct | Rows |
| --- | ---: | ---: |
| touch-target | 628 | 11865 |
| fixed-bar-collision | 92 | 490 |
| clipped-text | 84 | 732 |
| touch-spacing | 28 | 238 |
| accessible-name | 23 | 591 |
| horizontal-overflow | 11 | 98 |
| overlap | 7 | 28 |
| image-aspect | 1 | 26 |
| layout-shift | 1 | 7 |

Routes skipped because their seeded id could not be resolved: 0.
Route errors (navigation, missing actions, status codes, reporting caps): 291.

_Engine: `design/responsive-audit/run.mjs` — rules horizontal-overflow, masked-overflow, touch-target, touch-spacing, fixed-bar-collision, overlap, clipped-text, image-aspect, accessible-name, missing-label, layout-shift, contrast. Defects are informational unless `UI_AUDIT_STRICT` is true._
