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

### Fixed

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
