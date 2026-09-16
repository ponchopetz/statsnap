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

None yet on this branch. See the `feature/labs-ideas` branch (similar
players, career arc, form line, share card) once it lands.

## Verification notes

- All suites (`TESTING.md`) cover the graduated features.
- The pages were exercised in the browser against a throwaway local `mongod`
  seeded by the real ETL for 2024 and 2023 (`.claude/launch.json` on this
  machine has `statsnap-backend-scratch` and `statsnap-frontend-scratch`
  entries on ports 3011 and 3010).
