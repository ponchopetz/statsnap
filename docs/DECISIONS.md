# StatSnap — Architecture Decision Record

Lightweight ADR log. Each entry records the decision, why it was made, and any
scope, tradeoff, or validation worth remembering. Grouped by concern; within a
group, foundational decisions come first and later chunks build on them.

---

## Data & schema

### One document per player-season, weeks embedded

Decision: Each MongoDB document represents one player's full season — identity
fields at the top level, weekly stats embedded as a `weeks` array — rather than
one document per player-week. Single collection, `playerstats`.

Why: The player page is the core UI, and it always needs identity, season
context, and the full game log together. One document per season means a single
`findOne` by `playerId` + `season` returns everything in the shape the frontend
maps over. One document per week would mean fetching and reassembling up to 17
documents per request.

Tradeoff: Cross-player single-week queries (e.g. "highest target share in Week
7") require `$unwind` to flatten the embedded weeks back out. Accepted because
week-level leaderboards are explicitly out of scope for V1. If they become a V2
feature, the options are a separate flat collection or an `$unwind` pipeline.

### Search deduplication via aggregation pipeline

Decision: `GET /players/search` runs an aggregation pipeline
(`$match → $sort → $group with $first → $project → $limit`) to return one row
per player, showing the most recent season's team.

Why: Because the schema stores one document per player-season, a raw search
would return a player once per loaded season. The `$group` with `$first` (after
a most-recent-first `$sort`) collapses those into a single row carrying the
latest team. Documented in the Obsidian vault with an interview talking point.

### Database name in code, not the URI

Decision: `utils/db.js` passes `{ dbName: 'statsnap' }` as a connect option
rather than embedding the database name in the connection string.

Why: Keeps the URI focused on cluster and auth, and makes the database name a
deliberate, visible choice in code rather than a buried URL segment.

---

## Data sourcing & ETL

### Schedule data source: nflverse, not The Odds API

Decision: Matchup, kickoff, and scoring context come from nflverse
(`load_schedules`), not The Odds API. The Odds API stays parked for V2 betting
lines.

Why: The Odds API events endpoint returns only `home_team`, `away_team`, and
`commence_time`. nflverse gives matchup, kickoff, and final scores in one pull
with no rate limit. There is no reason to spend API credits on a thinner feed.

### Tank01 powers identity, nflverse powers stats

Decision: Player identity (headshot, jersey, height/weight, college, draft, age)
is Tank01's responsibility; all stats are nflverse's. In the current state,
identity is temporarily pulled from nflverse rosters/draft via the ETL; the
Tank01 swap happens later to satisfy the live-third-party-API requirement.

Why: Tank01's free tier does not expose target share, air yards, snap %, or
route participation, and nflverse does not aim to be an identity source.
Splitting sources by responsibility prevents ambiguity in the data layer.

### Per-week game context via load_schedules pivot join

Decision: Derive per-week game context (`homeAway`, `teamScore`,
`opponentScore`, `gameday`, `overtime`, `result`) by joining `load_schedules`
onto the per-week player stats. `opponent` comes directly from the
`opponent_team` column already present in `load_player_stats`, not re-derived
from schedules.

Why: `load_schedules` stores one row per game with `home_`/`away_` prefixed
columns; the stats are keyed per team per week. The join expands each schedule
row into two — one from the home team's perspective, one from the away team's —
then joins on `[season, week, team]`. This pivot reshapes schedules to match the
stats grain and sidesteps conditional "is this player home or away" logic at
join time. It mirrors nflverse's own `clean_homeaway` approach.

Storage: `result` is stored as a string ("W"/"L"/"T") only. The numeric margin
is recoverable as `teamScore - opponentScore`, so storing it separately would
duplicate data.

Validation: A sanity check compares the schedules-derived opponent against
`opponent_team` and warns on any mismatch. Zero mismatches across 2022 to 2024.
Spot-checked against pro-football-reference: Purdy 2024 W1, Barkley 2024 W6
(plus correct bye-week skip at W5), Flowers 2023 W12 — all correct.

Alternative considered: a conditional join on `[season, week]` returning all
games for the week, then filtering to the row where the player's team matches
home or away. Rejected as harder to read than the pivot.

### ETL idempotency: schema changes are loader re-runs

Decision: `load.py` writes with a bulk upsert (`UpdateOne` with `$set`,
`upsert=True`) keyed on `{ playerId, season }`. Adding fields means editing the
column lists (`KEEP_COLUMNS`, `RENAME_MAP`, `WEEK_FIELDS`) and re-running the
loader per season — no separate migration script.

Why: `$set` replaces every document's fields wholesale on each run, so a re-run
is safe and non-destructive. Proven in Chunk 13 (18 counting-stat fields added
across three seasons) and again in Chunk 14c (seven game-context fields).

---

## Stat computation contract

### One stat, one definition — ratio-of-sums aggregation

Decision: Every stat has exactly one definition, implemented once and reused.
Season-level rates are computed as ratio-of-sums, not as the mean of per-week
rates. Completion % is `sum(completions) / sum(attempts)`. EPA rates are
`sum(weekly EPA) / sum(the correct denominator)` — attempts for passing, carries
for rushing, targets for receiving — with null-EPA weeks excluded from both
numerator and denominator.

Why: This was the back half of Chunk 15. The same stat computed independently in
two tabs drifted: passing EPA read +11.4 on Overview and +0.30 on Advanced. Two
root causes recurred and are worth remembering:

1. The weekly `passingEpa`/`rushingEpa`/`receivingEpa` fields in Mongo are
   per-game cumulative EPA totals, not per-play rates. Averaging weekly totals
   produces neither a per-play rate nor a season total. The correct season rate
   is ratio-of-sums over the play-count denominator.
2. A new persisted field must be declared in three independent layers or it
   silently vanishes: the Python ETL writes it, the Mongoose schema must declare
   it (or it is stripped on hydration), and the controller projection must
   allowlist it. The `advanced` map was invisible until both the schema and the
   projection were updated.

The JS season helpers in `frontend/src/utils/stats.js` are a deliberate mirror
of the Python aggregation in `etl/percentiles.py`. A change in one must change
the other.

### Per-week helpers are distinct from season aggregators

Decision (Chunk 16): The per-game derived helpers (`gameCompletionPct`,
`gameYardsPerCarry`, `gameYardsPerRec`, `combinedTds`) take a single week object
and return number-or-null. The season aggregators (`sumWeeks`, `completionPct`,
`seasonPassingEpa`, etc.) take the weeks array. The two families live in clearly
separated, commented sections of `stats.js`.

Why: A game log row is per-game by definition, so it shows the raw weekly value
(including the raw per-game EPA total) with no aggregation. Keeping the
single-week signature visibly distinct from the array signature prevents calling
a season aggregator where a per-row value belongs — the same class of mistake as
the Chunk 15 drift, one level down.

### Game Log has no totals row

Decision (Chunk 16): The Game Log table ships per-row only, with no season
totals/averages row.

Why: A per-week table's totals row visually implies "sum of the column above."
That works for counting stats but breaks for EPA: the EPA cell would either sum
the column (wrong, contradicts Overview's per-play rate) or show the rate
(right, but visibly not the sum of the cells above it). Either path reintroduces
the two-definitions-one-stat problem. Shipping per-row only means Game Log
computes no season value and therefore has zero drift surface. A totals row, if
ever added, is a deliberate follow-up with a documented per-column aggregation
contract.

### Career totals via a synthetic season pseudo-doc

Decision (Chunk 17): Career totals are computed by constructing a synthetic
season document whose `weeks` array is the union of every season's weeks
(`data.flatMap(d => d.weeks)`), then running the exact same column value
functions used for the per-season rows.

Why: This makes career totals share one code path with season rows. Counting
cells sum; rate cells become ratio-of-sums / mean at career scope automatically,
by the identical definition a single season uses. There is no second computation
to drift from, because there is no second code path — the totals row is just the
column functions fed a bigger `weeks` array. Career completion % is therefore
total completions over total attempts (attempt-weighted), never the mean of
season percentages.

Consequence (correct, not a bug): career counting cells equal the visual column
sum of the season rows, but career rate cells do not equal the average of the
season rate cells above them. Verified with C.J. Stroud, whose career CMP% reads
63.8% rather than the naive three-season average of 63.9% — the weighting toward
his highest-attempt season is visible in that 0.1-point gap.

---

## Frontend architecture

### Tabs primitive: compound component, hybrid controlled/uncontrolled

Decision (Chunk 12): The Tabs primitive is a compound component
(`Tabs`, `Tabs.List`, `Tabs.Tab`, `Tabs.Panel`) sharing state via React Context.
It supports a hybrid API: uncontrolled via `defaultTab`, controlled via
`activeTab` + `onTabChange`. Detection mirrors the DOM `<input>`: controlled iff
`activeTab !== undefined`. Full WAI-ARIA semantics and roving tabindex for
keyboard nav.

Why: A reusable, accessible primitive that reads like the platform's own
controlled/uncontrolled inputs. `onTabChange` fires in both modes so a parent
can observe tab changes even when not owning the state.

### Panel dispatch: three components vs config-map

Decision: Choose the dispatch shape by the axis of variation. Overview uses
three sub-components (`OverviewQB`/`OverviewRB`/`OverviewReceiver`) because the
layouts genuinely differ. Advanced, Game Log, and Career each use a single
component plus a position-keyed config map, because only the column/row list
varies and the structure is one table.

Why: When the variation is "what structure," separate components are clearest.
When the variation is "which columns," a config map is lighter and keeps one
rendering path. Picking the pattern to match the axis of variation is the
explainable choice.

### Season switching via URL param

Decision (Chunk 14d): The season selector stores the selected season in the URL
via `useSearchParams` (`/player/{id}?season=2023`), not in component state.
Season is derived from the param, not stored. Built straight to the URL-param
end state without an intermediate `useState` step.

Why: Makes a player-season shareable and the back button correct across season
switches. Season becomes part of the page's identity rather than transient UI
state. Building straight to the end state avoids paying the refactor cost twice.

Scope: The selected season drives Overview, Advanced, and Game Log (all
season-scoped). Career is cross-season and ignores the selector. A missing or
invalid season param falls back to the most recent season.

### Controlled Tabs to hide the season selector on Career

Decision (Chunk 17): PlayerPage drives the Tabs primitive in controlled mode and
owns `activeTab`, so it can hide the season selector when the Career tab is
active (`activeTab !== "career"`).

Why: Career reads the full season array and ignores `?season=`. A season picker
sitting above a tab that lists every season is a small incoherence. The selector
lives outside the Tabs panel tree and cannot read the active tab from context,
so the active tab is lifted into PlayerPage. Clean use of the primitive's
existing controlled API.

---

## Minor / historical

- **Dakota dropped:** not exposed in the player stats endpoint; replaced with
  `passingCpoe`.
- **Splits tab removed:** no clean nflverse source for the per-situation splits
  the early mocks showed.
- **Stripped metrics (no source):** Route Win %, Contested Catch %, Drop Rate
  are PFF-exclusive — not in nflverse, not in Tank01, not in the budget.
