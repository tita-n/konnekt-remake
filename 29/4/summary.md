# UI audit — ui/audit-probe

**25297 defects** across 2626 route states, 13 widths and both themes. Run took 11m 40s.

- Run: [#4](https://github.com/tita-n/konnekt-remake/actions/runs/46104536040)
- Commit: `5a7e599e6fa0`
- Results: `29/4` on `ui-audit-results`
- Images: 60 JPEGs (max 60 per run)
- Change vs previous run: this is the first recorded run for this PR.

## Defects by route group

| Route group | Route states | Defects |
| --- | ---: | ---: |
| Public and auth | 15 | 1422 |
| Pulse | 17 | 5213 |
| Profiles and settings | 11 | 2654 |
| Communities | 9 | 1858 |
| Events and tickets | 18 | 6396 |
| Official channel | 4 | 556 |
| University admin | 16 | 5337 |
| Platform admin | 5 | 1384 |
| System states | 6 | 477 |

## Defects by width

| Width | Defects |
| ---: | ---: |
| 320px | 1877 |
| 360px | 1861 |
| 375px | 1852 |
| 390px | 1850 |
| 412px | 1843 |
| 430px | 1829 |
| 600px | 1809 |
| 768px | 1811 |
| 820px | 1811 |
| 1024px | 2210 |
| 1280px | 2184 |
| 1440px | 2180 |
| 1920px | 2180 |

## Top 40 defects

| Route | State | Width | Theme | Rule | Selector / value | Screenshot |
| --- | --- | ---: | --- | --- | --- | --- |
| `/` | welcome | 1024 | dark | Touch target under 44px | `div:nth-of-type(2) > div:nth-of-type(2) > footer > nav > a:nth-of-type(1) — 38×44 px, needs at least 44×44` | — |
| `/` | welcome | 320 | dark | Horizontal overflow | `body > main > div:nth-of-type(1) — document 900px vs viewport 320px; widest edge 900px` | `29/4/shots/welcome-320-dark.jpg` |
| `/account/deleted` | deleted | 1024 | dark | Touch target under 44px | `body > div:nth-of-type(2) > header > a:nth-of-type(1) — 119×36 px, needs at least 44×44` | — |
| `/admin/academic` | academic tree | 1024 | dark | Touch target under 44px | `body > div:nth-of-type(2) > div > aside > a — 199×32 px, needs at least 44×44` | — |
| `/admin/academic` | academic tree | 320 | dark | Horizontal overflow | `div > div > div > div > div:nth-of-type(1) — document 449px vs viewport 320px; widest edge 449px` | — |
| `/admin/announcements` | announcements | 1024 | dark | Touch target under 44px | `body > div:nth-of-type(2) > div > aside > a — 199×32 px, needs at least 44×44` | — |
| `/admin/announcements` | announcements | 320 | dark | Horizontal overflow | `div > div > div > header > a — document 331px vs viewport 320px; widest edge 331px` | — |
| `/admin/communities` | communities | 1024 | dark | Touch target under 44px | `body > div:nth-of-type(2) > div > aside > a — 199×32 px, needs at least 44×44` | — |
| `/admin/events` | event moderation | 1024 | dark | Touch target under 44px | `body > div:nth-of-type(2) > div > aside > a — 199×32 px, needs at least 44×44` | — |
| `/admin/official` | official accounts | 1024 | dark | Touch target under 44px | `body > div:nth-of-type(2) > div > aside > a — 199×32 px, needs at least 44×44` | — |
| `/admin/places` | places | 1024 | dark | Touch target under 44px | `body > div:nth-of-type(2) > div > aside > a — 199×32 px, needs at least 44×44` | — |
| `/admin/reports/cmwzverww00htoxds79dt0rkh` | report detail | 1024 | dark | Touch target under 44px | `body > div:nth-of-type(2) > div > aside > a — 199×32 px, needs at least 44×44` | — |
| `/admin/reports` | queue | 1024 | dark | Touch target under 44px | `body > div:nth-of-type(2) > div > aside > a — 199×32 px, needs at least 44×44` | — |
| `/admin/settings` | university settings | 1024 | dark | Touch target under 44px | `body > div:nth-of-type(2) > div > aside > a — 199×32 px, needs at least 44×44` | — |
| `/admin/students/cmwzveq6p001moxdsik8v7adc/moderation` | moderation history | 1024 | dark | Touch target under 44px | `body > div:nth-of-type(2) > div > aside > a — 199×32 px, needs at least 44×44` | — |
| `/admin/students/cmwzveq6p001moxdsik8v7adc` | student drawer | 1024 | dark | Touch target under 44px | `body > div:nth-of-type(2) > div > aside > a — 199×32 px, needs at least 44×44` | — |
| `/admin/students` | directory | 1024 | dark | Contrast below WCAG AA | `table > tbody > tr:nth-of-type(2) > td:nth-of-type(6) > span — 1.14:1, needs 4.5:1` | — |
| `/admin/students` | directory | 1024 | dark | Touch target under 44px | `body > div:nth-of-type(2) > div > aside > a — 199×32 px, needs at least 44×44` | — |
| `/admin/team` | team | 1024 | dark | Touch target under 44px | `body > div:nth-of-type(2) > div > aside > a — 199×32 px, needs at least 44×44` | — |
| `/admin/team` | team | 320 | dark | Horizontal overflow | `main > div > div > div > div — document 374px vs viewport 320px; widest edge 374px` | — |
| `/admin/verification/cmwzverjz001woxdsj6293nb4` | verification detail | 1024 | dark | Touch target under 44px | `body > div:nth-of-type(2) > div > aside > a — 199×32 px, needs at least 44×44` | — |
| `/admin/verification` | review queue | 1024 | dark | Touch target under 44px | `body > div:nth-of-type(2) > div > aside > a — 199×32 px, needs at least 44×44` | — |
| `/admin` | overview | 1024 | dark | Touch target under 44px | `body > div:nth-of-type(2) > div > aside > a — 199×32 px, needs at least 44×44` | — |
| `/admin` | overview | 320 | dark | Horizontal overflow | `main > div > div > div:nth-of-type(2) > div:nth-of-type(1) — document 372px vs viewport 320px; widest edge 372px` | — |
| `/bookmarks?type=POST` | posts | 1024 | dark | Touch target under 44px | `article > div:nth-of-type(1) > div:nth-of-type(1) > div:nth-of-type(1) > a — 111×23 px, needs at least 44×44` | — |
| `/bookmarks?type=QUESTION` | questions | 1024 | dark | Touch target under 44px | `div > section > ul > li:nth-of-type(1) > a — 248×40 px, needs at least 44×44` | — |
| `/bookmarks` | all | 1024 | dark | Touch target under 44px | `article > div:nth-of-type(1) > div:nth-of-type(1) > div:nth-of-type(1) > a — 111×23 px, needs at least 44×44` | — |
| `/c/book-and-film-club` | request to join | 1024 | dark | Touch target under 44px | `div > main > div > div:nth-of-type(1) > a — 40×40 px, needs at least 44×44` | — |
| `/c/senate-house-residents` | invite only | 1024 | dark | Touch target under 44px | `div > section > ul > li:nth-of-type(1) > a — 248×40 px, needs at least 44×44` | — |
| `/c/software-engineering-hub/settings` | owner settings | 1024 | dark | Touch target under 44px | `div > main > section:nth-of-type(3) > div:nth-of-type(2) > textarea — 360×40 px, needs at least 44×44` | — |
| `/c/software-engineering-hub` | about | 1024 | dark | Touch target under 44px | `div > main > div > div:nth-of-type(1) > a — 40×40 px, needs at least 44×44` | — |
| `/communities/new` | create | 1024 | dark | Icon-only control without a name | `section:nth-of-type(5) > div > div > article > a — icon-only control has no accessible name` | — |
| `/communities/new` | create | 1024 | dark | Touch target under 44px | `div > article > div:nth-of-type(1) > div > a — 167×20 px, needs at least 44×44` | — |
| `/communities` | hub | 1024 | dark | Touch target under 44px | `div > section > ul > li:nth-of-type(1) > a — 248×40 px, needs at least 44×44` | — |
| `/compose?type=poll` | poll composer | 1024 | dark | Touch target under 44px | `#poll-duration — 91×32 px, needs at least 44×44` | — |
| `/compose?type=question` | question composer | 1024 | dark | Touch target under 44px | `#composer-camera — 1×1 px, needs at least 44×44` | — |
| `/compose` | post composer | 1024 | dark | Touch target under 44px | `#composer-camera — 1×1 px, needs at least 44×44` | — |
| `/drafts` | drafts | 1024 | dark | Touch target under 44px | `div > main > div > header > a — 40×40 px, needs at least 44×44` | — |
| `/events/mine?tab=going` | going | 1024 | dark | Icon-only control without a name | `div > ul > li:nth-of-type(1) > article > a — icon-only control has no accessible name` | — |
| `/events/mine?tab=going` | going | 1024 | dark | Touch target under 44px | `div > section > ul > li:nth-of-type(1) > a — 248×40 px, needs at least 44×44` | — |

_25257 more defects are in `summary.json`._

## Fetch the screenshots

```bash
git fetch origin ui-audit-results
git checkout origin/ui-audit-results -- 29/4
open 29/4/summary.md   # macOS; xdg-open on Linux
open 29/4/shots        # all JPEGs for this run
```

_Informational run: defects do not fail the PR unless the repository variable `UI_AUDIT_STRICT` is `true`. Infrastructure failures still fail the workflow._

_Route errors: 0. Defects are informational unless UI_AUDIT_STRICT is true._
