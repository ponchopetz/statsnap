# Advanced stats expansion — design

Date: 2026-11-05 · Status: draft for review

## Why

StatSnap's Advanced tab shows 6–7 percentile-ranked metrics per position, all
derived from nflverse's weekly `player_stats` file. nflverse publishes far more
season-level analytics that cost almost nothing to store: Next Gen tracking
data, expected fantasy points, snap counts, Pro Football Reference charting,
and big-play and fumble counts already sitting unused in the file the ETL
downloads. Adding them makes the Advanced tab the place a sports-analytics
visitor actually wants to dig into, without touching the 512 MB Atlas free
tier in any meaningful way (under 1 MB per season).

## Goals

- Add about 12–16 new advanced stats per position from five sources (below).
- Every new stat appears everywhere the current advanced stats do: the
  Advanced tab, Leaderboards, Compare, the Career arc's percentile mode, and
  the `? KEY` glossary, each with a plain-English definition.
- The Advanced tab stays easy to scan by using collapsible groups.
- A subtle hint on the ADVANCED tab tells visitors that's where the depth is.
- No horizontal overflow at any viewport, from 320px phones to desktop.
- All three test suites pass, with coverage at or above today's thresholds.
- Built in an isolated worktree against a separate preview database, so the
  live site and live data are untouched until promotion.

## Non-goals

- **Player context data:** combine results, contracts, injuries and depth
  charts are excluded.
- **Play-by-play or per-play data**, such as participation and FTN charting.
  It would blow the storage budget.
- **Overview tab changes.** Overview keeps the everyday spreadsheet stats
  (targets, yards, TDs) plus the one or two advanced cells it already has.
- **The team-totals fix for share metrics.** README §"limitations" notes that
  target share, air-yards share and WOPR are averaged across weeks.
  `ff_opportunity` carries team totals that could fix this, but the fix
  changes existing numbers and the JS/Python golden contract. Separate
  follow-up.
- **Playoff stats.** StatSnap stays regular-season only. Every new source is
  filtered to REG games.
- **Changing Similar Players (labs) or the Share card.** Both keep using
  today's metric set (see "Consumers that must not change").

## Anti-goals (would make this a failure even if it technically works)

- The Advanced tab feels crowded or overwhelming. The user rejected one long
  list and rejected group chips for exactly this reason.
- A stat with no better/worse direction (time to throw, cushion) reads as
  "good" because it has a lime P99 bar.
- A new source being late or missing breaks the weekly ETL run for the stats
  that already work.
- Any write to the live `statsnap` database before promotion.

---

## Data

### Sources (all verified against nflreadpy 0.1.5 on 2026-11-05)

| Source | Loader | Key | Seasons | In-season |
|---|---|---|---|---|
| Next Gen Stats | `load_nextgen_stats(s, stat_type=passing\|receiving\|rushing)` | `player_gsis_id` = `playerId` | 2016+ | yes: `week == 0` rows are season-to-date |
| Expected fantasy points | `load_ff_opportunity(s, stat_type="weekly")` | `player_id` = `playerId` | 2006+ | yes (weekly) |
| Snap counts | `load_snap_counts(s)` | `pfr_player_id` | 2012+ | yes (weekly) |
| PFR advanced | `load_pfr_advstats(s, stat_type=pass\|rush\|rec, summary_level="week")` | `pfr_player_id` | **2018+** (earlier raises `ValueError`) | yes (weekly) |
| Big plays, fumbles | `load_player_stats` (already downloaded) | `player_id` | all | yes |

All loaded seasons, 2016–2026, are covered by every source except PFR, which
is missing 2016–17. The 2026 data runs through week 8 for all five sources.

**ID crosswalk:** `load_rosters(s)` already loads in `transform.py` and
carries `pfr_id`. Joining on `gsis_id` covers 43/43 qualified QBs, 113/115
WRs, 45/45 TEs and 69/70 RBs in 2024. No extra download is needed.

**Next Gen volume floor:** NGS publishes season rows only for players who meet
its own volume minimum. In 2024 it covered 43/43 qualified QBs, 96/115 WRs,
33/45 TEs, and 47/70 RBs on the rushing file. It has **no receiving rows for
RBs**, so RBs get no separation or YAC-over-expected stats. Players below the
NGS floor show "—" for those rows.

**Scoring check:** `ff_opportunity` totals match nflverse
`fantasy_points_ppr`, within 2-point-conversion rounding, so its points are
PPR.

**Postseason:** `ff_opportunity` runs through week 22, and snap counts and PFR
include WC/DIV/CON/SB. Each must be filtered to regular-season games:
`game_type == "REG"` where present, and for `ff_opportunity` a join of
`game_id` to the season's REG schedule, which `transform.py` already loads.
If the two `game_id` formats turn out not to match, filter
`ff_opportunity` to `week ≤` the schedule's last REG week instead.

**Bucket semantics:** `passing_20`, `rushing_20`, `receiving_20` and their
`_40` versions count plays that gained **at least** N yards, so the 20+
count includes the 40+ plays. Checked: Lamar Jackson 2024 had 175, 56 and 14
for 10+, 20+ and 40+, and Derrick Henry had 19 runs of 20+ and 5 of 40+.

### Decision: season-level values, computed in the ETL

New stats are computed **once per player-season in Python** and stored on
the existing document:

- `advancedValues` is a new map of metric key to raw season value, written
  for every player who has source data, qualified or not.
- `advanced` is the existing percentile map. It gains the new keys, using the
  **same qualifier gates** (QB 150+ attempts, WR/TE 30+ targets, RB 50+
  carries) and the same ranking rules: nulls are excluded per metric,
  `rank(method="average")`, `(rank − 1) / (n − 1)`, and `0.5` for a cohort of
  one.

Nothing new is stored per week, and nothing new is re-derived in JavaScript.
The existing metrics keep computing their raw values in JS from `weeks`, as
the golden contract requires. New rows read `advancedValues[key]` directly.

Why: NGS season rows are official season numbers that can't be rebuilt from
its partial weekly rows. Per-week storage of the other sources would be
about 50% more storage per season, plus a second JS mirror of every formula
and golden fixture. Season-level storage adds about 1 KB per document.

**PFR is built from weekly files for every season.** That keeps finished and
in-progress seasons on one code path, since the 2026 QB season file isn't
published mid-season. The trade-off is losing season-file-only stats, such
as pocket time, on-target %, and play-action and RPO splits.

### Stat catalog

Each row lists the key (`advanced` / `advancedValues`), the display label,
the source and how it's aggregated, and the direction:

- **↑** higher is better.
- **↓** lower is better. These are ranked inverted, like `sacksSuffered`.
- **◇** style: there is no better or worse. It's ranked by raw value so P99
  means "most", and it is never colored as good or bad.

Rows marked ‡ are PFR and exist only for 2018+.

All sums are over regular-season games. A ratio is computed as a ratio of
season sums, never as an average of weekly ratios. When a PFR stat needs a
StatSnap denominator (attempts, targets), only the games that have a PFR row
for that player count toward it.

Percent-type values are stored as decimals from 0 to 1, so the existing
`formatPercent` works. NGS publishes some on a 0–100 scale and some on a 0–1
scale, so the builder must normalize each one.

**Shared keys** mean the same thing at every position where they appear:

| key | label | source → aggregation | dir |
|---|---|---|---|
| `snapShare` | Snap Share | snaps: Σ`offense_snaps` ÷ Σ team offensive snaps, in REG games where he logged at least 1 offensive snap. Team snaps for a game = max `offense_snaps` of any teammate in that game, since the offensive line plays every snap. | ↑ |
| `expectedPprPoints` | Expected PPR Pts | ff: Σ`total_fantasy_points_exp` | ↑ |
| `pprPointsOverExpected` | Pts Over Expected | ff: Σ`total_fantasy_points_diff` | ↑ |
| `expectedTds` | Expected TDs | ff: Σ`total_touchdown_exp` | ↑ |
| `expectedReceptions` | Expected Receptions | ff: Σ`receptions_exp` | ↑ |
| `brokenTackles` | Broken Tackles | PFR: Σ(`rushing_broken_tackles` + `receiving_broken_tackles`). Both the rush and rec files carry both columns, so **dedupe on (player, game)** before summing. | ↑ ‡ |
| `plays20Plus` | position label (below) | player_stats: Σ`passing_20` (QB) / `rushing_20` (RB) / `receiving_20` (WR, TE) | ↑ |
| `plays40Plus` | position label (below) | same with `_40` | ↑ |
| `fumbles` | Fumbles | player_stats: Σ(`sack_fumbles` + `rushing_fumbles` + `receiving_fumbles`), lost or not | ↓ |

**QB.** 7 existing + 11 new = 18 rows, in 5 groups:

| group | rows (existing *in italics*) |
|---|---|
| EFFICIENCY | *Passing EPA*, *Passing CPOE*, *PACR*, *Passing Air Yards*, *Avg Depth of Target* |
| TRACKING · NEXT GEN | `timeToThrow` Time to Throw (NGS `avg_time_to_throw`, seconds) ◇ · `aggressiveness` Aggressiveness (NGS `aggressiveness`: share of throws into tight windows) ◇ · `airYardsToSticks` Air Yards to Sticks (NGS `avg_air_yards_to_sticks`) ◇ |
| PRESSURE | `pressureRate` Pressure Rate (Σ`times_pressured` ÷ (Σattempts + Σsacks)) ↓‡ · `badThrowPct` Bad Throw % (Σ`passing_bad_throws` ÷ Σattempts) ↓‡ · *Sacks Suffered* · *Sack Yards Lost* |
| EXPECTED POINTS | Expected PPR Pts · Pts Over Expected · Expected TDs |
| BIG PLAYS & FUMBLES | 20+ Yd Completions · 40+ Yd Completions · Fumbles |

**WR and TE.** 7 existing + 16 new = 23 rows, in 6 groups. WR and TE stay
separate percentile cohorts.

| group | rows |
|---|---|
| USAGE | *Target Share*, *Air Yards Share*, *WOPR*, Snap Share |
| EFFICIENCY | *Receiving EPA*, *RACR*, *YAC / Rec*, *Receiving Air Yards* |
| TRACKING · NEXT GEN | `separation` Avg Separation (NGS `avg_separation`) ↑ · `cushion` Avg Cushion (NGS `avg_cushion`) ◇ · `yacOverExpected` YAC Over Expected (NGS `avg_yac_above_expectation`, per catch) ↑ · `catchRate` Catch Rate (NGS `catch_percentage`) ↑ |
| CHARTING · PFR | `dropRate` Drop Rate (Σ`receiving_drop` ÷ Σtargets) ↓‡ · Broken Tackles ↑‡ · `ratingWhenTargeted` Passer Rtg When Tgt (NFL passer-rating formula on his season targets, receptions, receiving yards and receiving TDs, plus Σ`receiving_int`, with each component clamped to [0, 2.375]) ↑‡ · `intsWhenTargeted` INTs When Targeted (Σ`receiving_int`) ↓‡ |
| EXPECTED POINTS | Expected PPR Pts · Pts Over Expected · Expected TDs · Expected Receptions |
| BIG PLAYS & FUMBLES | 20+ Yd Catches · 40+ Yd Catches · Fumbles |

**RB.** 6 existing + 15 new = 21 rows, in 6 groups. EFFICIENCY comes
first so that Rushing EPA stays the first row (see the note below the
tables).

| group | rows |
|---|---|
| EFFICIENCY | *Rushing EPA*, *YAC / Rec*, *Receiving Air Yards* |
| USAGE | *Carries*, Snap Share, *Target Share*, *WOPR* |
| TRACKING · NEXT GEN | `ryoePerAtt` RYOE / Att (NGS `rush_yards_over_expected_per_att`) ↑ · `runsOverExpectedPct` Runs Over Expected % (NGS `rush_pct_over_expected`) ↑ · `eightBoxPct` 8+ Defenders in Box (NGS `percent_attempts_gte_eight_defenders`) ◇ · `timeToLos` Time to LOS (NGS `avg_time_to_los`) ◇ |
| CHARTING · PFR | `beforeContactPerAtt` Before Contact / Att (Σ`rushing_yards_before_contact` ÷ Σ PFR `carries`) ↑‡ · `afterContactPerAtt` After Contact / Att (Σ`rushing_yards_after_contact` ÷ Σ PFR `carries`) ↑‡ · Broken Tackles ↑‡ |
| EXPECTED POINTS | Expected PPR Pts · Pts Over Expected · Expected TDs · Expected Receptions |
| BIG PLAYS & FUMBLES | 20+ Yd Runs · 40+ Yd Runs · Fumbles |

**Each position's first row stays today's first row:** Passing EPA, Target
Share and Rushing EPA. Leaderboards uses `ADVANCED_CONFIG[p][0]` as its
default metric, and the Career arc's percentile mode uses it as its default
chip, so neither default changes.

QBs get no Snap Share, because it's about 100% for every starter. Labels
are at most about 20 characters so they fit the phone label column; longer
ones may wrap to a second line, but must never push the row wider.

### ETL changes

- **New module `etl/season_sources.py`.** It holds one function per source.
  Each takes the season plus what it needs (REG game ids, the crosswalk, the
  weekly frame) and returns a Polars frame keyed by `playerId` with the raw
  season columns above. A combiner outer-joins them into one frame.
- **`transform.py`:**
  - Keeps the extra `player_stats` columns it needs for big plays and
    fumbles. These are used only for the season frame and are not added to
    `WEEK_FIELDS`.
  - Builds the season frame.
  - Returns it alongside `(clean_df, advanced_map)`.
- **`percentiles.py`:**
  - Joins the season frame onto the `_aggregate_season` output by
    `playerId`.
  - Extends each position's `metrics` and `inverted` sets.
  - Style metrics rank like normal ↑ metrics; their direction only matters
    in the UI.
- **`load.py`:**
  - Attaches `doc["advancedValues"]`.
  - `DB_NAME` becomes `os.environ.get("DB_NAME", "statsnap")`.
- **Missing-source policy:**
  - A source that the library reports as *not published for this season*
    is skipped with a logged warning. That includes PFR before 2018, which
    is skipped without a request, and an HTTP 404 for the current season.
    Those stats are then absent.
  - Any other error fails the run, so the existing ETL-failure GitHub issue
    fires. Examples are a renamed column or a network failure.
  - A late source can't take down the stats that already work, and a schema
    change can't silently erase a stat forever.

### Backend changes

- `models/playerStats.js` gets `advancedValues: { type: Map, of: Number }`.
- The projection allowlists in `controllers/players.js` (`getPlayerById`) and
  `controllers/leaderboards.js` gain `advancedValues: 1`.
- `leaderboards.js` `METRIC_PATTERN` widens to `/^[a-zA-Z][a-zA-Z0-9]{0,39}$/`
  so that `plays20Plus` is accepted. It's still impossible to inject a `.`
  or `$`.
- `utils/db.js` uses `dbName: process.env.DB_NAME || 'statsnap'`. This
  amends the "Database name in code" ADR: the default stays visible in code,
  and the override exists only to point a preview at a copy.

---

## UI

### Single config, extended

`ADVANCED_CONFIG` in `utils/stats.js` stays a **flat ordered array per
position**, so every existing consumer keeps working. Each row gains:

- `group` is the group label. Rows are ordered by group.
- `direction` is `"higher" | "lower" | "style"`.
- `since` is the first season the source exists. It's 2018 for PFR rows and
  can be omitted otherwise.
- `rawValue(weeks, player)` gains a second argument. Existing rows ignore it,
  and new rows read `player.advancedValues?.[key]`, showing "—" when it's
  missing.

A small helper groups rows for the components that need groups.
`compare.js`'s `LOWER_IS_BETTER_LABELS` is replaced by reading `direction`.

**Contract test:** `generate_golden.py` exports Python's per-position metric
lists and inverted sets into the golden JSON. A JS test asserts that every
`ADVANCED_CONFIG` key exists in Python's list for that position, and that
`direction === "lower"` matches Python's inverted set exactly. It also
asserts that every label has a `STAT_GLOSSARY` entry.

### Advanced tab: collapsible groups (user's pick, mockup option A)

- **Group headers:**
  - Each group is a full-width header button with `aria-expanded` and
    `aria-controls`. It shows a chevron, the group name, the row count, and
    on wide containers a one-line preview of the group's first row that
    has a value ("Target Share · 27.9% · P98"). If no row in the group has a
    value, the preview is "—".
  - The preview hides below about 420px of container width and while the
    group is open.
- **Opening and closing:**
  - Several groups can be open at once.
  - The **first group starts open**. Everything else is one tap away.
  - `? KEY` opens every group and every definition. Turning KEY off restores
    the groups that were open before.
  - Open state resets when a different player-season loads. Nothing is
    stored.
- **Row states:** Rows keep today's markup: label with `?`, bar, P##, value.
  - A **style** row draws its bar in the neutral `--fg-3` instead of the
    accent.
  - A row with no value shows "—" for both the value and P##, with an empty
    bar. That covers a source that didn't exist yet, a player under the NGS
    floor, or a missing crosswalk.
- **Footnote** adds one line: "Next Gen Stats cover players above its own
  volume minimum. PFR charting starts in 2018."
- No "NEW" tags on groups. They'd go stale within weeks, and the tab badge
  is the nudge.

### ADVANCED tab badge (user's pick, hint mockup option A)

- **What it shows:** A small lime count chip sits after the ADVANCED label,
  showing `ADVANCED_CONFIG[position].length` (18, 21 or 23). There's no badge
  for a position without config.
- **Pulse:**
  - It pulses **in step with the header's live dot**. Same `pulse`
    keyframes, same 1.8s period, phase-locked to the document timeline so
    the two stay in sync no matter when each mounted. The builder picks the
    mechanism: a negative `animation-delay` from `performance.now() % 1800`
    applied to both, or setting both animations' `startTime` to 0 through
    the Web Animations API (guarded for jsdom).
  - It stops pulsing while the ADVANCED tab is active.
  - It doesn't animate under `prefers-reduced-motion: reduce`.
- **Narrow widths:** At the tabs' narrowest container query (≤420px) it
  shrinks to a 6px dot. Tab padding is tuned so the five tabs fit on one line
  at 320px with no overflow; the rough mockup was 1px over.

### Compare

- **Groups:** Advanced rows use the same groups, collapsible in the same
  way, with the first group open. Each group header shows a **win tally**
  ("A 3 · B 1"), which serves as its collapsed preview. The tally counts
  only rows that have a winner, so style rows, ties and rows with "—" are
  left out.
- **Winners:**
  - A style row never gets a winner highlight. Both values and percentiles
    still show.
  - A row where either side has no value has no winner, which is the
    existing `winner()` behavior.
  - The higher percentile wins, unchanged, since inverted metrics are
    already flipped by the ETL.
- **Mixed seasons:** For cross-season compares (say 2017 against 2024), the
  2017 side shows "—" on PFR rows.

### Career arc (percentile mode)

- Percentile-mode stat chips are laid out **by group**: a small group label,
  then that group's chips, wrapping. The chart and axis are pushed below it,
  as the user said is fine.
- Totals mode is unchanged.
- A season with no value draws as a gap, which is existing behavior, and
  counts as UNRANKED.
- For a style stat, the summary label reads HIGHEST instead of BEST. The
  longest time to throw isn't his best season.

### Leaderboards

- The METRIC `<select>` uses one `<optgroup>` per group.
- The raw-value column calls `rawValue(row.weeks, row)`.
- The `? KEY` shows the metric's definition. For a style metric it adds
  "ranked by value; higher isn't better or worse".
- Choosing a season before a metric's `since` shows "PFR CHARTING STARTS IN
  2018" instead of "NO QUALIFIED QBS FOR 2017 YET".

### Glossary

`STAT_GLOSSARY` gets one plain-English entry per new label. Each ↓ entry
says lower is better. Each ◇ entry says it describes style, not quality.
Each ‡ entry notes that it's 2018+. NGS entries note the volume minimum.

### Consumers that must not change

- **Share card** (`ShareCard.jsx`, `buildAdvancedRows(player).slice(0, 7)`)
  must keep showing today's metrics. Pick them by key, not by array position,
  because the reorder would change the first 7.
- **Similar Players (labs)** uses every key in `advanced`, so it would
  silently shift with the new keys and their coverage gaps. Give
  `utils/similarity.js` an explicit allowlist of today's keys. Expanding
  comps is a possible follow-up.

---

## Isolation, rollout and verification

- **Worktree:**
  - Create `git worktree add ../StatSnap-preview -b integration/advanced-stats develop`
    and symlink `frontend/node_modules`.
  - Per-change branches come off `develop` and merge into the integration
    branch.
  - Nothing is committed until the user has seen the change live and
    approved it.
- **Preview database:**
  - The worktree's ETL and backend run with `DB_NAME=statsnap_preview`, set
    in the gitignored `.claude/launch.json` env and on the ETL command line.
  - Backfill all 11 seasons there. That's about 60 MB, for about 120 MB
    total of 512.
  - The live `statsnap` database is never written during development.
- **Before promotion:** `develop`'s working tree has an uncommitted,
  Prettier-only reformat of `AdvancedPanel.jsx`. This feature rewrites that
  file, so the reformat must be committed or discarded before merging
  (user's call at that point).
- **Promotion:**
  1. Merge each branch into `develop` with `--no-ff`.
  2. On the user's go-ahead, merge to `main`. That deploys code that already
     renders missing data as "—".
  3. Right after, run the backfill for all 11 seasons against live
     `statsnap`. It's additive and takes minutes.
  4. Drop `statsnap_preview` with the user's OK.
  5. The weekly CI ETL then keeps the current season fresh on its own.
- **Tests:**
  - **ETL (pytest):** fixture frames, no network, covering:
    - REG filtering for each source
    - week-0 selection and percent normalization
    - crosswalk joins
    - ratio-of-sums denominators limited to games that have PFR rows
    - broken-tackle dedupe
    - passer-rating clamps
    - the missing-source skip vs. fail policy
    - inverted and style ranking
    - `advancedValues` written by `load` (throwaway mongod)
  - **Backend (Vitest):** projections include `advancedValues`, the widened
    metric pattern, the similarity allowlist, and the `DB_NAME` default.
  - **Frontend (Vitest + RTL):**
    - group toggle, first group open, and KEY opens all
    - style bar class and missing-value "—"
    - badge count, active-tab and dot states
    - Compare tally and style no-winner
    - grouped arc chips
    - Leaderboards optgroups and the pre-`since` empty state
    - the contract and glossary-coverage tests
  - Coverage stays at or above 85/83/82/77 for frontend and 88/88/80/85 for
    backend.
- **Viewport sweep:** in the browser pane, against the preview DB:
  - widths of 320, 375, 768, 832 (52rem), 1024 (64rem) and 1440
  - every changed surface, with a QB, a WR, an RB and a 2017 season
  - checked for zero horizontal overflow (`scrollWidth === clientWidth` on
    the document)
- **Docs:**
  - ADRs in `docs/adr/DECISIONS.md`: season-level `advancedValues`, the
    `DB_NAME` override amendment, and style-direction metrics.
  - `README.md` data section and `docs/CHANGELOG.md`.
  - The "Data sources" list in `AGENTS.md`.

## Decisions

**The user's:**
- **Scope:** the five sources above and no player context, shown on every
  advanced surface.
- **Overview** stays basic.
- **Layout:** collapsible groups, and the arc chips may push the chart down.
- **Hint:** a count badge pulsing with the live dot.
- **Quality bar:** no overflow on any viewport, all tests green.
- **Process:** isolated worktree, preview DB, plan first, then "go with all
  your recs".

**Builder/assistant calls (accepted wholesale, listed for review):**
- **Data model:** season-level `advancedValues`, with PFR built from weekly
  files.
- **Stats:** the per-position stat lineup and grouping above, and the
  direction (↑ ↓ ◇) of each stat.
- **Missing data:** 2016–17 PFR shows "—" with a note, and the
  missing-source skip vs. fail policy.
- **Formulas:** snap share counts only games with offensive snaps;
  denominators come from the same games.
- **Style stats:** neutral bars, no Compare winner.
- **Compare:** collapsible groups with a win tally. The tally skips style
  rows, ties and "—" rows.
- **Defaults:** RB's EFFICIENCY group comes first so that each position's
  default stat stays the same.
- **Career arc:** HIGHEST instead of BEST for style stats.
- **Leaderboards:** optgroups and the pre-2018 empty state.
- **Badge:** constant count, stops while the tab is active, reduced-motion
  respected, dot on narrow widths. No NEW tags.
- **KEY** opens all groups.
- **Left alone:** Similar Players and the Share card are frozen to today's
  metrics, and the share-metric fix is out of scope.
- **Backend:** the widened metric-key pattern.
- **Rollout:** preview DB named `statsnap_preview`, deploy then backfill,
  and this doc's location in `docs/specs/`.

## Left to the builder

- Exact display formats, matching existing style: decimals without units,
  percents as `%`, signed values with +/−, seconds as `2.81s`.
- Group-header CSS details within the aesthetic lock (90° corners, 1px rules,
  mono labels, lime accent).
- The pulse-sync mechanism (see above).
- How `season_sources.py` splits its helpers internally.
- Chunk boundaries. Each chunk is shown live before it's committed, per
  AGENTS.md's small-chunk rule.
