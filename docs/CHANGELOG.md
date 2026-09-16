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

### Added (LABS, flagged off by default)

- Similar players: "plays like" comps under the Advanced tab from a new
  `GET /players/:id/similar` (mounted only with `FEATURE_SIMILAR=true`).
- Form line: last four games vs season for the headline stats on Overview.
- Share card: exportable 1200×630 SVG/PNG player card at `/players/:id/card`.
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
