# StatSnap — Working Notes

Open scratchpad: links, reminders, and unresolved questions. No structure
required. Settled decisions graduate to docs/Decisions.md.

---

## Open: ETL scheduling mechanism (undecided)

The Python ETL (transform.py / load.py) is run by hand today. The brief and
AGENTS.md both describe it as running "weekly," but that is intent — no
scheduler is built. This is NOT the node-cron job from Chunk 19; that one lives
inside the Express process and serves the schedule cache only. node-cron should
NOT run the ETL (shelling from Node into Python couples two services that should
stay independent and run on different cadences for different reasons).

When this gets built, decide:
- Mechanism: system cron on the host, a GitHub Action on a schedule, or a
  platform scheduler (e.g. Render cron job). Kept separate from the web process.
- Cadence: weekly, on Tuesday. The football week ends Monday night, so
  nflverse stats for a week are not complete and stable until Tuesday — running
  Tuesday ingests a finished week, not a half-played one.
- Idempotency is already handled: load.py upserts on { playerId, season }, so a
  re-run is safe regardless of trigger.

Not in scope for any current chunk. Logged so the "weekly" language in the brief
stops looking settled when it isn't.

## Shared search component — collapse & clear on select (fix)

PROBLEM
PlayerSearch is reused in two mounts: the landing hero and the player-page
topbar. After selecting a player from the topbar, the dropdown stayed open
and the input kept the old query text. The landing mount never showed these
because selecting there navigates away and the component unmounts.

ROOT CAUSE — the mount/unmount asymmetry
The topbar mount STAYS mounted across player-to-player navigation (same
route, reconciled in place), so its internal state survives a select. The
landing mount UNMOUNTS on select. State the landing mount discards for free
has to be explicitly reset on the topbar. Every bug in this feature traced
back to fixes reasoned through only one mount's lifecycle.

THE HABIT (the real takeaway)
A reused component is the same code living two different lifecycles. A
change to its select/escape/state logic is only "done" when traced through
BOTH: "topbar stays mounted, landing unmounts — is this correct in each?"
Skipping that question is what produced the whack-a-mole.

FIX 1 — separate visibility from request status
Dropdown visibility was derived purely from the search status, which is
debounced, so collapse lagged and never fired on select. Added an explicit
isOpen flag; visibility is now (status !== "idle" && isOpen). Select and
Escape flip isOpen false synchronously → instant collapse. Typing flips it
true → reopen. isOpen inits true so a deep-linked ?q= still auto-opens.

FIX 2 — clear the input without touching the parent/URL
First attempt cleared via updateQuery(""), which in controlled mode calls
the parent's onChange → setSearchParams. On the landing mount that fired a
same-tick URL replace that clobbered the navigation and stranded the user
on "/". Switched to setInternalQuery(""), which only touches the
component's own state: empties the uncontrolled topbar input, no-op on the
controlled landing mount (which unmounts anyway). No parent round-trip, no
URL mutation, no branch on controlled-ness.

## "Trust, but verify" — the schema audit story

While prepping StatSnap for deployment, I had an AI assistant run a deep audit
of my data pipeline. It came back with a confident, detailed finding: 14 fields
were being silently dropped before they ever reached the frontend, with a clean
technical explanation for why. It was convincing — it even lined up with a note
in my own decision log, so the story hung together.

Before changing a single line, I ran one command against my actual running API
to see what the endpoint really returned. Every one of those 14 fields was
there. The audit was simply wrong. Its entire conclusion rested on an assumption
about how my database library behaves when reading data, and that assumption
didn't hold for my setup.

The takeaway I kept: AI is a real force multiplier — it surfaces things worth
looking at fast, and it's great at producing a thorough, organized analysis. But
its conclusions are only as good as the assumptions underneath them, and a
confident, well-written answer can still be flatly wrong. A two-second check
against the real system beat the elaborate analysis. So I verify against reality
before I act — especially before "fixing" something that might not be broken.
