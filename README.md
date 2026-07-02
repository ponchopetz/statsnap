# StatSnap

Free, fast advanced NFL skill-position metrics — instant player lookup with no paywall.

**Live app:** https://statsnap-frontend-4cxi.onrender.com

StatSnap is a full-stack web app for looking up advanced NFL skill-position
stats (QB, RB, WR, TE) the way paid services present them — target share, air
yards share, WOPR, RACR, EPA, CPOE, aDOT — alongside the counting stats and
fantasy scoring fans already know. The gap it fills: advanced metrics like these
are normally locked behind PFF or SumerSports subscriptions or buried in raw
data dumps. StatSnap pulls them from the open-source nflverse dataset, computes
each stat under a single canonical definition, and serves them through a clean,
keyboard-fast interface that anyone can use for free.

Built as the capstone for the TripleTen Software Engineering bootcamp, with
sports-tech employers as the intended audience — so the architecture decisions
are documented and defensible, not just functional.

## Tech stack

**Frontend (`frontend/`)**
- React 18.3 + Vite 5.3 (ES modules)
- React Router 6.30
- ESLint 8.57 (legacy `.eslintrc.cjs`) + Prettier 3.3
- No CSS framework — hand-rolled design tokens, JetBrains Mono + Space Grotesk
- Dev server on port 3000

**Backend (`backend/`)**
- Node + Express 5.2 (CommonJS)
- Mongoose 9.6 against MongoDB Atlas
- `cors` 2.8, `dotenv` 17.4, `node-cron` 4.4 (schedule cache refresh)
- `nodemon` 3.1 for dev
- Dev server on port 3001

**ETL (`etl/`)**
- Python 3.11.9 (pinned via `.python-version`)
- `nflreadpy` 0.1.5 (nflverse data access)
- `polars` for transforms, `pymongo` for the bulk upsert, `python-dotenv` for config

**Data & external APIs**
- MongoDB Atlas — `statsnap` database, `playerstats` and `schedules` collections
- nflverse — player stats and player identity (headshot, jersey, height/weight, college, draft, age), via the Python ETL
- The Odds API — live NFL schedule (matchup + kickoff), cached in MongoDB

## Architecture

The two data paths are deliberately separate.

**Stats path:** `nflverse → Python ETL → MongoDB Atlas → Express API → React`.
The ETL (`etl/load.py`) pulls a season's player stats, rosters, and schedules
from nflverse, transforms and reshapes them into one document per player-season,
and bulk-upserts them into the `playerstats` collection. The Express API reads
that collection and serves it to the React frontend. There is no live nflverse
call on the request path — everything the player page needs is precomputed and
stored.

**Schedule path:** `The Odds API → cron-refreshed Mongo cache → API`. A
`node-cron` job inside the Express process (daily at 08:00 UTC, plus once on
boot) is the *only* caller of The Odds API. It writes one cache document per
`{ season, week }` into the `schedules` collection; every `GET /schedule`
request is served from that cache. API usage therefore tracks the cron schedule,
not user traffic — and the upstream being slow or down never affects a user
request. This also leaves a clean seam for the V2 betting-lines integration,
which will cost API credits where the events endpoint does not.

Full reasoning for each decision lives in
[`docs/adr/DECISIONS.md`](docs/adr/DECISIONS.md).

## Decision highlights

A few choices a reviewer might find worth discussing (each is expanded in the ADR log):

- **One document per player-season, weeks embedded.** Each `playerstats`
  document holds a player's identity and an embedded `weeks` array, so a single
  query returns identity, season summary, and full game log together — the exact
  shape the player page renders. The tradeoff (cross-player single-week
  leaderboards need `$unwind`) is accepted because those are out of V1 scope.

- **One stat, one definition — ratio-of-sums aggregation.** Season rates are
  computed as ratio-of-sums (e.g. completion % is `sum(completions) /
  sum(attempts)`), not as the mean of per-week rates. This came out of a real
  bug where passing EPA drifted between two tabs; the JS season helpers in
  `frontend/src/utils/stats.js` are now a deliberate mirror of the Python
  aggregation in `etl/percentiles.py`, enforced by a golden-file test
  (`npm test` in `frontend/`) generated from the Python side.
  One documented exception: target share, air-yards share, and WOPR are
  averaged across weeks, because a true ratio-of-sums for a share metric
  needs per-week *team* totals that aren't stored. Known limitation,
  slated for V2 alongside team-level data.

- **Idempotent bulk upsert in the ETL.** `load.py` writes with `UpdateOne` +
  `$set` + `upsert=True` keyed on `{ playerId, season }`, so a re-run replaces
  fields wholesale and is non-destructive. Adding schema fields is a loader
  re-run, not a migration script — proven when 18 counting-stat fields were
  added across all loaded seasons without downtime.

- **NFL week derived from a Tuesday-noon-ET boundary.** The Odds API gives
  kickoff timestamps, never week numbers. A naive Thursday-anchored calculation
  breaks on the 2026 season (a Wednesday opener). Tuesday is the one slot the
  league effectively never uses, so bucketing kickoffs against a Tuesday-noon-ET
  boundary correctly assigns Wednesday openers, Monday/Thursday night games,
  Saturdays, and international kickoffs with no per-game special cases. Validated
  against the real 2026 Week 1 slate.

## Local setup

### Prerequisites

- **Node.js** — version not pinned in the repo; Vite 5 and React 18 require
  Node 18+ (Node 20 LTS recommended)
- **Python 3.11.9** — pinned in `.python-version`
- **MongoDB Atlas** cluster (free M0 tier is sufficient)
- **The Odds API** key (free tier — 500 credits/month) for the schedule feature

The three parts install and run independently. Open a terminal per part.

### Backend

```bash
cd backend
npm install
cp .env.example .env   # then fill in the values below
npm run dev            # nodemon on http://localhost:3001  (npm start for plain node)
```

Set these in `backend/.env` (see `backend/.env.example` for the template — never
commit real values):

- `PORT` — API port (default `3001`)
- `MONGO_URI` — your MongoDB Atlas connection string (the database name is set in
  code as `statsnap`, not in the URI)
- `ODDS_API_KEY` — your The Odds API key
- `CORS_ORIGIN` — allowed frontend origin (default `http://localhost:3000`)

### Frontend

```bash
cd frontend
npm install
npm run dev      # Vite on http://localhost:3000 (opens the browser)
npm run build    # production build to frontend/dist
```

### ETL

The ETL loads one season per run, selected by the `SEASON` environment variable.

```bash
cd etl
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
# create etl/.env containing: MONGO_URI=your_atlas_connection_string
SEASON=2024 python load.py
```

Repeat the `load.py` run once per season to populate the dataset. StatSnap loads
the **2016–2025** seasons:

```bash
for season in 2016 2017 2018 2019 2020 2021 2022 2023 2024 2025; do
  SEASON=$season python load.py
done
```


## API endpoints

| Method | Path | Behavior |
|---|---|---|
| `GET` | `/` | Healthcheck — returns `{ status: "StatSnap API is running" }` |
| `GET` | `/players/search?q=` | Typeahead search by display name. Deduplicates a player across seasons via an aggregation pipeline; returns up to 10 rows of `playerId`, `displayName`, `position`, and most-recent `team`. Returns 400 if `q` is missing. |
| `GET` | `/players/:playerId` | All seasons for one player, sorted most-recent-first, each with its embedded `weeks` array and the `advanced` metrics map. Returns 404 if no documents match. |
| `GET` | `/schedule` | The freshest cached schedule document (`{ season, week, games, fetchedAt }`). On a cache miss returns a 200 with an empty `games` array — never a 404. |

## Scope (V1)

StatSnap V1 is intentionally bounded:

- **No authentication.** StatSnap has no per-user data to
  protect, so the full-stack track runs without accounts. Auth may return in V2
  if a saved-watchlist feature is added.
- **Tank01 (RapidAPI) deferred to V2.** It was originally reserved for live
  player-identity fetches, but nflverse already supplies every identity field the
  player page needs, so it is not used in V1.
- **Betting lines deferred to V2.** The schedule rail shows matchup and kickoff
  only; live betting lines on schedule cards are out of V1 scope.

Other deferrals (player comparison, leaderboards, postseason schedule, backend
hardening) 
