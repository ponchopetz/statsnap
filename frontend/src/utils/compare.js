// Row definitions for the head-to-head page.
//
// Headline rows come from utils/headline.js, the same list the Overview stat
// row renders. Advanced rows come from buildAdvancedRows, the same function
// the Advanced panel renders. Nothing on the Compare page has its own stat
// definition.
import { buildAdvancedRows, groupRows } from "./stats.js";
import { HEADLINE_CONFIG } from "./headline.js";

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
      group: ra.group,
      direction: ra.direction,
      a: { display: ra.v, share: ra.bar ?? 0, pct: ra.bar },
      b: { display: rb.v, share: rb.bar ?? 0, pct: rb.bar },
      // Percentiles already encode direction (inverted metrics rank fewer as
      // higher), so the higher percentile always wins. A style stat has no
      // better or worse, so it never picks a winner.
      winner: ra.direction === "style" ? null : winner(ra.bar, rb.bar, false),
      // The raw value still reads "lower wins" for inverted metrics.
      lowerIsBetter: ra.direction === "lower",
    };
  });

  return { headline, advanced };
}

/**
 * Splits advanced comparison rows into their groups (first-appearance order)
 * with a per-group tally of wins. Rows with no winner (a tie, a missing
 * percentile, or a style stat) count for neither side.
 * @param {Array<{group: string, winner: "a"|"b"|null}>} advancedRows
 * @returns {Array<{group: string, rows: Array<Object>, tally: {a: number, b: number}}>}
 */
export function groupComparison(advancedRows) {
  return groupRows(advancedRows).map(({ group, rows }) => ({
    group,
    rows,
    tally: {
      a: rows.filter((r) => r.winner === "a").length,
      b: rows.filter((r) => r.winner === "b").length,
    },
  }));
}
