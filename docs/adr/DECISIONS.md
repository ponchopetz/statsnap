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

### Schedule data source: The Odds API, cached in MongoDB (supersedes nflverse)

Decision: The landing-page schedule rail reads matchup and kickoff from The Odds
API events endpoint, cached in MongoDB. This reverses the earlier "nflverse, not
The Odds API" decision below it.

Why: The Odds API is StatSnap's V1 live third-party API, satisfying the
program's live-integration requirement (Tank01 is dropped from V1 since nflverse
already covers identity). The free `/v4/sports/americanfootball_nfl/events`
endpoint returns `id`, `commence_time`, `home_team`, `away_team` — exactly the
matchup and kickoff a card shows. Critically, the events endpoint costs zero
credits, so the honest justification for caching is NOT credit budget: it is
resilience (user traffic never depends on upstream availability) and a clean
seam for the V2 betting-lines integration, which will cost credits. nflverse
schedule data is still pulled in the ETL, but only to enrich each player's weeks
array with opponent/score/result context — it is not a standalone schedule feed.

Architecture: a `node-cron` job inside the Express process is the only caller of
the API. It refreshes one cache document per `{ season, week }`; every user
request is served from that cache via `GET /schedule`. API usage tracks the cron
schedule, not user traffic.

Tradeoff: The events endpoint returns full team names ("Dallas Cowboys"), not
codes, and carries no network or records. A name-to-code map handles the former;
network and records are out of V1 scope. Validated live against the real 2026
Week 1 slate (16 games, all correctly mapped and bucketed, zero credits).

### NFL week derivation: Tuesday-noon-ET boundary

Decision: A game's NFL week is derived from its `commence_time` by bucketing
against a per-season boundary anchored at Tuesday noon Eastern (stored UTC),
striding forward in exact 7-day intervals. Weeks outside 1–18 return null. The
season is resolved the same way via `seasonForDate` off the same boundary table,
so a January game maps to the prior season with no separate constant. Boundaries
are hand-maintained config: 2025 at `2025-09-02T16:00:00Z`, 2026 at
`2026-09-08T16:00:00Z`.

Why: The Odds API gives kickoff timestamps, never week numbers. A naive
Thursday-anchored calculation breaks on the 2026 season, which opens on a
Wednesday — only the second Wednesday opener in NFL history. Tuesday is the one
slot the league effectively never schedules (about four Tuesday games since
1948), so a boundary placed in that dead zone buckets Wednesday openers, Monday
and Thursday night games, late-season Saturdays, and Friday/Sunday-morning
international kickoffs into the correct week with no per-game special cases.

Validation: the real 2026 Week 1 slate — Wednesday opener (NE @ SEA) through
Monday night (DEN @ KC) — all 16 games landed in Week 1.

Tradeoff: the per-season boundary is hand-maintained; a wrong anchor shifts every
week by one, so it is verified against the official schedule each season. Anything
outside the table returns null and falls back to the offseason empty state.

### Schedule cache refresh: defensive, cron-fed, refresh-on-boot

Decision: `refreshSchedule` anchors the current slate to the earliest upcoming
game, derives its season/week, and upserts that one `{ season, week }` document.
It writes nothing on an empty upstream or a null week. The cron refreshes daily
at 08:00 UTC and also runs once on server boot.

Why: Anchoring to the earliest real game rather than to "now" sidesteps the
Tuesday dead zone and makes the rail advance on its own as a week's games finish.
The empty/null-skip is the defensive rule that stops an offseason or error
response from overwriting a good cache. Refresh-on-boot repopulates within
seconds of a deploy or a restart (relevant on a sleep-prone free host) rather
than waiting for the next daily tick. The cron callback swallows and logs its own
errors, since a scheduler tick has no downstream error handler and an unhandled
rejection could crash the process.

Scope: only games that have not kicked off appear (the events endpoint omits
started games), so mid-week the slate shrinks — no full-week archive in V1.
Postseason is not shown: weeks past 18 derive null. Both are V2 considerations.
The `node-cron` scheduler serves the schedule cache only; the Python ETL remains
a separate process with its own (still undecided) scheduling mechanism.

### Schedule cache retention: accumulate, no pruning (V1)

Decision: The `schedules` collection is never pruned. Old `{ season, week }`
documents accumulate — roughly one per week, ~18 per regular season — and no TTL
index or delete step removes them.

Why: The accumulation is inert. `refreshSchedule` upserts keyed on
`{ season, week }`, so the daily cron overwrites the current week's single
document all week (no within-week growth); a new document is created only at the
week rollover, when the events endpoint stops returning the finished week's
games and the earliest upcoming game resolves to the next week. `GET /schedule`
serves `findOne().sort({ fetchedAt: -1 }).limit(1)` — exactly one document, the
freshest — and because every daily tick refreshes the current week's `fetchedAt`,
the current week always wins that sort. Stale prior-week documents never win the
read and never affect correctness. Each document is tiny (16 games, four short
fields each), so a full season is a few kilobytes against ~1,800 player-stat
documents on the M0 free tier — negligible.

Tradeoff: The collection grows unbounded across seasons. Accepted for V1: a
pruning job is more failure surface than the storage justifies, and a bug in
delete logic could remove the current week — a risk the inert-accumulation
design does not carry. Per scope discipline (no preemptive edge-case handling),
deletion is not built.

Bound, if ever needed: a MongoDB TTL index on `fetchedAt` (e.g. 14 days, longer
than a week so the live slate never expires mid-week) auto-deletes old documents
with zero application code. Caveat: a TTL keyed on `fetchedAt` also empties the
collection during the offseason, since nothing refreshes for months and every
document ages out — at which point the rail correctly shows the offseason empty
state. The heavier alternative is a prune step inside `refreshSchedule` that
deletes earlier weeks of the same season after upserting the current one.

### nflverse powers both stats and identity; Tank01 deferred to V2

Decision: All stats and all player identity (headshot, jersey, height/weight,
college, draft, age) come from nflverse via the ETL. Tank01 is deferred to V2.

Why: The live-third-party-API requirement is satisfied by The Odds API schedule,
so there is no need to introduce a live identity fetch in V1. nflverse
rosters/draft already supply every identity field the player page needs, pulled
through the same ETL as the stats. This supersedes the earlier plan to have
Tank01 own identity; that plan existed only to satisfy the live-API requirement,
which the schedule now covers. Tank01 stays parked as a possible V2 enrichment
source.

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
`opponent_team` and warns on any mismatch. Zero mismatches across 2016 to 2025.
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

### Golden-file test enforces the JS/Python mirror

Decision: the mirrored contract above is pinned by a generated golden file.
`etl/generate_golden.py` runs synthetic per-week rows (null-EPA weeks,
null-CPOE weeks, zero-air-yards ratios, skipped weeks) through the Python
aggregation and writes inputs plus expected outputs to
`frontend/src/utils/__tests__/golden-season-aggregates.json`. A Vitest
suite (`npm test` in `frontend/`) asserts every JS season helper
reproduces the Python numbers, including the null-means-no-basis
convention. Regenerate the golden file whenever the contract changes.

Why a golden file rather than duplicate hand-written tests: hand-written
expectations in both languages can drift exactly the way the
implementations can. Generating the expectations from one side and
asserting the other against them makes Python the single source of truth
for what the numbers should be, and any unilateral change to either side
fails the suite. Vitest is the project's first test dependency —
chosen because it is the standard runner for Vite projects.

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

### Responsive pass: desktop-down queries, hardcoded rem breakpoint legend

Decision (Chunk 20): The responsive pass uses max-width (desktop-down) media
queries, keeping the existing desktop CSS as the base layer and overriding only
at narrow widths. Breakpoint values are hardcoded per component in `rem`,
governed by a single canonical comment legend in `styles.css`, rather than
tokenized through a preprocessor. Two breakpoints: `lg` at 64rem (1024px), where
the player page's two-column identity/stats layout stacks, and `sm` at 30rem
(480px), the phone-polish tier where oversized numerals and identity type scale
down, padding tightens, and the keyboard-help strip hides.

Why desktop-down: The site was built desktop-first and is feature-complete on
desktop with zero mobile CSS. Mobile-first (min-width) would mean rewriting the
working base styles into the mobile layout and re-deriving the desktop layout
inside min-width queries — a large rewrite of CSS that already works, for no
user-facing gain. Max-width queries are the lowest-diff, lowest-regression path
for retrofitting responsiveness onto a complete build. Mobile-first remains the
right default for a greenfield build; this is the defensible exception for a
retrofit.

Why hardcode over a preprocessor: Vanilla CSS cannot use a custom property
inside a media query condition. `@media (max-width: var(--bp-lg))` is invalid,
because custom properties resolve per-element while a media query is evaluated
earlier, against the viewport, before any element exists. True breakpoint
tokenization is therefore impossible in vanilla CSS. Two approaches were weighed:

- Hardcoded legend (chosen): one comment block in `styles.css` documents the
  scale as the single source of truth; each component's media query repeats the
  matching `rem` value with a comment pointing back at the legend. Zero
  dependencies, zero build steps.
- PostCSS `@custom-media` (rejected): the draft Media Queries Level 5 syntax
  gives genuine single-source breakpoints, but needs `postcss-custom-media` plus
  `@csstools/postcss-global-data` (so definitions in `styles.css` are visible in
  component files) plus a `postcss.config.js` — two devDependencies and a config
  file to tokenize two values.

With only two breakpoints in a solo project, adding a preprocessor layer to
deduplicate two numbers is premature abstraction (YAGNI). The documented legend
bounds the drift risk to a single source of truth without the dependency cost.
Custom-media earns its place at a dozen breakpoints across a team, not here.

Why rem: A breakpoint in `rem` scales with the user's root font size, so a
reader who has increased their browser font gets the narrow-width layout at the
correct effective width. A px breakpoint ignores that preference. The
accessibility gain is free.

Tradeoff: The breakpoint value is physically repeated in each component's media
query rather than defined once. Accepted because the legend is the documented
source of truth and the value changes rarely. A centralized `responsive.css`
holding every query was rejected separately: it would co-locate the values but
split each component's styles across two files, breaking the per-component
folder convention.

### Responsive pass: desktop-down, hardcoded rem breakpoints, staggered reflow

Decision (Chunk 20): The site was made responsive with max-width (desktop-down)
queries, keeping the desktop CSS as the base layer and overriding only at
narrower widths. Three breakpoints, hardcoded per component in rem, governed by
a single comment legend in styles.css: 64rem (stat-row reflows six-across to
three), 52rem (player-page two-column layout stacks), 30rem (phone polish —
stat-row to two-across, type and padding shrink, keyboard-help strip hides).

Why desktop-down: The site was built and shipped desktop-first with zero mobile
CSS. Mobile-first would mean rewriting working base styles into the mobile
layout and re-deriving desktop inside min-width queries — a large rewrite of
working CSS for no user-facing gain. Max-width is the lowest-diff, lowest-
regression path for a retrofit. Mobile-first stays the right greenfield default.

Why hardcode over PostCSS custom-media: Vanilla CSS cannot use a custom property
in a media query condition (custom properties resolve per-element, after queries
are evaluated against the viewport), so breakpoints cannot be true tokens. The
preprocessor path needs two devDependencies plus a config file to tokenize two-
to-three values — premature abstraction. A documented legend bounds the drift
risk to one source of truth without the dependency cost. Breakpoints are in rem,
not px, so they scale with the user's root font size.

Why the breakpoints are staggered, not synced: The stat-row reflow (64rem) sits
deliberately wider than the page stack point (52rem). The stat-row lives inside
the stats column, which is narrowed by the 360px identity beside it while the
page is still two-column. It therefore runs out of horizontal room before the
viewport reaches the page's stack point. Briefly synced at 52rem mid-chunk, this
clipped the six-across row in the 832–960px band — two-column page, un-reflowed
row, no room. The fix was to let the row reflow earlier (wider) than the page
stacks.

Tradeoff and deferral: The staggered values are hand-coordinated; a component's
reflow point and the page's stack point must be reasoned about together. Container
queries (container-type: inline-size on .stats, @container on the stat-row) are
the architecturally correct fix — the row would respond to its own container
width and stop caring whether the page is two-column or stacked. Deferred as its
own sub-chunk with an explicit concept waiver rather than mixed into this pass,
since it introduces a second responsive mechanism alongside the max-width
convention.

Sparkline scaling: Changed from preserveAspectRatio="none" to a fixed
aspect-ratio box matching the viewBox, so the chart scales uniformly at every
width instead of stretching one axis. Distortion (flat on wide screens, spiky on
narrow) was the symptom; non-uniform stretching of a fixed canvas was the cause.

## Security & deployment

### Backend hardening scope: helmet + rate limiting only

Decision: V1 hardening is helmet (security response headers) plus express-rate-limit
(100 requests/minute/IP, with trust proxy set for Render). Request validation libraries
and structured logging are deliberately NOT added.

Why helmet and rate limiting: helmet is a one-line, zero-behavior-risk set of security
headers and the baseline a reviewer expects on a deployed Express app. The rate limiter's
job here is narrow and honest — it is NOT cost protection (API spend is already decoupled
from user traffic, since the node-cron job is the only caller of The Odds API), it is abuse
protection for a single free-tier dyno and its 750 monthly instance-hours. 100/min is far
above any real user's click rate but caps a runaway scraper. trust proxy is required because
Render terminates TLS at a proxy; without it every request appears to share one IP and the
limiter misbehaves.

Why NOT request validation: the only user inputs are a search string and a player ID. The
controllers already guard the empty-query case and let Mongoose handle the lookup. A
validation library (joi/zod) for two simple string params is premature abstraction against
this project's YAGNI discipline. Revisit if a write endpoint or auth is ever added.

Why NOT structured logging: with no users and no dashboards, console plus Render's built-in
log capture is sufficient. A logging library (pino/winston) earns its place with real traffic
and log aggregation, neither of which a V1 portfolio deploy has. Revisit alongside any future
observability need.

Principle: the threat model of a public, read-only, no-auth API drove the scope, rather than
installing a standard hardening checklist wholesale.

### Search input hardening: regex escaping + word-boundary anchor

Decision: `GET /players/search` escapes regex metacharacters in the query
before it reaches `$regex`, and anchors the pattern to a word boundary
(`\b`). The error handler only forwards `err.message` to the client for
errors carrying an explicit 4xx status; everything else returns a generic
"Internal server error".

Why: raw user input in `$regex` meant `(` crashed the query into a 500
whose body leaked the MongoDB driver's error message, and `.*` matched
every player. Escaping makes user input always literal. The `\b` anchor
was chosen over a strict prefix (`^`) because the primary search pattern
is a last name — `^mahomes` would not match "Patrick Mahomes" — and over
no anchor because mid-word matches ("aho" → Mahomes) are noise in a
typeahead.

Tradeoff: an unanchored substring search occasionally surfaced a player
from a mid-word fragment; that behavior is gone deliberately. The scan is
still COLLSCAN — index-backed search (Atlas Search autocomplete) is the
V2 upgrade path.

### seasonComplete: ETL-written flag for in-progress seasons

Decision: the ETL computes a boolean `seasonComplete` per load (league
max week loaded ≥ 18, or 17 pre-2021) and stores it on every
player-season document. The Advanced tab uses `seasonComplete === false`
to show "percentile ranks are pending" instead of the qualifying-threshold
message during a partial season.

Why: the frontend had always read the field, but nothing wrote it — the
in-progress state was dead code, and a mid-season player below the
qualifier gate was wrongly told they didn't reach the threshold. Writing
the flag in the ETL keeps the domain judgment ("is this season over?")
next to the data load that defines it, rather than having the UI guess
from dates. Documents from older loads lack the field and render as
complete; the next loader re-run backfills it (idempotent upsert — no
migration needed).

### Atlas network access: allow from anywhere (0.0.0.0/0)

Decision: The MongoDB Atlas cluster's Network Access list is set to `0.0.0.0/0`
(allow connections from any IP). The security boundary is the database credential
in `MONGO_URI` plus Atlas's required authentication, not the IP allowlist.

Why: Render's free Web Service tier provides no static outbound IP — a free
instance's egress can originate from any address in Render's shared pool, and
that pool changes. There is therefore no fixed address to allowlist, and
`0.0.0.0/0` is the documented connection path for hosts without a dedicated
egress IP. Opening the allowlist does not bypass auth; it only permits a
connection attempt. Every connection still has to authenticate with the user
and password in the URI.

Tradeoff and threat model: any IP can attempt to connect, so security rests
entirely on the credential and Atlas auth rather than on a network perimeter.
Accepted for a public, read-only, no-auth portfolio app on M0 where the stored
data is public NFL stats — there is no PII, and users have no write path to the
database. The hardened alternative is a Render dedicated egress IP allowlisted
narrowly on Atlas, which is a paid Render feature and out of V1 scope.

Mitigations available at no cost if ever wanted: scope the Atlas database user
to read and write only the `statsnap` database rather than cluster-wide admin,
and rotate the credential if the URI is ever exposed. Both shrink the blast
radius without reintroducing a network perimeter the free tier cannot provide.

---

## Minor / historical

- **Dakota dropped:** not exposed in the player stats endpoint; replaced with
  `passingCpoe`.
- **Splits tab removed:** no clean nflverse source for the per-situation splits
  the early mocks showed.
- **Stripped metrics (no source):** Route Win %, Contested Catch %, Drop Rate
  are PFF-exclusive — not in nflverse, not in Tank01, not in the budget.
