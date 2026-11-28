# UI audit — ui/audit-probe

**25298 defects** across 2626 route states, 13 widths and both themes. Run took 11m 23s.

- Run: [#2](https://github.com/tita-n/konnekt-remake/actions/runs/46102959468)
- Commit: `1bf4010bece8`
- Results: `29/2` on `ui-audit-results`
- Images: 60 JPEGs (max 60 per run)
- Change vs previous run: this is the first recorded run for this PR.

## Defects by route group

| Route group | Route states | Defects |
| --- | ---: | ---: |
| Public and auth | 15 | 1422 |
| Pulse | 17 | 5214 |
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
| 360px | 1860 |
| 375px | 1850 |
| 390px | 1848 |
| 412px | 1842 |
| 430px | 1832 |
| 600px | 1808 |
| 768px | 1812 |
| 820px | 1815 |
| 1024px | 2210 |
| 1280px | 2184 |
| 1440px | 2180 |
| 1920px | 2180 |

## Top 40 defects

| Route | State | Width | Theme | Rule | Selector / value | Screenshot |
| --- | --- | ---: | --- | --- | --- | --- |
| `/` | welcome | 1024 | dark | Touch target under 44px | `div:nth-of-type(2) > div:nth-of-type(2) > footer > nav > a:nth-of-type(1) — 38×44 px, needs at least 44×44` | — |
| `/` | welcome | 1024 | dark | Touch target under 44px | `div:nth-of-type(2) > div:nth-of-type(2) > footer > nav > a:nth-of-type(2) — 43×44 px, needs at least 44×44` | — |
| `/` | welcome | 1024 | light | Touch target under 44px | `div:nth-of-type(2) > div:nth-of-type(2) > footer > nav > a:nth-of-type(1) — 38×44 px, needs at least 44×44` | `29/2/shots/welcome-1024-light.jpg` |
| `/` | welcome | 1024 | light | Touch target under 44px | `div:nth-of-type(2) > div:nth-of-type(2) > footer > nav > a:nth-of-type(2) — 43×44 px, needs at least 44×44` | `29/2/shots/welcome-1024-light.jpg` |
| `/` | welcome | 1280 | dark | Touch target under 44px | `div:nth-of-type(2) > div:nth-of-type(2) > footer > nav > a:nth-of-type(1) — 38×44 px, needs at least 44×44` | — |
| `/` | welcome | 1280 | dark | Touch target under 44px | `div:nth-of-type(2) > div:nth-of-type(2) > footer > nav > a:nth-of-type(2) — 43×44 px, needs at least 44×44` | — |
| `/` | welcome | 1280 | light | Touch target under 44px | `div:nth-of-type(2) > div:nth-of-type(2) > footer > nav > a:nth-of-type(1) — 38×44 px, needs at least 44×44` | `29/2/shots/welcome-1280-light.jpg` |
| `/` | welcome | 1280 | light | Touch target under 44px | `div:nth-of-type(2) > div:nth-of-type(2) > footer > nav > a:nth-of-type(2) — 43×44 px, needs at least 44×44` | `29/2/shots/welcome-1280-light.jpg` |
| `/` | welcome | 1440 | dark | Touch target under 44px | `div:nth-of-type(2) > div:nth-of-type(2) > footer > nav > a:nth-of-type(1) — 38×44 px, needs at least 44×44` | — |
| `/` | welcome | 1440 | dark | Touch target under 44px | `div:nth-of-type(2) > div:nth-of-type(2) > footer > nav > a:nth-of-type(2) — 43×44 px, needs at least 44×44` | — |
| `/` | welcome | 1440 | light | Touch target under 44px | `div:nth-of-type(2) > div:nth-of-type(2) > footer > nav > a:nth-of-type(1) — 38×44 px, needs at least 44×44` | `29/2/shots/welcome-1440-light.jpg` |
| `/` | welcome | 1440 | light | Touch target under 44px | `div:nth-of-type(2) > div:nth-of-type(2) > footer > nav > a:nth-of-type(2) — 43×44 px, needs at least 44×44` | `29/2/shots/welcome-1440-light.jpg` |
| `/` | welcome | 1920 | dark | Touch target under 44px | `div:nth-of-type(2) > div:nth-of-type(2) > footer > nav > a:nth-of-type(1) — 38×44 px, needs at least 44×44` | — |
| `/` | welcome | 1920 | dark | Touch target under 44px | `div:nth-of-type(2) > div:nth-of-type(2) > footer > nav > a:nth-of-type(2) — 43×44 px, needs at least 44×44` | — |
| `/` | welcome | 1920 | light | Touch target under 44px | `div:nth-of-type(2) > div:nth-of-type(2) > footer > nav > a:nth-of-type(1) — 38×44 px, needs at least 44×44` | `29/2/shots/welcome-1920-light.jpg` |
| `/` | welcome | 1920 | light | Touch target under 44px | `div:nth-of-type(2) > div:nth-of-type(2) > footer > nav > a:nth-of-type(2) — 43×44 px, needs at least 44×44` | `29/2/shots/welcome-1920-light.jpg` |
| `/` | welcome | 320 | dark | Horizontal overflow | `body > main > div:nth-of-type(1) — document 900px vs viewport 320px; widest edge 900px` | `29/2/shots/welcome-320-dark.jpg` |
| `/` | welcome | 320 | dark | Touch target under 44px | `div:nth-of-type(2) > div:nth-of-type(2) > footer > nav > a:nth-of-type(1) — 38×44 px, needs at least 44×44` | `29/2/shots/welcome-320-dark.jpg` |
| `/` | welcome | 320 | dark | Touch target under 44px | `div:nth-of-type(2) > div:nth-of-type(2) > footer > nav > a:nth-of-type(2) — 43×44 px, needs at least 44×44` | `29/2/shots/welcome-320-dark.jpg` |
| `/` | welcome | 320 | light | Horizontal overflow | `body > main > div:nth-of-type(1) — document 900px vs viewport 320px; widest edge 900px` | `29/2/shots/welcome-320-light.jpg` |
| `/` | welcome | 320 | light | Touch target under 44px | `div:nth-of-type(2) > div:nth-of-type(2) > footer > nav > a:nth-of-type(1) — 38×44 px, needs at least 44×44` | `29/2/shots/welcome-320-light.jpg` |
| `/` | welcome | 320 | light | Touch target under 44px | `div:nth-of-type(2) > div:nth-of-type(2) > footer > nav > a:nth-of-type(2) — 43×44 px, needs at least 44×44` | `29/2/shots/welcome-320-light.jpg` |
| `/` | welcome | 360 | dark | Horizontal overflow | `body > main > div:nth-of-type(1) — document 900px vs viewport 360px; widest edge 900px` | `29/2/shots/welcome-360-dark.jpg` |
| `/` | welcome | 360 | dark | Touch target under 44px | `div:nth-of-type(2) > div:nth-of-type(2) > footer > nav > a:nth-of-type(1) — 38×44 px, needs at least 44×44` | `29/2/shots/welcome-360-dark.jpg` |
| `/` | welcome | 360 | dark | Touch target under 44px | `div:nth-of-type(2) > div:nth-of-type(2) > footer > nav > a:nth-of-type(2) — 43×44 px, needs at least 44×44` | `29/2/shots/welcome-360-dark.jpg` |
| `/` | welcome | 360 | light | Horizontal overflow | `body > main > div:nth-of-type(1) — document 900px vs viewport 360px; widest edge 900px` | `29/2/shots/welcome-360-light.jpg` |
| `/` | welcome | 360 | light | Touch target under 44px | `div:nth-of-type(2) > div:nth-of-type(2) > footer > nav > a:nth-of-type(1) — 38×44 px, needs at least 44×44` | `29/2/shots/welcome-360-light.jpg` |
| `/` | welcome | 360 | light | Touch target under 44px | `div:nth-of-type(2) > div:nth-of-type(2) > footer > nav > a:nth-of-type(2) — 43×44 px, needs at least 44×44` | `29/2/shots/welcome-360-light.jpg` |
| `/` | welcome | 375 | dark | Horizontal overflow | `body > main > div:nth-of-type(1) — document 900px vs viewport 375px; widest edge 900px` | `29/2/shots/welcome-375-dark.jpg` |
| `/` | welcome | 375 | dark | Touch target under 44px | `div:nth-of-type(2) > div:nth-of-type(2) > footer > nav > a:nth-of-type(1) — 38×44 px, needs at least 44×44` | `29/2/shots/welcome-375-dark.jpg` |
| `/` | welcome | 375 | dark | Touch target under 44px | `div:nth-of-type(2) > div:nth-of-type(2) > footer > nav > a:nth-of-type(2) — 43×44 px, needs at least 44×44` | `29/2/shots/welcome-375-dark.jpg` |
| `/` | welcome | 375 | light | Horizontal overflow | `body > main > div:nth-of-type(1) — document 900px vs viewport 375px; widest edge 900px` | `29/2/shots/welcome-375-light.jpg` |
| `/` | welcome | 375 | light | Touch target under 44px | `div:nth-of-type(2) > div:nth-of-type(2) > footer > nav > a:nth-of-type(1) — 38×44 px, needs at least 44×44` | `29/2/shots/welcome-375-light.jpg` |
| `/` | welcome | 375 | light | Touch target under 44px | `div:nth-of-type(2) > div:nth-of-type(2) > footer > nav > a:nth-of-type(2) — 43×44 px, needs at least 44×44` | `29/2/shots/welcome-375-light.jpg` |
| `/` | welcome | 390 | dark | Horizontal overflow | `body > main > div:nth-of-type(1) — document 900px vs viewport 390px; widest edge 900px` | `29/2/shots/welcome-390-dark.jpg` |
| `/` | welcome | 390 | dark | Touch target under 44px | `div:nth-of-type(2) > div:nth-of-type(2) > footer > nav > a:nth-of-type(1) — 38×44 px, needs at least 44×44` | `29/2/shots/welcome-390-dark.jpg` |
| `/` | welcome | 390 | dark | Touch target under 44px | `div:nth-of-type(2) > div:nth-of-type(2) > footer > nav > a:nth-of-type(2) — 43×44 px, needs at least 44×44` | `29/2/shots/welcome-390-dark.jpg` |
| `/` | welcome | 390 | light | Horizontal overflow | `body > main > div:nth-of-type(1) — document 900px vs viewport 390px; widest edge 900px` | `29/2/shots/welcome-390-light.jpg` |
| `/` | welcome | 390 | light | Touch target under 44px | `div:nth-of-type(2) > div:nth-of-type(2) > footer > nav > a:nth-of-type(1) — 38×44 px, needs at least 44×44` | `29/2/shots/welcome-390-light.jpg` |
| `/` | welcome | 390 | light | Touch target under 44px | `div:nth-of-type(2) > div:nth-of-type(2) > footer > nav > a:nth-of-type(2) — 43×44 px, needs at least 44×44` | `29/2/shots/welcome-390-light.jpg` |

_25258 more defects are in `summary.json`._

## Fetch the screenshots

```bash
git fetch origin ui-audit-results
git checkout origin/ui-audit-results -- 29/2
open 29/2/summary.md   # macOS; xdg-open on Linux
open 29/2/shots        # all JPEGs for this run
```

_Informational run: defects do not fail the PR unless the repository variable `UI_AUDIT_STRICT` is `true`. Infrastructure failures still fail the workflow._

_Route errors: 0. Defects are informational unless UI_AUDIT_STRICT is true._
