// Row definitions for the head-to-head page.
//
// Headline rows come from utils/headline.js, the same list the Overview stat
// row renders. Advanced rows come from buildAdvancedRows, the same function
// the Advanced panel renders. Nothing on the Compare page has its own stat
// definition.
import { buildAdvancedRows } from "./stats.js";
import { HEADLINE_CONFIG } from "./headline.js";

// Advanced metrics where the percentile is already inverted by the ETL
// (fewer is better). The raw value still reads "lower wins".
const LOWER_IS_BETTER_LABELS = new Set(["Sacks Suffered", "Sack Yards Lost"]);

function winner(a, b, lowerIsBetter) {
  if (a == null || b == null || a === b) return null;
  const aWins = lowerIsBetter ? a < b : a > b;
  return aWins ? "a" : "b";
}

/**
 * Builds aligned comparison rows for two same-position player-season docs.
 * The two documents may be from different seasons: headline values compare
 * directly, and each percentile is relative to its own season's cohort.
 * @returns {{ headline: Row[], advanced: Row[] }}
 *   Row = { key, label, a: {display, share, pct?}, b: {display, share, pct?}, winner: "a"|"b"|null }
 *   share is 0..1 for the bar width: percentile for advanced rows, value
 *   relative to the larger magnitude for headline rows.
 */
export function buildComparison(playerA, playerB) {
  const config = HEADLINE_CONFIG[playerA.position] ?? [];
  const weeksA = playerA.weeks ?? [];
  const weeksB = playerB.weeks ?? [];

  const headline = config.map((row) => {
    const a = row.value(weeksA, playerA);
    const b = row.value(weeksB, playerB);
    const max = Math.max(Math.abs(a ?? 0), Math.abs(b ?? 0));
    const share = (v) => (v == null || max === 0 ? 0 : Math.abs(v) / max);
    return {
      key: row.key,
      label: row.label,
      a: { display: row.format(a), share: share(a) },
      b: { display: row.format(b), share: share(b) },
      winner: winner(a, b, row.lowerIsBetter),
    };
  });

  const rowsA = buildAdvancedRows(playerA);
  const rowsB = buildAdvancedRows(playerB);
  const advanced = rowsA.map((ra, i) => {
    const rb = rowsB[i];
    return {
      key: ra.k,
      label: ra.k,
      a: { display: ra.v, share: ra.bar ?? 0, pct: ra.bar },
      b: { display: rb.v, share: rb.bar ?? 0, pct: rb.bar },
      // Percentiles already encode direction (inverted metrics rank fewer as
      // higher), so the higher percentile always wins.
      winner: winner(ra.bar, rb.bar, false),
      lowerIsBetter: LOWER_IS_BETTER_LABELS.has(ra.k),
    };
  });

  return { headline, advanced };
}
