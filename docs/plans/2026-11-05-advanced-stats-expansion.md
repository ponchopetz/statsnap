# Advanced Stats Expansion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Next Gen, expected-points, snap-count, PFR, big-play and fumble stats (18–23 rows per position) to the Advanced tab, Leaderboards, Compare, the Career arc and the glossary. The Advanced tab gets collapsible groups, and the ADVANCED tab gets a pulsing count badge.

**Architecture:**
- The Python ETL computes one raw season value per new stat. It stores the value in a new `advancedValues` map and the percentile in the existing `advanced` map, using today's qualifier gates.
- The backend projects the new map.
- The frontend's single `ADVANCED_CONFIG` gains `group`, `direction` and `since` per row, and every surface reads from it.
- All work happens in a worktree against a `statsnap_preview` database.

**Tech Stack:** Python 3.11 + Polars + nflreadpy 0.1.5 + pymongo (ETL); Node/Express/Mongoose (backend); React 18 + Vite + Vitest/RTL (frontend).

**Spec:** `docs/specs/2026-11-05-advanced-stats-expansion-design.md`

## Global Constraints

- **Explain and approve:** explain each change before editing (AGENTS.md). No commit until the user has seen the change (live preview for UI, diff plus test output otherwise) and said OK.
- **Commit messages:** conventional-commit style, matching the repo (`feat(etl): …`). No `--` and no attribution or co-author lines. Append commits; never amend.
- **No live writes:** never write to the live `statsnap` database before Task 14. Every ETL run in Tasks 1–13 sets `DB_NAME=statsnap_preview`. Never echo `MONGO_URI`.
- **Regular season only:** every new source is filtered to REG games.
- **Same qualifiers:** QB 150+ attempts, WR/TE 30+ targets, RB 50+ carries. Ranking is unchanged: per-metric null exclusion, `rank(method="average")`, `(rank − 1)/(n − 1)` rounded to 3 places, and 0.5 for a cohort of one.
- **Percent values** are stored as decimals from 0 to 1.
- **PFR first season:** `PFR_FIRST_SEASON = 2018`.
- **Aesthetic lock:** 90° corners, 1px rules, JetBrains Mono labels, lime `--accent`. Use only tokens from `styles.css`.
- **No new dependencies.**
- **Coverage floors:** frontend 85/83/82/77, backend 88/88/80/85.
- **Paths:** `WT=/Users/alfonsomartinezpetz/Desktop/TripleTen_SWE/StatSnap-preview`, `MAIN=/Users/alfonsomartinezpetz/Desktop/TripleTen_SWE/StatSnap`, `PY=$MAIN/etl/venv/bin/python`.

**Branch stack.** This deviates from the usual single integration branch because every layer depends on the one below. The worktree checks out the top of the stack, so the preview always shows the cumulative state. Each branch merges into `develop` with `--no-ff`, in order:

`chore/db-name-override` → `feature/etl-season-stats` → `feature/api-advanced-values` → `feature/advanced-stats-ui`

## Contract: metric order, inverted sets, labels, groups

The same lists drive `percentiles.py` `POSITION_CONFIGS` and `ADVANCED_CONFIG`. The golden JSON exports them and both sides' tests pin them. Order = display order.

**QB metrics:**
```
passingEpa, passingCpoe, pacr, passingAirYards, adot,
timeToThrow, aggressiveness, airYardsToSticks,
pressureRate, badThrowPct, sacksSuffered, sackYardsLost,
expectedPprPoints, pprPointsOverExpected, expectedTds,
plays20Plus, plays40Plus, fumbles
```
- Inverted: `sacksSuffered`, `sackYardsLost`, `pressureRate`, `badThrowPct`, `fumbles`.

**WR and TE metrics:**
```
targetShare, airYardsShare, wopr, snapShare,
receivingEpa, racr, yacPerRec, receivingAirYards,
separation, cushion, yacOverExpected, catchRate,
dropRate, brokenTackles, ratingWhenTargeted, intsWhenTargeted,
expectedPprPoints, pprPointsOverExpected, expectedTds, expectedReceptions,
plays20Plus, plays40Plus, fumbles
```
- Inverted: `dropRate`, `intsWhenTargeted`, `fumbles`.

**RB metrics:**
```
rushingEpa, yacPerRec, receivingAirYards,
carries, snapShare, targetShare, wopr,
ryoePerAtt, runsOverExpectedPct, eightBoxPct, timeToLos,
beforeContactPerAtt, afterContactPerAtt, brokenTackles,
expectedPprPoints, pprPointsOverExpected, expectedTds, expectedReceptions,
plays20Plus, plays40Plus, fumbles
```
- Inverted: `fumbles`.

**Style metrics** (UI direction only; Python ranks them normally): `timeToThrow`, `aggressiveness`, `airYardsToSticks`, `cushion`, `eightBoxPct`, `timeToLos`.

**PFR metrics** (`since: 2018`): `pressureRate`, `badThrowPct`, `dropRate`, `brokenTackles`, `ratingWhenTargeted`, `intsWhenTargeted`, `beforeContactPerAtt`, `afterContactPerAtt`.

**Season-sourced metrics:** every key above that isn't in today's 16, which are `passingEpa pacr passingCpoe passingAirYards adot sacksSuffered sackYardsLost targetShare airYardsShare wopr racr receivingAirYards yacPerRec receivingEpa rushingEpa carries`.

**Groups**, in order of first appearance:
- QB: `EFFICIENCY`, `TRACKING · NEXT GEN`, `PRESSURE`, `EXPECTED POINTS`, `BIG PLAYS & FUMBLES`
- WR/TE: `USAGE`, `EFFICIENCY`, `TRACKING · NEXT GEN`, `CHARTING · PFR`, `EXPECTED POINTS`, `BIG PLAYS & FUMBLES`
- RB: `EFFICIENCY`, `USAGE`, `TRACKING · NEXT GEN`, `CHARTING · PFR`, `EXPECTED POINTS`, `BIG PLAYS & FUMBLES`

The group boundaries follow the line breaks in the lists above.

**Labels for new keys:**

| Key | Label |
|---|---|
| `snapShare` | Snap Share |
| `timeToThrow` | Time to Throw |
| `aggressiveness` | Aggressiveness |
| `airYardsToSticks` | Air Yards to Sticks |
| `separation` | Avg Separation |
| `cushion` | Avg Cushion |
| `yacOverExpected` | YAC Over Expected |
| `catchRate` | Catch Rate |
| `ryoePerAtt` | RYOE / Att |
| `runsOverExpectedPct` | Runs Over Expected % |
| `eightBoxPct` | 8+ Defenders in Box |
| `timeToLos` | Time to LOS |
| `pressureRate` | Pressure Rate |
| `badThrowPct` | Bad Throw % |
| `dropRate` | Drop Rate |
| `brokenTackles` | Broken Tackles |
| `ratingWhenTargeted` | Passer Rtg When Tgt |
| `intsWhenTargeted` | INTs When Targeted |
| `beforeContactPerAtt` | Before Contact / Att |
| `afterContactPerAtt` | After Contact / Att |
| `expectedPprPoints` | Expected PPR Pts |
| `pprPointsOverExpected` | Pts Over Expected |
| `expectedTds` | Expected TDs |
| `expectedReceptions` | Expected Receptions |
| `fumbles` | Fumbles |
| `plays20Plus` | 20+ Yd Completions (QB) · 20+ Yd Runs (RB) · 20+ Yd Catches (WR/TE) |
| `plays40Plus` | 40+ Yd Completions (QB) · 40+ Yd Runs (RB) · 40+ Yd Catches (WR/TE) |

## Review Focus

1. **A traded player has two NGS week-0 rows.** Expect one season value: keep the row with the most attempts/targets/rush_attempts. The test is in Task 1.
2. **An early-season or missing NGS file, or an empty frame.** The season frame should still build, with that source's columns all null. The test is in Task 1.
3. **A PFR row whose `pfr_player_id` isn't in the roster crosswalk.** It should be dropped quietly, and that player's other stats should be unaffected. The test is in Task 3.
4. **A zero denominator** (zero attempts, targets or carries in the PFR weeks). The value should be null and never `NaN` or `inf`, and it should be absent from `advancedValues`. The tests are in Tasks 3 and 4.
5. **A document with no `advancedValues`.** This covers live docs before the backfill and old seasons. Every surface should render "—" with no crash. The tests are in Tasks 7 and 8.

---

### Task 0: Worktree, preview database switch

**Files:**
- Modify: `etl/load.py` (the `DB_NAME` constant)
- Modify: `backend/utils/db.js`
- Modify: `docs/adr/DECISIONS.md`, the "Database name in code, not the URI" entry
- Test: `etl/tests/test_load.py`
- Local only (gitignored): `$MAIN/.claude/launch.json`

**Interfaces:**
- Produces: `load.DB_NAME: str`, which is env `DB_NAME` or `"statsnap"`. The backend connects to `process.env.DB_NAME || 'statsnap'` and logs `Connected to MongoDB (<name>)`.

- [ ] **Step 1: Create the worktree on the first branch.** Run:
  ```bash
  git -C $MAIN worktree add $WT -b chore/db-name-override develop
  ```
  Then symlink `frontend/node_modules`, `backend/node_modules`, and each existing `.env` (`etl/.env`, `backend/.env`, `frontend/.env*`) from `$MAIN` into `$WT`. Expected: `git -C $WT status` is clean, and the symlinks are ignored by git.
- [ ] **Step 2: Write the failing test** `test_db_name_defaults_to_statsnap_and_honours_env` in `test_load.py`. Use `monkeypatch.delenv("DB_NAME")` and `importlib.reload(load)`, then assert `load.DB_NAME == "statsnap"`. Then `monkeypatch.setenv("DB_NAME", "statsnap_preview")`, reload, and assert `"statsnap_preview"`.
- [ ] **Step 3: Run it to see it fail.** Run `cd $WT/etl && $PY -m pytest tests/test_load.py -k db_name -v`. Expected: FAIL, because `DB_NAME` is hardcoded.
- [ ] **Step 4: Implement the switch.**
  - `load.py`: `DB_NAME = os.environ.get("DB_NAME", "statsnap")`.
  - `db.js`: `const dbName = process.env.DB_NAME || 'statsnap'`, pass it to `connect`, and log `Connected to MongoDB (${dbName})`.
  - ADR: add an amendment paragraph saying the default stays in code and the env override exists only to point previews at a copy.
- [ ] **Step 5: Run it to see it pass.** Run the same command. Expected: PASS. Then run the full `$PY -m pytest`. Expected: all pass.
- [ ] **Step 6: Add the preview launch configs** to `$MAIN/.claude/launch.json`:
  - `statsnap-preview-backend`: `runtimeExecutable: "env"`, `runtimeArgs: ["DB_NAME=statsnap_preview", "PORT=3001", "npm", "--prefix", "<WT>/backend", "start"]`, port 3001.
  - `statsnap-preview-frontend`: `npm --prefix <WT>/frontend run dev` on port 3000.
- [ ] **Step 7: Show the diff and test output, then commit after OK.**
  ```bash
  git -C $WT add etl/load.py etl/tests/test_load.py backend/utils/db.js docs/adr/DECISIONS.md
  git -C $WT commit -m "chore(db): allow DB_NAME override for preview databases"
  ```

---

### Task 1: Next Gen season values and the optional-source fetch policy

**Files:**
- Create: `etl/season_sources.py`
- Test: create `etl/tests/test_season_sources.py`

**Interfaces:**
- Produces:
  - `PFR_FIRST_SEASON = 2018`
  - `NGS_FIELDS: dict[str, dict[str, tuple[str, float]]]`, which maps stat_type to `{metricKey: (ngs_column, scale)}`
  - `nextgen_season(ngs: dict[str, pl.DataFrame | None]) -> pl.DataFrame`, returning `playerId` plus the 11 NGS keys
  - `is_not_published(err: Exception) -> bool`
  - `fetch_optional(name: str, season: int, call: Callable[[], T], since: int | None = None) -> T | None`

- [ ] **Step 0: Branch.** Run `git -C $WT switch -c feature/etl-season-stats`.
- [ ] **Step 1: Probe the NGS percent scales.**
  - Run `$PY -c` with `load_nextgen_stats(2024, stat_type=t)` and print `max()` for `aggressiveness`, `catch_percentage`, `percent_attempts_gte_eight_defenders` and `rush_pct_over_expected`.
  - Rule: a max above 1.5 means a 0–100 scale, so use scale 0.01. Otherwise use scale 1.0.
  - Every other NGS column uses scale 1.0.
  - Record the result in `NGS_FIELDS`.
- [ ] **Step 2: Write the failing tests:**
  - `test_nextgen_uses_regular_season_week_zero_only`: a frame with a week-0 REG row (`avg_time_to_throw=2.8`), a week-3 row (3.5), and a week-0 POST row (3.9). The result for that player is `timeToThrow == 2.8`.
  - `test_nextgen_scales_percent_columns_to_decimals`: if `aggressiveness` is a percent column, `aggressiveness=16.2` gives 0.162. Follow the Step 1 finding.
  - `test_nextgen_traded_player_keeps_highest_volume_row`: two week-0 REG receiving rows for one `player_gsis_id`, with targets 40 (separation 2.5) and 70 (separation 3.1), give one row with `separation == 3.1`.
  - `test_nextgen_missing_or_empty_source_yields_null_columns`: `{"passing": None, "receiving": <empty>, "rushing": <one row>}` gives all 11 key columns present, with nulls for the missing sources.
  - `test_fetch_optional_skips_before_since_without_calling`: `since=2018`, season 2017, and a `call` that raises if invoked. Expected result: `None`.
  - `test_fetch_optional_skips_404_and_reraises_other_errors`: a `ConnectionError` whose `__cause__.response.status_code == 404` gives `None` and a printed warning. A `KeyError` and a 500 cause both propagate.
- [ ] **Step 3: Run them to see them fail.** Run `cd $WT/etl && $PY -m pytest tests/test_season_sources.py -v`. Expected: an ImportError on `season_sources`.
- [ ] **Step 4: Implement the functions** in `season_sources.py`, using the signatures above.
  - `nextgen_season` filters `week == 0 & season_type == "REG"`, dedupes per `player_gsis_id` by the volume column (`attempts`, `targets` or `rush_attempts`), renames to `playerId` plus the keys, applies the scale, and outer-joins the three stat types on `playerId` with `coalesce=True`.
  - `is_not_published` mirrors the 404 check already in `load.py`.
- [ ] **Step 5: Run them to see them pass.** Run the same command. Expected: PASS.
- [ ] **Step 6: Show the code and test output.** Commit after OK, together with Tasks 2 to 4 or separately as the user prefers:
  ```bash
  git commit -m "feat(etl): add Next Gen season values and optional source fetch"
  ```

---

### Task 2: Expected points, big plays, fumbles

**Files:**
- Modify: `etl/season_sources.py`
- Test: `etl/tests/test_season_sources.py`

**Interfaces:**
- Produces:
  - `expected_points_season(ff: pl.DataFrame | None, reg_game_ids: set[str], reg_last_week: int) -> pl.DataFrame`, returning `playerId`, `expectedPprPoints`, `pprPointsOverExpected`, `expectedTds`, `expectedReceptions`
  - `big_plays_season(raw_stats: pl.DataFrame) -> pl.DataFrame`, returning `playerId`, `plays20Plus`, `plays40Plus`, `fumbles`
- Consumes: `raw_stats` is the output of `transform.filter_positions` (raw nflverse names, REG only, with `position`).

- [ ] **Step 1: Write the failing tests:**
  - `test_expected_points_sums_regular_season_games_only`: weeks 1 and 2 (exp 10.0, 12.5) and week 19 (exp 30). Expected `expectedPprPoints == 22.5`. Also cover `pprPointsOverExpected` from `total_fantasy_points_diff`, `expectedTds` from `total_touchdown_exp`, and `expectedReceptions` from `receptions_exp`.
  - `test_expected_points_falls_back_to_week_filter_when_game_ids_do_not_match`: `reg_game_ids` is disjoint from the frame's ids and `reg_last_week=18`. Week 19 is still excluded and weeks 1–18 are kept.
  - `test_big_plays_use_position_specific_columns`:
    - a QB with `passing_20=3`, `passing_40=1`, `rushing_20=2` gives `plays20Plus == 3`.
    - an RB with `rushing_20=4`, `receiving_20=1` gives 4.
    - a WR with `receiving_40=2` gives `plays40Plus == 2`.
  - `test_fumbles_count_sack_rushing_and_receiving_fumbles`: 1 + 2 + 1 gives 4. Nulls count as 0.
- [ ] **Step 2: Run them to see them fail.** Run `$PY -m pytest tests/test_season_sources.py -k "expected or big_plays or fumbles" -v`. Expected: AttributeError.
- [ ] **Step 3: Implement the two functions.**
  - The REG filter is `game_id ∈ reg_game_ids`. Use it if any ids intersect; otherwise fall back to `week ≤ reg_last_week`.
  - `fill_null(0)` before each sum.
- [ ] **Step 4: Run them to see them pass.** Expected: PASS.
- [ ] **Step 5: Show the code and test output, then commit after OK.**
  ```bash
  git commit -m "feat(etl): add expected points, big plays and fumbles season values"
  ```

---

### Task 3: Crosswalk, snap share, PFR, passer rating

**Files:**
- Modify: `etl/season_sources.py`
- Test: `etl/tests/test_season_sources.py`

**Interfaces:**
- Produces:
  - `crosswalk_from_rosters(rosters: pl.DataFrame) -> pl.DataFrame`, returning `pfr_id` and `playerId`, with nulls dropped and unique rows
  - `snap_share_season(snaps: pl.DataFrame | None, crosswalk: pl.DataFrame) -> pl.DataFrame`, returning `playerId` and `snapShare`
  - `passer_rating_expr(att, comp, yds, td, ints) -> pl.Expr`
  - `pfr_season(pfr: dict[str, pl.DataFrame | None], weekly: pl.DataFrame, crosswalk: pl.DataFrame) -> pl.DataFrame`, returning `playerId` plus the 8 PFR keys
- Consumes: `weekly` is the `transform` clean frame. It needs `playerId`, `week`, `attempts`, `sacksSuffered`, `targets`, `receptions`, `receivingYards` and `receivingTds`.

- [ ] **Step 1: Write the failing tests:**
  - `test_snap_share_divides_by_team_snaps_in_games_with_offensive_snaps`:
    - game 1: team max 60, player 45.
    - game 2: player 0 offensive snaps (special teams only), team 70.
    - a POST game: player 50 of 50.
    - Expected `snapShare == 0.75`.
  - `test_passer_rating_formula_and_clamps`:
    - (100, 70, 1000, 8, 1) gives ≈124.583.
    - (10, 10, 300, 5, 0) gives ≈158.333.
    - (10, 0, 0, 0, 5) gives 0.0.
  - `test_pfr_denominators_use_only_games_with_pfr_rows`:
    - weekly has a QB with 30 and 40 attempts in weeks 1 and 2, and 2 sacks in each.
    - PFR pass has week 1 only, with `times_pressured=8` and `passing_bad_throws=6`.
    - Expected: `pressureRate == 8/32` and `badThrowPct == 6/30`.
  - `test_pfr_broken_tackles_dedupe_player_game_across_rush_and_rec_files`: the same (pfr id, game_id) appears in both files with rush BT 3 and rec BT 1. Expected `brokenTackles == 4`.
  - `test_pfr_receiving_and_rushing_rates`:
    - `dropRate` = drops ÷ targets over the PFR weeks.
    - `ratingWhenTargeted` uses `passer_rating_expr`.
    - `intsWhenTargeted` sums `receiving_int`.
    - `beforeContactPerAtt` and `afterContactPerAtt` use PFR `carries`.
  - `test_pfr_zero_denominator_is_null_not_nan`: 0 attempts gives `pressureRate` null, and `is_nan()` is False.
  - `test_pfr_rows_missing_from_crosswalk_are_dropped`: an unmapped `pfr_player_id` is dropped and no exception is raised.
  - `test_pfr_filters_to_regular_season`: a `game_type == "WC"` row is excluded.
- [ ] **Step 2: Run them to see them fail.** Run `$PY -m pytest tests/test_season_sources.py -k "snap or pfr or passer" -v`. Expected: AttributeError.
- [ ] **Step 3: Implement the four functions.**
  - Passer rating: `a=(comp/att−0.3)·5`, `b=(yds/att−3)·0.25`, `c=td/att·20`, `d=2.375−ints/att·25`. Clip each to [0, 2.375]. Rating = (a+b+c+d)/6·100. Null when `att == 0`.
  - All ratios: `pl.when(den > 0).then(num/den).otherwise(None)`.
- [ ] **Step 4: Run them to see them pass.** Expected: PASS.
- [ ] **Step 5: Show the code and test output, then commit after OK.**
  ```bash
  git commit -m "feat(etl): add snap share and PFR season values"
  ```

---

### Task 4: Wire into transform, percentiles, load, golden

**Files:**
- Modify: `etl/season_sources.py`, adding `fetch_sources` and `build_season_frame`
- Modify: `etl/transform.py`, the `transform()` function
- Modify: `etl/percentiles.py`
- Modify: `etl/load.py`, the `load()` function, plus a new `attach_maps`
- Modify: `etl/generate_golden.py`
- Regenerate: `frontend/src/utils/__tests__/golden-season-aggregates.json`
- Modify: `frontend/src/utils/__tests__/stats.golden.test.js`
- Test: `etl/tests/test_percentiles.py`, `etl/tests/test_load.py`, `etl/tests/test_golden.py`

**Interfaces:**
- Produces:
  - `fetch_sources(season: int) -> dict`, with keys `ngs`, `ff`, `snaps`, `pfr`. Each value comes from `fetch_optional`, and PFR uses `since=PFR_FIRST_SEASON`.
  - `build_season_frame(sources: dict, weekly: pl.DataFrame, raw_stats: pl.DataFrame, rosters: pl.DataFrame, schedules: pl.DataFrame) -> pl.DataFrame`, which outer-joins every source frame on `playerId`.
  - `season_values_map(frame: pl.DataFrame) -> dict[str, dict[str, float]]`, which drops null and non-finite values.
  - `transform() -> tuple[pl.DataFrame, dict, dict]`, returning `(clean, advanced_map, values_map)`.
  - `compute_percentiles(df, season_frame: pl.DataFrame | None = None)`.
  - `percentiles.SEASON_SOURCED_METRICS: frozenset[str]`.
  - `load.attach_maps(docs, advanced_map, values_map) -> None`, which sets `doc["advanced"]` and `doc["advancedValues"]` when present.
  - Golden `positionConfigs[pos].seasonSourced: list[str]`, sorted.

- [ ] **Step 1: Write the failing tests:**
  - `test_percentiles.py::test_season_frame_metrics_rank_within_qualified_cohort`: three qualified WRs with `dropRate` 0.02/0.05/0.08 and one unqualified WR with 0.00. Expected `dropRate` percentiles 1.0/0.5/0.0, and the unqualified WR is absent.
  - `test_percentiles.py::test_style_metric_ranks_by_raw_value`: `timeToThrow` 2.5/3.0 gives P0/P1.
  - `test_percentiles.py::test_missing_season_frame_still_ranks_weekly_metrics`: `compute_percentiles(df)` with no frame still returns `passingEpa` and has no new keys.
  - `test_percentiles.py::test_position_configs_match_the_contract`: assert the exact per-position metric lists and inverted sets from this plan's Contract section.
  - `test_season_sources.py::test_season_values_map_drops_null_and_non_finite`: null, `nan` and `inf` are absent and 0.0 is kept.
  - `test_load.py::test_advanced_values_round_trip_and_replace_not_merge`: mirror the existing `test_advanced_map_round_trips_and_is_replaced_not_merged` using `attach_maps` and `upsert_documents`.
  - `test_golden.py::test_golden_covers_every_ranked_metric_for_every_position`: change it to `compared == set(config["metrics"]) - SEASON_SOURCED_METRICS`, and assert that `seasonSourced` equals the sorted intersection.
- [ ] **Step 2: Run them to see them fail.** Run `$PY -m pytest -v`. Expected: the new tests fail.
- [ ] **Step 3: Implement.**
  - `percentiles.py`:
    - Reorder and extend `POSITION_CONFIGS` exactly per the Contract.
    - In `compute_percentiles`, left-join `season_frame` onto `agg` by `playerId`.
    - Make `_rank_cohort` skip metrics whose column is absent.
  - `transform.py`:
    - Compute `build_season_frame(fetch_sources(SEASON), clean, filtered, rosters, schedules)` after `handle_nulls`.
    - Pass the result to `compute_percentiles`.
    - Return `values_map` as the third value.
  - `load.py`: unpack three values and call `attach_maps`.
  - `generate_golden.py`:
    - `COMPARED_METRICS[pos]` becomes the metrics minus `SEASON_SOURCED_METRICS`, in order.
    - Export `seasonSourced`.
    - Run `cd $WT/etl && $PY generate_golden.py`.
  - `stats.golden.test.js`: "every ranked metric has a JS equivalent" skips `config.seasonSourced`.
- [ ] **Step 4: Run all ETL tests.** Run `$PY -m pytest -v`. Expected: all pass.
- [ ] **Step 5: Run the frontend golden suite.** Run `npm --prefix $WT/frontend test -- stats.golden`. Expected: PASS.
  - `AdvancedPanel.test.jsx`'s "one row per Python-ranked metric" now fails, because `ADVANCED_CONFIG` hasn't changed yet. Task 7 fixes it. Note it and don't patch around it.
- [ ] **Step 6: Run a dry run against real data with no DB write.**
  - Run `SEASON=2024 $PY -c` with `import transform`, then `c, a, v = transform.transform()`.
  - Look up Ja'Marr Chase's `playerId` from `c` by `displayName`, and print `v[that id]`.
  - Expected: 23 WR keys, `plays20Plus == 19`, `plays40Plus == 8`, and `separation` around 3.
- [ ] **Step 7: Show the diff, test output and dry-run output, then commit after OK.**
  ```bash
  git commit -m "feat(etl): rank season-level advanced stats and store advancedValues"
  ```

---

### Task 5: Backfill the preview database

**Files:** none

- [ ] **Step 1: Record the live baseline.** Count the live `statsnap.playerstats` documents with a read-only `$PY -c` using `load_dotenv(".env")`. Expected: 6435.
- [ ] **Step 2: Backfill all 11 seasons** in the background:
  ```bash
  cd $WT/etl && for s in 2016 2017 2018 2019 2020 2021 2022 2023 2024 2025 2026; do SEASON=$s DB_NAME=statsnap_preview $PY load.py || break; done
  ```
  Expected: each season prints "Advanced metrics attached", and the 2016–17 runs log the PFR skip.
- [ ] **Step 3: Verify.**
  - The live count is still 6435 and no live document has `advancedValues`.
  - `statsnap_preview` has the same per-season doc counts as live.
  - Preview `dataSize + indexSize` is under 70 MB.
  - A 2017 QB doc has no `pressureRate` key.
  - A 2026 doc has `advancedValues`.
- [ ] **Step 4: Report the counts and sizes to the user.** There is nothing to commit.

---

### Task 6: Backend projects the new map

**Files:**
- Modify: `backend/models/playerStats.js` (around line 111)
- Modify: `backend/controllers/players.js` (the projection around line 83)
- Modify: `backend/controllers/leaderboards.js` (`METRIC_PATTERN` and the projection)
- Modify: `backend/utils/similarity.js`
- Test: `backend/tests/players.routes.test.js`, `backend/tests/leaderboards.routes.test.js`, `backend/tests/similar.routes.test.js`, with fixtures via `backend/tests/helpers/fixtures.js`

**Interfaces:**
- Produces: `advancedValues` on every `/players/:id` season doc and every leaderboard row. Also `similarity.SIMILARITY_METRICS: Set<string>`, which is today's 16 keys.

- [ ] **Step 0: Branch.** Run `git -C $WT switch -c feature/api-advanced-values`.
- [ ] **Step 1: Write the failing tests:**
  - `players`: "returns advancedValues on each season document". Insert a fixture with `advancedValues: { snapShare: 0.9 }` and expect `body[0].advancedValues.snapShare === 0.9`.
  - `leaderboards`: "accepts digit metric keys and returns advancedValues". `metric=plays20Plus` gives 200, ordered by `advanced.plays20Plus`, and rows include `advancedValues`.
  - `leaderboards`: "still rejects dotted or operator metric names". `a.b`, `$where` and `9lives` each give 400.
  - `similar`: "ignores keys outside today's metric set". Two profiles that are identical on 7 of today's keys but opposite on `dropRate` and `separation` have `similarity(...) === 1`.
- [ ] **Step 2: Run them to see them fail.** Run `npm --prefix $WT/backend test -- players leaderboards similar`. Expected: the 4 new tests fail.
- [ ] **Step 3: Implement.**
  - Model: `advancedValues: { type: Map, of: Number }`.
  - Add `advancedValues: 1` to both projections.
  - `METRIC_PATTERN = /^[a-zA-Z][a-zA-Z0-9]{0,39}$/`.
  - `sharedMetrics` filters keys through `SIMILARITY_METRICS`. Export it.
- [ ] **Step 4: Run the backend suite with coverage.** Run `npm --prefix $WT/backend run test:coverage`. Expected: all pass, with coverage at or above 88/88/80/85.
- [ ] **Step 5: Start the preview backend.** Run `preview_start` with `statsnap-preview-backend`. Expected: `preview_logs` shows `Connected to MongoDB (statsnap_preview)`, and `GET /players/<Chase's playerId>` includes `advancedValues`.
- [ ] **Step 6: Show the code and logs, then commit after OK.**
  ```bash
  git commit -m "feat(api): project advancedValues and accept digit metric keys"
  ```

---

### Task 7: Frontend config, glossary, contract tests

**Files:**
- Modify: `frontend/src/utils/stats.js`, covering `ADVANCED_CONFIG`, `buildAdvancedRows` and the new `groupRows`
- Modify: `frontend/src/utils/glossary.js`
- Modify: `frontend/src/utils/compare.js`
- Modify: `frontend/src/components/ShareCard/ShareCard.jsx` (line 42)
- Test: `frontend/src/utils/__tests__/stats.golden.test.js`, `frontend/src/utils/__tests__/stats.test.js`, `frontend/src/components/__tests__/Compare.test.jsx`

**Interfaces:**
- Produces:
  - An `ADVANCED_CONFIG[pos]` row is `{ key, label, group, direction: "higher"|"lower"|"style", since?: number, rawValue(weeks, player) => string }`.
  - `buildAdvancedRows(player)` returns `{ k, key, group, direction, since, bar, v }[]`.
  - `groupRows(rows) => Array<{ group, rows }>`, which preserves first-appearance order.
  - `buildComparison(a, b).advanced` rows gain `group` and `direction`, and a style row has `winner: null`.
  - `groupComparison(advancedRows) => Array<{ group, rows, tally: { a: number, b: number } }>`.
  - `SHARE_CARD_KEYS: Record<pos, string[]>` in `ShareCard.jsx`, holding today's 7/7/6 keys in today's order.

- [ ] **Step 0: Branch.** Run `git -C $WT switch -c feature/advanced-stats-ui`.
- [ ] **Step 1: Write the failing tests.** Contract tests go in `stats.golden.test.js` under a new `describe("ADVANCED_CONFIG matches the ETL config")`:
  - `keys follow Python metric order`: `ADVANCED_CONFIG[p].map(r => r.key)` equals `golden.positionConfigs[p].metrics`.
  - `lower direction is exactly the inverted set`.
  - `every season-sourced row reads advancedValues`: `rawValue([], { advancedValues: { [key]: 1 } }) !== "—"`, and `rawValue([], {}) === "—"`.
  - `every label has a glossary entry`.
  - `since is 2018 exactly on PFR rows`: the 8 PFR keys from the Contract.
  - `groups follow the contract order` for each position.

  The remaining tests:
  - `stats.test.js`:
    - `groupRows keeps first-appearance order`.
    - `buildAdvancedRows tolerates a player with no advancedValues`. Every new row has `v === "—"` and `bar === null`.
  - `Compare.test.jsx`, or a `compare` unit test in the same file:
    - `style rows never pick a winner`.
    - `groupComparison tallies only rows with a winner`. 2 A wins, 1 B win, 1 style row and 1 null row give `{ a: 2, b: 1 }`.
- [ ] **Step 2: Run them to see them fail.** Run `npm --prefix $WT/frontend test -- stats Compare`. Expected: the new tests fail.
- [ ] **Step 3: Implement.**
  - Rewrite `ADVANCED_CONFIG` per the Contract. Existing rows keep their `rawValue` bodies.
  - New rows use one small factory, `seasonValue(key, format)`.
  - Formats: shares and rates use `formatPercent`. Over/under-expected and `airYardsToSticks` use `formatSigned`, with `pprPointsOverExpected` at 1 decimal and the rest at 2. Seconds display as `2.81s`. Counts use `formatNumber`. Per-attempt and per-catch values use 1–2 decimals. `ratingWhenTargeted` uses 1 decimal.
  - `glossary.js`:
    - One entry per new label.
    - Lower-direction entries end "Lower is better."
    - Style entries end "A style stat: higher isn't better or worse."
    - PFR entries mention 2018+.
    - NGS entries mention NGS's own volume minimum.
  - `compare.js`: delete `LOWER_IS_BETTER_LABELS`, set `lowerIsBetter = direction === "lower"`, and set `winner = direction === "style" ? null : winner(ra.bar, rb.bar, false)`.
  - `ShareCard.jsx`: select rows by `SHARE_CARD_KEYS[position]`.
- [ ] **Step 4: Run the suites.** Run `npm --prefix $WT/frontend test`. Expected: everything passes except the AdvancedPanel row-order test, which Task 8 updates.
- [ ] **Step 5: No commit yet.** This task's diff is reviewed and committed together with Task 8, because the panel can't render the config sensibly on its own.

---

### Task 8: Advanced tab collapsible groups

**Files:**
- Modify: `frontend/src/components/AdvancedPanel/AdvancedPanel.jsx`
- Modify: `frontend/src/components/AdvancedPanel/AdvancedPanel.css`
- Test: `frontend/src/components/__tests__/AdvancedPanel.test.jsx`

**Interfaces:**
- Consumes: `buildAdvancedRows` and `groupRows` from Task 7.
- Produces:
  - DOM: `.adv-group` > `button.adv-group-head[aria-expanded][aria-controls]` > (`.adv-group-chev`, `.adv-group-name`, `.adv-group-count`, `.adv-group-peek`). The body is `ul.adv-list#<id>`, rendered with `hidden` when collapsed.
  - A style row adds `.adv-row--style`.

- [ ] **Step 1: Write the failing tests:**
  - `first group starts open and the rest collapsed`: check `aria-expanded` values.
  - `clicking a group header toggles it, several can be open`.
  - `? KEY opens every group and definition; turning it off restores the previous open set`.
  - `peek shows the first row that has a value, or —`.
  - `style rows draw a neutral bar`: the `.adv-row--style` class is on the Time to Throw row.
  - `rows without advancedValues show — for value and percentile`.
  - `open state resets when a different player-season loads`: rerender with a new `season`.
  - The footnote contains `PFR charting starts in 2018`.
  - Update `renders one row per Python-ranked metric, in Python's order` to click `? KEY` before collecting list items.
- [ ] **Step 2: Run them to see them fail.** Run `npm --prefix $WT/frontend test -- AdvancedPanel`. Expected: FAIL.
- [ ] **Step 3: Implement the panel.**
  - State:
    - `openGroups: Set<string>`, starting with the first group and reset on `playerId` or `season` change.
    - `showAll: boolean` for KEY.
    - `openKey` for a single row's definition, as today.
  - CSS:
    - `.adv-panel { container-type: inline-size }`.
    - `@container (max-width: 420px)` hides `.adv-group-peek`.
    - The peek is hidden while its group is open.
    - `.adv-row--style .fill { background: var(--fg-3) }`.
    - The label column may wrap but never widens the row: `min-width: 0` and `overflow-wrap: anywhere` on `.k`.
- [ ] **Step 4: Run the full frontend suite.** Run `npm --prefix $WT/frontend test`. Expected: all pass.
- [ ] **Step 5: Show it live.**
  - Start `statsnap-preview-frontend`. The preview backend is already running from Task 6.
  - Open Chase 2024, a QB (Lamar Jackson 2024), an RB (Derrick Henry 2024), and a 2017 QB.
  - Screenshot at 375 and 1280.
- [ ] **Step 6: Commit Tasks 7 and 8 after OK.**
  ```bash
  git commit -m "feat(advanced): group the advanced stats into collapsible sections"
  ```

---

### Task 9: ADVANCED tab badge with synced pulse

**Files:**
- Create: `frontend/src/hooks/usePulseSync.js`
- Modify: `frontend/src/components/PlayerPage/PlayerPage.jsx` (line 206)
- Modify: `frontend/src/components/Tabs/Tabs.css`
- Modify: `frontend/src/components/SiteHeader/SiteHeader.jsx` (line 15)
- Modify: `frontend/src/components/SiteHeader/SiteHeader.css`
- Test: `frontend/src/components/__tests__/PlayerPage.test.jsx`, and create `frontend/src/hooks/__tests__/usePulseSync.test.js`

**Interfaces:**
- Produces:
  - `PULSE_PERIOD_MS = 1800`.
  - `usePulseSync(ref, deps = [])`. On mount and whenever `deps` change, it sets `ref.current.style.animationDelay = \`-${performance.now() % PULSE_PERIOD_MS}ms\``. This phase-locks to the document timeline.
  - Badge DOM: `span.tab-badge[aria-hidden="true"]`, plus `.tab-badge--still` while ADVANCED is active.

- [ ] **Step 1: Write the failing tests:**
  - `usePulseSync.test.js`, `sets a negative delay modulo the pulse period`: mock `performance.now` to return 5000, so the delay is `"-1400ms"`. It recomputes when a dependency changes.
  - `PlayerPage.test.jsx`:
    - `ADVANCED tab shows the position's stat count`. A WR shows `ADVANCED_CONFIG.WR.length`.
    - `the tab's accessible name stays ADVANCED`: `getByRole("tab", { name: "ADVANCED" })`.
    - `badge stops pulsing while the tab is active`: the `.tab-badge--still` class.
- [ ] **Step 2: Run them to see them fail.** Run `npm --prefix $WT/frontend test -- usePulseSync PlayerPage`. Expected: FAIL.
- [ ] **Step 3: Implement the badge.**
  - Use the hook on the header `.live-dot` and on the badge. The badge passes `[activeTab === "advanced"]` as its dependency.
  - Badge CSS:
    - A lime chip with 9px mono type and `animation: pulse 1.8s infinite`.
    - `.tab-badge--still { animation: none }`.
    - `@media (prefers-reduced-motion: reduce) { animation: none }`.
    - At `@container tabs (max-width: 420px)` it becomes a 6px dot with `font-size: 0`.
  - Reduce the 420px tab padding until the five tabs fit at 320.
- [ ] **Step 4: Run the full frontend suite.** Run `npm --prefix $WT/frontend test`. Expected: all pass.
- [ ] **Step 5: Show it live.** At 320, 375 and 1280, assert `document.documentElement.scrollWidth === clientWidth`. Confirm by eye that the badge and live dot pulse together.
- [ ] **Step 6: Commit after OK.**
  ```bash
  git commit -m "feat(player): pulse a stat-count badge on the ADVANCED tab"
  ```

---

### Task 10: Compare groups and tally

**Files:**
- Modify: `frontend/src/components/Compare/Compare.jsx` (the advanced section, about lines 226–240)
- Modify: `frontend/src/components/Compare/Compare.css`
- Test: `frontend/src/components/__tests__/Compare.test.jsx`

**Interfaces:**
- Consumes: `groupComparison` from Task 7.
- Produces: `.cmp-group` > `button.cmp-group-head[aria-expanded]` > (`.cmp-group-name`, `.cmp-group-tally` with text `A n · B m`), followed by a `ul.cmp-list` that is `hidden` when collapsed.

- [ ] **Step 1: Write the failing tests:**
  - `advanced rows are grouped with the first group open`.
  - `group header shows the win tally`.
  - `style rows show values without a win highlight`: no `.cmp-val--win`.
  - `a 2017 side shows — on PFR rows`.
  - Footnote: replace the sacks sentence with copy that also says style stats have no winner.
- [ ] **Step 2: Run them to see them fail.** Run `npm --prefix $WT/frontend test -- Compare`. Expected: FAIL.
- [ ] **Step 3: Implement** the open-group state, starting with the first group, and the CSS that mirrors the Advanced group headers.
- [ ] **Step 4: Run the full frontend suite.** Expected: PASS.
- [ ] **Step 5: Show it live.** Show Chase 2024 vs Justin Jefferson 2024, and a 2017 vs 2024 QB matchup, at 375 and 1280.
- [ ] **Step 6: Commit after OK.**
  ```bash
  git commit -m "feat(compare): group advanced rows with a win tally"
  ```

---

### Task 11: Career arc grouped percentile chips

**Files:**
- Modify: `frontend/src/utils/careerArc.js` (`arcOptions`)
- Modify: `frontend/src/components/CareerArc/CareerArc.jsx`
- Modify: `frontend/src/components/CareerArc/CareerArc.css`
- Test: `frontend/src/components/__tests__/Career.test.jsx`

**Interfaces:**
- Produces: in percentile mode, `arcOptions` returns `{ key, label, format, group, direction }`, and totals mode is unchanged. The DOM is `.arc-stat-groups` > `.arc-stat-group` > (`.arc-stat-group-label`, then the existing `.arc-btn` chips).

- [ ] **Step 1: Write the failing tests:**
  - `percentile mode lays chips out under their group labels`: every group label is present and the chip count equals `ADVANCED_CONFIG[pos].length`.
  - `totals mode keeps the flat chip row`.
  - `a style stat's summary reads HIGHEST, not BEST`.
- [ ] **Step 2: Run them to see them fail.** Run `npm --prefix $WT/frontend test -- Career`. Expected: FAIL.
- [ ] **Step 3: Implement.** Chips wrap within each group, and the chart and axis sit below the groups.
- [ ] **Step 4: Run the full frontend suite.** Expected: PASS.
- [ ] **Step 5: Show it live** on the Career tab for a 9-season player at 320, 375 and 1280, with the overflow check.
- [ ] **Step 6: Commit after OK.**
  ```bash
  git commit -m "feat(career): group percentile stat chips"
  ```

---

### Task 12: Leaderboards optgroups, raw values, coverage states

**Files:**
- Modify: `frontend/src/components/Leaderboards/Leaderboards.jsx` (the metric select around line 190, the raw value at line 155, and the empty state around line 119)
- Test: `frontend/src/components/__tests__/Leaderboards.test.jsx`

**Interfaces:**
- Consumes: the `ADVANCED_CONFIG` rows' `group`, `direction` and `since`, and `rawValue(weeks, row)`.

- [ ] **Step 1: Write the failing tests:**
  - `metric select groups options by section`: `optgroup[label="CHARTING · PFR"]` contains `Drop Rate`.
  - `new metrics show the stored raw value`: a row with `advancedValues.snapShare = 0.923` renders `92.3%`.
  - `a season before the metric's source shows the coverage message`: Drop Rate with 2017 shows `PFR CHARTING STARTS IN 2018`.
  - `the key notes style metrics`: the Avg Cushion key contains "higher isn't better or worse".
- [ ] **Step 2: Run them to see them fail.** Run `npm --prefix $WT/frontend test -- Leaderboards`. Expected: FAIL.
- [ ] **Step 3: Implement.**
  - Build the optgroups from `groupRows(metrics)`.
  - Call `metricRow.rawValue(row.weeks ?? [], row)`.
  - The coverage check `metricRow.since && season < metricRow.since` runs before the loading and empty branches.
- [ ] **Step 4: Run the full frontend suite with coverage.** Run `npm --prefix $WT/frontend run test:coverage`. Expected: all pass, at or above 85/83/82/77.
- [ ] **Step 5: Show it live** at 375 and 1280.
- [ ] **Step 6: Commit after OK.**
  ```bash
  git commit -m "feat(leaderboards): group metrics and explain coverage gaps"
  ```

---

### Task 13: Viewport sweep, full verification, docs

**Files:**
- Modify: `docs/adr/DECISIONS.md` (new entries: season-level `advancedValues`; style-direction metrics)
- Modify: `README.md` (the data section)
- Modify: `docs/CHANGELOG.md`
- Modify: `AGENTS.md` (the "Data sources" list)

- [ ] **Step 1: Run the overflow sweep.**
  - Widths: 320, 375, 768, 832, 1024 and 1440.
  - Surfaces: Advanced (QB, WR, RB, 2017 QB), Overview tabs, Compare, Career, Leaderboards.
  - Run `javascript_tool` with `document.documentElement.scrollWidth - document.documentElement.clientWidth` on each.
  - Expected: 0 everywhere. Fix any overflow on the owning branch with a new commit.
- [ ] **Step 2: Run all three suites.**
  - `cd $WT/etl && $PY -m pytest`
  - `npm --prefix $WT/backend run test:coverage`
  - `npm --prefix $WT/frontend run test:coverage`
  - Also lint both JS packages.
  - Expected: all green and coverage floors met.
- [ ] **Step 3: Write the docs.**
  - Add the ADRs.
  - Update the README data section, including the new limitations: the NGS volume floor and PFR 2018+.
  - Add a CHANGELOG entry and update AGENTS.md's data sources.
- [ ] **Step 4: Show the docs diff, then commit after OK.**
  ```bash
  git commit -m "docs: record the advanced stats expansion"
  ```
  Commit this on `feature/advanced-stats-ui`.

---

### Task 14: Promotion (each step gated on the user)

- [ ] **Step 1: Ask about the uncommitted Prettier reformat** of `AdvancedPanel.jsx` in `$MAIN`: commit it or discard it. Do whichever the user chooses.
- [ ] **Step 2: Merge into develop.** In `$MAIN` on `develop`, run `git merge --no-ff --no-edit` for each branch in stack order. Lint, then run all three suites.
- [ ] **Step 3: Merge to main** only on an explicit go-ahead from the user. That deploys to production.
- [ ] **Step 4: Backfill live.** Immediately after deploy, with the user's OK, run the Task 5 backfill loop without `DB_NAME`, which writes to live `statsnap`. Verify a live player page shows the new stats.
- [ ] **Step 5: Drop the preview database** (`statsnap_preview`) with the user's OK.
- [ ] **Step 6: Tear down.**
  - Remove the symlinks.
  - Run `git worktree remove $WT` and `git worktree prune`.
  - Remove the preview launch configs.
  - Delete the merged branches locally, and on the remote if they were pushed.
