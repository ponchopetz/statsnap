// Each value is Tuesday noon ET before that season's Week 1 — the weekly dead
// zone the NFL never schedules into, so any game Wed–Mon buckets correctly.
// Hand-maintained; verify each season vs the official schedule.
const SEASON_BOUNDARIES = {
  2025: "2025-09-02T16:00:00Z",
  2026: "2026-09-08T16:00:00Z",
};

const WEEKS_IN_SEASON = 18;
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

function deriveNflWeek(commenceTimeIso, season) {
  const boundary = SEASON_BOUNDARIES[season];
  if (boundary === undefined) return null;

  const start = Date.parse(boundary);
  const t = Date.parse(commenceTimeIso);
  if (isNaN(start) || isNaN(t)) return null;

  if (t < start) return null;

  const week = Math.floor((t - start) / WEEK_MS) + 1;
  return week >= 1 && week <= WEEKS_IN_SEASON ? week : null;
}

// Returns the greatest season key whose boundary is <= kickoff,
// or null if kickoff precedes all boundaries or is unparseable.
function seasonForDate(commenceTimeIso) {
  const t = Date.parse(commenceTimeIso);
  if (isNaN(t)) return null;

  let result = null;
  for (const key of Object.keys(SEASON_BOUNDARIES)) {
    const boundary = Date.parse(SEASON_BOUNDARIES[key]);
    if (t >= boundary) {
      const season = Number(key);
      if (result === null || season > result) result = season;
    }
  }
  return result;
}

module.exports = { deriveNflWeek, seasonForDate, SEASON_BOUNDARIES };
