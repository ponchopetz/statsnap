// LABS (flag: form). Recent form for the headline stats: the last N games
// against the season, per chartable headline row, using the row's own
// per-week series from utils/headline.js so "PASS YDS" here is the same
// per-week number the sparkline draws.
import { HEADLINE_CONFIG } from "./headline.js";

export const FORM_WINDOW = 4;
// Relative change that earns a HOT / COLD tag.
const HOT_THRESHOLD = 0.15;

function mean(values) {
  const v = values.filter((x) => x != null);
  if (!v.length) return null;
  return v.reduce((a, b) => a + b, 0) / v.length;
}

function record(weeks) {
  const tally = { W: 0, L: 0, T: 0 };
  for (const w of weeks) if (w.result in tally) tally[w.result] += 1;
  return tally.T ? `${tally.W}-${tally.L}-${tally.T}` : `${tally.W}-${tally.L}`;
}

/** Team record over the last N games and the season, from the stored results. */
export function formRecord(player) {
  const weeks = player.weeks ?? [];
  return { recent: record(weeks.slice(-FORM_WINDOW)), season: record(weeks) };
}

/**
 * @returns {Array<{ key, label, recent: number|null, season: number|null,
 *   delta: number|null, trend: "hot"|"cold"|"even"|null, format }>}
 *   `delta` is relative (recent / season - 1). Fewer than FORM_WINDOW + 1
 *   games gives no trend: there is no "rest of season" to compare to.
 */
export function buildForm(player) {
  const rows = HEADLINE_CONFIG[player.position];
  if (!rows) return [];
  const weeks = player.weeks ?? [];

  return rows
    .filter((r) => r.chartable)
    .map((r) => {
      const series = r.series(weeks);
      const season = mean(series);
      const recent = mean(series.slice(-FORM_WINDOW));
      const enough = weeks.length > FORM_WINDOW && season != null && recent != null;
      let delta = null;
      let trend = null;
      if (enough) {
        delta = season === 0 ? (recent === 0 ? 0 : Infinity) : recent / season - 1;
        const better = r.lowerIsBetter ? -delta : delta;
        trend = better >= HOT_THRESHOLD ? "hot" : better <= -HOT_THRESHOLD ? "cold" : "even";
      }
      return { key: r.key, label: r.label, recent, season, delta, trend, format: r.formatSeries };
    });
}
