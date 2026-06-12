## Decisions made

- **MongoDB schema:** Single collection `playerstats`, one document per
  player-season, weekly stats embedded as a `weeks` array. ETL (load.py)
  already written to this shape. Two-collection split deferred to V2.
- **Schedule data source:** nflverse, not The Odds API. Odds API reserved
  for V2 betting lines only.
- **Dakota dropped:** Not in player stats endpoint. Replaced with
  `passing_cpoe`.

## Per-week game context via load_schedules pivot join 

Decision: Derive per-week game context (homeAway, teamScore, opponentScore,
gameday, overtime, result) by joining load_schedules onto the per-week player
stats. opponent comes directly from the opponent_team column already present
in load_player_stats — not re-derived from schedules.

The join uses a per-team-per-week pivot: each schedule row (one per game) is
expanded into two rows, one from the home team's perspective and one from the
away team's, then joined onto the stats DataFrame on [season, week, team].
result ("W"/"L"/"T") is computed from teamScore vs opponentScore.

Why: load_schedules stores one row per game with home_/away_ prefixed columns.
The stats are keyed per team per week. The pivot reshapes schedules to match
that grain, which sidesteps conditional "is this player home or away" logic at
join time. This is the canonical nflverse approach (mirrors clean_homeaway).

Validation: a sanity check compares the schedules-derived opponent against the
opponent_team column and warns on any mismatch. Zero mismatches across 2022 to
2024. Spot-checked against pro-football-reference: Purdy 2024 W1, Barkley 2024
W6 (plus correct bye-week skip at W5), Flowers 2023 W12 — all correct.

Alternative considered: conditional join on [season, week] returning all games
for the week, then filtering to the row where the player's team matches home or
away. Rejected as harder to read than the pivot.

Storage: result stored as a string ("W"/"L"/"T") only. The numeric margin is
recoverable as teamScore - opponentScore, so storing it separately would
duplicate data.

## Season switching via URL param 

Decision: The season selector on the player page will store the selected season
in the URL via useSearchParams (e.g. /player/{id}?season=2023), not in
component state.

Why: makes a player-season shareable and the back button correct across season
switches. Season becomes part of the page's identity rather than transient UI
state. We explicitly chose to skip an intermediate PlayerPage-level useState
step and build straight to the URL-param end state, to avoid paying the
refactor cost twice.

Scope: the selected season drives Overview (and Advanced, Game Log when built —
all season-scoped). Career is cross-season and ignores the selector. Missing or
invalid season param falls back to the most recent season.
