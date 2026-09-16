# Prototypes (branch `proto/features`)

Three feature prototypes, each behind a flag that defaults **off**. With every
flag off the app is byte-for-byte the V1 behaviour: no new routes, no new
tabs, no new API surface. Nothing here calls a new external service, and
nothing touches the schedule cache or The Odds API.

## Turning flags on

**Frontend** (`frontend/src/utils/flags.js`), first match wins:

| Method | How | Scope |
|---|---|---|
| Demo link | open `/?labs=compare,splits,leaderboards` once; `/?labs=off` clears | this browser, persisted in `localStorage["statsnap:flags"]` |
| Build-time | `VITE_FLAG_COMPARE=true VITE_FLAG_SPLITS=true VITE_FLAG_LEADERBOARDS=true npm run build` | everyone who loads that build |
| Console | `localStorage.setItem("statsnap:flags", '{"compare":true}')` then reload | this browser |

Flags are read at render time and never subscribed to, so a change takes a
page load. Entry points appear only when a flag is on: a `LABS` row under the
landing search (Compare, Leaderboards), a `COMPARE` button in the player
topbar, and a `SPLITS` tab on the player page.

**Backend**: `FEATURE_LEADERBOARDS=true` in the environment mounts
`GET /leaderboards`. Unset or any other value leaves it unmounted, so the path
404s like any unknown route. Documented in `backend/.env.example`.

---

## 1. Compare — head-to-head (flag: `compare`)

**What it does.** `/compare?a=<playerId>&b=<playerId>&season=<year>`. Two
players at the same position, one season, side by side: the six headline
stats the Overview tab shows, then every advanced metric with mirrored
percentile bars and raw values. The better value on each row is highlighted;
"better" respects direction (fewer interceptions wins; sack metrics are
already inverted by the ETL's percentile). The URL is the share link.

**How it works.** Two calls to the existing `GET /players/:id`, no new
endpoint. `utils/compare.js` builds rows with the same `stats.js` helpers
Overview and the Advanced panel use, so a number on this page cannot disagree
with the player page. Season choices are the union of both players' seasons,
defaulting to the latest one they share; a player without that season shows a
placeholder rather than an error. Mismatched positions render both identity
cards and a notice instead of rows.

**Unfinished.**
- The headline row list is repeated from `OverviewQB/RB/Receiver` (values are
  shared, the list is not). Lifting those six-cell lists into a shared module
  is the right next step and would remove the last duplication.
- No swap button, no third player, no cross-season compare (Jefferson 2022 vs
  Chase 2024 is a legitimate football argument).
- Per-slot loading states are text only; no skeleton.
- At phone width the centre label truncates with an ellipsis for long
  metric names ("TARGET SHA…"); a two-line label or abbreviations would fix it.

**Next.** Lift the headline configs; add cross-season mode by making the
season a per-slot URL param (`aSeason`, `bSeason`); add a "share" affordance
that copies the URL.

---

## 2. Splits (flag: `splits`)

**What it does.** A `SPLITS` tab on the player page for the selected season:
home vs away, in wins vs in losses (ties shown only if any), weeks 1–9 vs
weeks 10+, each against a full-season baseline row. Per-position columns
include a per-game rate, a ratio-of-sums efficiency (CMP%, Y/A, target share)
and an EPA-per-play rate.

**How it works.** Entirely derived from the stored `weeks` array; no new data,
no new endpoint. `utils/splits.js` applies the season definition to a filtered
weeks array, which is the Career tab's synthetic-document idea one level down.
Two small rates that did not exist before (`YDS/G`, `Y/A`) are defined once in
that module.

**Unfinished.**
- No opponent or divisional splits (the weeks carry an opponent code, so
  "vs division" needs only a static division map).
- No day-of-week or primetime splits: the stored `gameday` has no kickoff
  time.
- The 1–9 / 10+ half boundary is fixed; the 17-week era is slightly uneven.
- No tests on this branch (the test suite lives on `test/suite`); the helpers
  are pure and trivially testable once the branches meet.

**Next.** Divisional and per-opponent splits, a percentile shading of each
split cell against the full-season value, and unit tests for `buildSplits`.

---

## 3. Leaderboards (flag: `leaderboards` + `FEATURE_LEADERBOARDS=true`)

**What it does.** `/leaderboards?season=&position=&metric=`. Top qualified
players for a season, position, and advanced metric, with the ETL percentile
bar and the raw season value. Rows link to the player page at that season.

**How it works.** New endpoint `GET /leaderboards` in
`backend/controllers/leaderboards.js`. It filters `playerstats` on
`{ season, position, "advanced.<metric>": { $exists } }` and sorts by the
stored percentile, so ordering has exactly one definition (`percentiles.py`)
and the API never re-derives a stat. The metric list on the page comes from
`ADVANCED_CONFIG` in `stats.js` (now exported), and the raw value column uses
that config's own formatter, so it matches the Advanced panel. Query params
are validated (season year, position enum, metric name shape, limit 1–100)
and return 400 with a message. Reads Mongo only; nothing upstream.

**Unfinished.**
- The seasons list is hardcoded (2016–2026 per the README). A tiny
  `GET /seasons` (distinct seasons in the collection) would replace it.
- Rows carry the full `weeks` array so the client can format the raw value;
  for the top 25 that is a few hundred kilobytes. A server-side season
  aggregate would be lighter but would put stat math in a third language
  (Mongo pipelines), which the one-definition rule argues against. Storing
  the Python season aggregates on the document at ETL time is the clean fix.
- No tests on this branch for the endpoint; the validation branches are the
  obvious supertest targets once merged with `test/suite`.
- Qualifier thresholds in the footnote are copied text (same as the Advanced
  panel), not read from config.

**Next.** `GET /seasons`; ETL-written season aggregates on the document (then
drop `weeks` from the response); a "minimum games" filter; team filter.

---

## Verification done on this branch

- `npm run lint` and `npm run build` pass in `frontend/`.
- All three prototypes were exercised in the browser against a throwaway
  local `mongod` seeded by running the real ETL for 2024 and 2023 with
  `MONGO_URI` pointed at that scratch instance. Production Atlas was never
  connected to.
- With all flags off, the landing page, player page, and 404 route render as
  before.
- The top-25 leaderboard response measured 356 KB because rows carry `weeks`
  (see the Leaderboards "Unfinished" list).
- A gitignored `.claude/launch.json` on this machine has `statsnap-backend-scratch`
  and `statsnap-frontend-scratch` entries that point at that scratch database
  on ports 3011 and 3010, if you want to repeat the walkthrough.
