# StatSnap — Fix Log & Interview Story Guide (July 2026)

Follow-up to [AUDIT_2026-07.md](AUDIT_2026-07.md). Every fix the audit
recommended, what it does, why it mattered, and how to talk about it to an
employer. Each fix lives on its own branch off `develop`.

**The one-line frame for all of it:** *"I commissioned a principal-level audit
of my capstone, triaged the findings by portfolio impact, and shipped every fix
on themed branches — including a cross-language contract test."* That sentence
alone signals code review, prioritization, and follow-through.

---

## 1. Search hardening — `fix/backend-hardening`

**What changed:** User input to `/players/search` is now escaped before it goes
into a MongoDB `$regex`, and matches anchor to the start of a word. The error
handler no longer sends internal error messages to the client for server-side
failures. Also: when the hand-maintained NFL week table goes stale, the
schedule refresher now logs a loud, actionable error instead of failing
silently.

**Why it mattered:** Searching for `(` literally crashed the request — the API
returned a 500 whose body contained MongoDB's raw error message. That's two
bugs in one: unvalidated input reaching the database (a mini injection bug),
and internal details leaking out (an information disclosure). Both are things
a security-minded reviewer greps for first.

**How to tell the story:** "My search endpoint passed raw user input into a
regex query. I found that typing a parenthesis returned a 500 that leaked the
database error to the browser. I fixed it by escaping the input so it's always
treated as literal text, anchoring matches to word starts, and making the
error handler return a generic message for anything without an explicit
status." If they push deeper: the word-boundary anchor (`\b`) was a deliberate
choice over a strict prefix — people search by last name, and `^mahomes`
wouldn't match "Patrick Mahomes".

---

## 2. Cold-start UX + failure states — `fix/frontend-resilience`

**What changed:** Three things. (a) A `useSlowLoading` hook flips after 3
seconds of loading, and the search dropdown, schedule rail, and player page
then explain that the free-tier server is waking up (~20s). (b) An error
boundary — a React component that catches crashes in anything below it — now
wraps the routes, so a rendering bug shows a branded failure panel instead of
a white screen. (c) Unknown URLs get a designed 404 page instead of an empty
shell.

**Why it mattered:** The live API sleeps on Render's free tier and takes ~22
seconds to wake. A hiring manager clicking your link got a dead search box
with no explanation — the single worst first impression the app could make.
The fix doesn't make the server faster; it makes the app honest about what's
happening, which is what real products do.

**How to tell the story:** "I couldn't afford to fix the infrastructure — the
free tier spins down — so I fixed the experience: the UI detects a slow first
request and tells the user the server is waking up. Handling infrastructure
reality in the UX was cheaper than paying for a dyno and is a more interesting
story." The error boundary is a good React-specific talking point: know that
it must be a class component (there's no hook for catching render errors).

---

## 3. The dead `seasonComplete` field — `fix/advanced-panel-polish`

**What changed:** The Advanced tab had code to show "percentile ranks are
pending" during an in-progress season — but it checked a field
(`seasonComplete`) that nothing ever wrote, so that message could never
appear, and mid-season players were wrongly told they "didn't reach the
qualifying threshold." The ETL now computes the flag (has the league's final
week been loaded?), the database schema declares it, and the API sends it.
The same branch labels the percentile bars (P87 = 87th percentile in the
position cohort), gives CPOE an explicit `+` sign, and shows sack yardage as
a magnitude instead of a double-negative "-193 lost".

**Why it mattered:** Dead code that *looks* live is worse than no code — a
reviewer who traces `seasonComplete` finds it exists nowhere else and asks
why. And unlabeled percentile bars invited misreading the whole Advanced tab.

**How to tell the story:** This one is about *where* a fix belongs. "The UI
needed to know whether a season was still in progress. I could have guessed
from the current date in the frontend, but that's domain logic in the display
layer — instead the ETL, which is the thing that actually knows what data
exists, writes a `seasonComplete` flag onto each document. Because my loader
is an idempotent upsert, backfilling old documents is just a re-run, not a
migration." That last sentence is the strongest part — use it.

> **Action needed:** the flag only appears in the database after you re-run
> the loader (`SEASON=<year> python load.py` per season). Until then the UI
> behaves exactly as before — missing field is treated as a complete season.

---

## 4. Schedule rail overlap — `fix/schedule-rail-overlap`

**What changed:** The `+5 MORE →` indicator on the landing page rendered
directly on top of the last visible game card. The fade gradient behind it
only became fully opaque partway across, and the text was wider than the
opaque zone. The count is now a solid pill (background + border) that stays
legible at any width.

**Why it mattered:** It was on the first screen every visitor sees. Small CSS
bugs on a landing page read as "student project" faster than anything in the
code.

**How to tell the story:** Don't lead with this one, but it's a good honest
answer to "what's a bug you shipped?" — "My fade overlay assumed the label
would fit inside its opaque zone; a longer label broke the assumption. The
fix was making the label self-sufficient instead of relying on what's behind
it."

---

## 5. Page titles + link previews — `feat/page-titles-meta`

**What changed:** Every player page now sets the browser tab title to the
player's name (and resets it when you leave). `index.html` gained a meta
description and OpenGraph tags, so pasting the app's link into Slack,
LinkedIn, or a text message shows a real title and description instead of a
bare URL.

**Why it mattered:** You will share this app in job applications. The link
unfurl *is* the first impression in that context, and it was blank.

**How to tell the story:** Brief supporting detail, not a headline: "I treated
shareability as a feature — per-page titles and OpenGraph tags — because the
way employers first see the project is a pasted link." If asked why the
OpenGraph tags are static while the title is dynamic: OpenGraph is read by
crawlers that don't run JavaScript, so per-player OG tags would need
server-side rendering — a known SPA limitation, deferred deliberately.

---

## 6. Game log DNP rows + birthday math — `fix/display-polish`

**What changed:** Weeks a player missed between games (byes, injuries) used to
vanish from the game log — Week 9 jumped straight to Week 11. Those gaps now
render as dimmed "DNP" rows. Also fixed a subtle date bug: ages could show a
day early because `new Date("1995-09-17")` parses as UTC midnight while the
age comparison used local time.

**Why it mattered:** The silent gap looked like missing data rather than a
choice. And the rows are labeled DNP (did not play), not BYE, on purpose —
the data can't distinguish a bye from an injury, so the label claims only
what the data supports. Gaps *after* a player's last game aren't filled at
all, for the same reason.

**How to tell the story:** This is a data-honesty story: "I only render what
the data can actually assert. A missing interior week is definitely a game
the player didn't play, so it gets a DNP row. Why the season ended early is
not in the data, so I don't speculate." The timezone bug is a nice one-liner
about JavaScript date pitfalls if the conversation goes there.

---

## 7. The golden-file contract test — `test/stats-golden-contract`

**What changed:** The project's stat math deliberately exists twice — Python
(for percentile ranking in the ETL) and JavaScript (for raw values in the UI)
— as a mirrored contract. Nothing enforced the mirror. Now
`etl/generate_golden.py` feeds synthetic weekly stats through the Python
aggregation and writes the inputs *and* the expected outputs to a JSON file
checked into the frontend. A Vitest suite (`npm test` in `frontend/`) asserts
that every JS helper produces identical numbers from the same input — 41
assertions covering the tricky cases: weeks with null EPA (whose attempts
must drop out of the denominator), weighted CPOE, ratios that are undefined
rather than zero.

**Why it mattered:** This was the repo's first test, and it's aimed at the
single riskiest thing in the codebase: two implementations of the same math
that could silently drift — which is exactly the bug (EPA differing between
two tabs) that created the "one stat, one definition" rule in the first place.

**How to tell the story:** This is your strongest technical story — lead with
it. "My season-stat math lives in two languages, so I wrote a contract test:
Python generates a golden file of inputs and expected outputs, and the JS
side must reproduce every number exactly. I chose generation over
hand-written expectations because hand-written tests in two languages can
drift just like the implementations can — this way Python is the single
source of truth, and a unilateral change to either side fails the suite."
Expect the follow-up "why does the math live twice at all?" — answer: raw
weekly data ships to the client so the sparkline, game log, and season
switching are instant with one fetch; precomputing every display value
server-side was the alternative and this was the deliberate trade.

---

## 8. README correction — `docs/fixes-writeup`

**What changed:** The README claimed season rates are "never the mean of
per-week rates," but three metrics (target share, air-yards share, WOPR) are
exactly that — averaged across weeks — because a true ratio-of-sums for a
share metric needs per-week *team* totals that aren't stored. The README now
names the exception, and the ADR log gained entries for the search hardening,
the seasonComplete decision, and the golden test.

**Why it mattered:** A sharp interviewer who reads your README and then your
code catches the contradiction — and now instead they find a documented
limitation with a V2 plan, which reads as self-awareness rather than
oversight.

**How to tell the story:** "My audit caught my own README overclaiming. The
honest answer was that target share can't be aggregated as ratio-of-sums
without team-level denominators I don't store, so I documented the exception
instead of hiding it." Owning a limitation before being asked is a senior
behavior; this hands you a rehearsed example.

---

## The 60-second version (for "tell me about this project")

1. **What it is** — free advanced NFL stats with a live data pipeline:
   nflverse → Python ETL → MongoDB → Express → React, plus a cron-cached
   third-party schedule API.
2. **The interesting problem** — the same stat math must exist in Python and
   JS, so I treat it as a contract: one definition per stat, ratio-of-sums,
   nulls excluded from both sides of every ratio, and a generated golden-file
   test that fails if the two languages ever disagree.
3. **The maturity signal** — I audited the deployed app like a reviewer
   would: found a regex injection with an error-message leak, dead code
   behind a never-written field, and a 22-second cold start with no UX
   handling. Fixed all of it on themed branches with tests where they earn
   their keep.

Practice saying #2 and #3 out loud. They're the two answers that separate
"bootcamp grad with a capstone" from "engineer who reviews their own work."
