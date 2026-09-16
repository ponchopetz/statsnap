# Prototypes and Labs

StatSnap ships experimental features behind flags so `develop` stays clean.
This file tracks what is in LABS now, how to turn it on, and what graduated.

## Graduated in 1.1.0 (always on, no flag)

- **Compare** — `/compare?a=&b=&season=&as=&bs=`. Two players at one
  position, each with their own season, mirrored percentile bars, swap and
  copy-link. Rows come from `utils/headline.js` and `buildAdvancedRows`.
- **Splits** — SPLITS tab on the player page: venue, result, in/out of
  division, season halves, against a full-season baseline.
- **Leaderboards** — `/leaderboards`. Ranked by the ETL percentile through
  `GET /leaderboards`; seasons from `GET /seasons`; minimum-games filter.
- **Career Arc** — under the Career table: one stat across every loaded
  season with age under each point, in TOTALS mode (headline stats) or
  PERCENTILE mode (the ETL's cohort rank for an advanced metric; an
  unqualified season draws as a gap).

What is still open on those three lives in `docs/adr/DECISIONS.md`
("Compare, Splits, Leaderboards") and the CHANGELOG.

## Turning a LABS flag on

`frontend/src/utils/flags.js`, first match wins:

| Method | How | Scope |
|---|---|---|
| Demo link | open `/?labs=<name>,<name>` once; `/?labs=off` clears | this browser, persisted in `localStorage["statsnap:flags"]` |
| Build-time | `VITE_FLAG_<NAME>=true npm run build` | everyone who loads that build |
| Console | `localStorage.setItem("statsnap:flags", '{"<name>":true}')` then reload | this browser |

Flags are read at render time, so a change takes a page load. Enabled
prototypes appear in a LABS row under the landing search when they have a
page of their own; player-page prototypes appear in place.

## Current LABS prototypes

Enable all three for a browser with `/?labs=similar,form,shareCard`.
The landing LABS row lists whichever are on; each lives on the player page.

### Similar players (`similar`, plus `FEATURE_SIMILAR=true` on the API)

**What it does.** A PLAYS LIKE panel under the Advanced tab: the five
nearest percentile profiles in the same position cohort and season, each
linking straight into Compare.

**How it works.** `GET /players/:id/similar?season=&scope=season|all`
(registered before `/:playerId` so the two-segment path is not swallowed)
loads the cohort's `advanced` maps and ranks by weighted Euclidean distance
(EPA rates weigh 2, CPOE 1.5, everything else 1) normalised by total weight,
so a 3-metric overlap and a 7-metric overlap read on the same 0..1 scale.
`scope=all` drops the season filter, so a 2024 receiver can play like a 2019
one; each comp carries its season and the row links into Compare with
per-slot seasons. A player below the qualifier has no profile and the panel
says so. If the API does not expose the route, the panel renders nothing.

**Unfinished / next.** The weights are a constant; exposing them (or a
"volume vs efficiency" slider) is the next step. `scope=all` loads every
qualified season at the position (a few hundred small documents); fine
today, but a materialised percentile-vector collection would scale it.

### Form line (`form`)

**What it does.** A six-cell strip under the Overview stat row: the team's
record and the five chartable headline stats over the last four games against
the season average, tagged HOT or COLD on a 15%+ swing in the stat's own
direction (more interceptions is cold).

**How it works.** `utils/form.js` reads the same per-week series
`utils/headline.js` gives the sparkline, so the numbers agree with the chart.
The grid mirrors the stat row's six cells and breakpoints so the two rows
stay aligned.

**Unfinished / next.** The window is switchable (L3 / L4 / L6); the 15%
threshold is a constant. Rates are averaged per game here (that is what
"form" means), not ratio-of-sums.

### Share card (`shareCard`)

**What it does.** `/players/:id/card?season=`: a 1200×630 SVG card (name,
season, six headline stats, advanced percentile bars, jersey watermark) with
a DOWNLOAD PNG button. A CARD button appears in the player topbar.

**How it works.** Inline SVG rendered from the same headline and advanced
definitions, serialised and drawn onto a 2× canvas for the PNG. Before
serialising, `utils/embedFonts.js` fetches the Google Fonts stylesheet and
swaps each font file for a data URI in a `<style>` block, so the PNG uses
JetBrains Mono and Space Grotesk; if that fails the export still runs on
system fonts and the note under the card says so. There is no headshot on
purpose: a cross-origin image would taint the canvas and block the export.

**Unfinished / next.** Only the Latin subsets of the weights the card uses
are embedded (about 100 KB per export, cached per page load). A server-rendered card would let
the URL itself be shared as an image. Accent colour is read from the live
theme.

## Verification notes

- All suites (`TESTING.md`) cover the graduated features.
- The pages were exercised in the browser against a throwaway local `mongod`
  seeded by the real ETL for 2024 and 2023 (`.claude/launch.json` on this
  machine has `statsnap-backend-scratch` and `statsnap-frontend-scratch`
  entries on ports 3011 and 3010).
