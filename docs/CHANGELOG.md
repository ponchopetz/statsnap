# StatSnap — Changelog

All notable changes to StatSnap are recorded here. Versions follow
[semantic versioning](https://semver.org/): `MAJOR.MINOR.PATCH` — patch for
bug fixes, minor for new features, major for breaking or ground-up
redesigns. See `docs/adr/DECISIONS.md` ("App versioning") for the full
rationale.

This log starts at 1.0.0. Everything before that point is real work (175+
commits across ~20 chunks) but wasn't tracked against a version number as it
happened, so it isn't reconstructed here — `git log` and the ADR entries
under "Data & schema," "Frontend architecture," etc. are the record of that
period.

## [Unreleased]

### Added

- Leaderboards key: a ? KEY toggle in the board's header defines the
  selected metric, PCTL and GP, and follows the position and metric you
  pick. The stat definitions now live in one shared module, which also
  gives the Advanced panel the missing Carries and sack definitions. On
  phones the controls fill the width and the table fits without sideways
  scroll (position badge hidden, cells tightened, PCTL as a number).

### Changed

- Player stats refresh daily (10:17 UTC) instead of once a week on Thursday.
  A week's stats now fill in game by game, by the morning after each game.

### Fixed

- QB Sack Yards Lost percentile was upside down on the Advanced panel and
  the leaderboard. nflverse stores sack yardage as negative yards, and
  ranking that raw sum with the "fewer is better" inversion flipped it
  twice, so the QB who lost the fewest yards ranked last. The ETL now ranks
  the magnitude, and every loaded season (2016–2026) was reloaded with it.
- Career tab: the career table, the CAREER ARC stat buttons and the player
  page tabs no longer overflow sideways. The table tightens and tucks each
  season's team under the year, the arc's stat buttons wrap into rows
  (PERCENTILE overflowed even on desktop), and long careers label the arc
  axis '16 over 23. Each sizes itself by its own width (container queries),
  so they also fit in the two-column layout just past 832px.
- Advanced panel: the KEY button stays highlighted while every definition
  is showing; before, it only flashed while pressed. A stat's "?" fills in
  while its definition is open and takes an accent outline on hover.
- Weekly ETL load: the 2026-10-29 run failed before loading anything, so
  player stats stopped updating after the 2026-10-22 load. GitHub moved
  `ubuntu-latest` to Ubuntu 26.04, and `actions/setup-python` has no Python
  3.11.9 build for it. Python is now 3.11.18, and every workflow job pins
  `ubuntu-24.04`, so a future runner-image change can't break a run without
  a deliberate edit here.

## [1.2.0] — 2026-10-16

The schedule rail keeps the whole NFL week with final scores, plus the LABS
prototypes and broader test coverage that landed since 1.1.0. Minor bump: new
features, no breaking changes to the API or the stored documents (new
optional fields only).

### Added

- Schedule rail keeps the whole week: finished games stay on the rail with
  their final score, games under 4h past kickoff show LIVE, and the rest keep
  their kickoff time. Finals come from The Odds API `/scores` endpoint,
  called only when a game needs one and at most once an hour (about 50–70 of
  the free plan's 500 monthly credits at worst).
- A scheduled GitHub Actions workflow wakes the free-tier backend after each
  game window so final scores are cached before anyone visits.

### Added (LABS, flagged off by default)

- Similar players: "plays like" comps under the Advanced tab from a new
  `GET /players/:id/similar` (mounted only with `FEATURE_SIMILAR=true`),
  EPA-weighted, with a THIS SEASON / ALL SEASONS scope.
- Form line: last 3, 4, or 6 games vs season for the headline stats on
  Overview.
- Share card: exportable 1200×630 SVG/PNG player card at `/players/:id/card`
  with the page fonts embedded in the export.
- Enable per browser with `/?labs=similar,form,shareCard`. See
  `PROTOTYPES.md`.

### Changed

- Test suite covers the remaining UI (Landing, PlayerSearch, Typeahead,
  TweaksPanel, Tabs keyboard handling, Compare page, Splits panel, App
  routing, ErrorBoundary, API client) and enforces coverage thresholds set
  just under the measured baselines. Frontend line coverage 69% → 88%.

## [1.1.0] — 2026-09-16

Three new pages and tabs for arguing about players, a real test suite, and
four correctness fixes. Minor bump: new features, no breaking changes to the
API or the stored documents (new fields only).

### Added

- **Compare** (`/compare`): two players at one position, each with their own
  season, six headline stats and every advanced metric with mirrored
  percentile bars, swap and copy-link. Entry points: landing nav and a
  COMPARE button on the player page.
- **Splits** tab on the player page: home/away, wins/losses, in/out of
  division, weeks 1–9 vs 10+, against a full-season baseline.
- **Leaderboards** (`/leaderboards`): qualified players ranked by the ETL
  percentile per season, position, and metric, with a minimum-games filter.
  New endpoints `GET /leaderboards` and `GET /seasons`.
- **Career Arc** under the Career table: one stat across every loaded
  season with age under each point, as season totals or as the ETL
  percentile rank (an unqualified season draws as a gap).
- One shared headline-stat list (`utils/headline.js`) that Overview and
  Compare both read; Overview's three position components collapse into one.
- Per-week `team` on every embedded week; the game log shows a TEAM column
  for a season split across two teams.
- Test suite: Vitest + React Testing Library (frontend), Vitest + supertest +
  mongodb-memory-server (backend), pytest against a throwaway local `mongod`
  (ETL), a pull-request CI workflow, and `TESTING.md`. The JS/Python
  aggregation contract is now enforced in both directions.
- A LABS flag mechanism (`utils/flags.js`) for future prototypes; nothing is
  behind it in this release. See `PROTOTYPES.md`.

### Fixed

- Season PACR and RACR read as a negative ratio when a player's air-yard
  total was negative; they now read as no value, matching the ETL. Share
  metrics with no non-null week showed `0.0%` instead of no value.
- A player traded mid-season was labelled with his first team all season.
  The season document now carries the team he finished on, each week stores
  its own team, and the game log shows a TEAM column for split seasons.
  Takes effect per season on the next loader run.
- A duplicated roster row (seen in the 2025 file) doubled that player's
  weekly rows in the ETL join. Roster rows are deduplicated per player.
- `GET /players/search` returned 500 instead of 400 for a repeated `q`
  parameter.
- Player page bio grid undercounted experience by one: nflverse `years_exp`
  counts seasons completed before the current one, so a rookie showed `0`
  and a fourth-season player `3`. The cell is now labelled `NFL SEASON` and
  shows `ROOKIE` or the season ordinal (`4TH`), computed by a single
  `formatExperience()` helper.

## [1.0.0] — 2026-09-01

Initial versioned release. Marks the app as it stood after the TripleTen
capstone instructor review passed and the site went live on Render: player
search and lookup, per-position Overview/Advanced/Game Log/Career tabs,
sparkline and by-week rail, live NFL schedule rail, and a fully responsive
layout.

Live app: https://statsnap-frontend-4cxi.onrender.com
