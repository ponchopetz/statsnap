// PROTOTYPE (flag: compare). Row definitions for the head-to-head page.
//
// The headline rows intentionally mirror the six Overview cells per position.
// They are computed with the same stats.js helpers, so the numbers cannot
// disagree with Overview; only the LIST of cells is repeated here. Lifting
// that list out of OverviewQB/RB/Receiver into a shared module is the
// obvious next step and is noted in PROTOTYPES.md.
import { sumWeeks, averageWeeks, completionPct, totalTouchdowns, seasonPassingEpa, buildAdvancedRows } from "./stats.js";
import { formatNumber, formatPercent, formatSigned } from "./format.js";

// Each row: { key, label, value(weeks, player) → number|null, format(n) → string,
//             lowerIsBetter?: boolean }
const QB_HEADLINE = [
  { key: "gamesPlayed", label: "GP", value: (w, p) => p.gamesPlayed ?? w.length, format: formatNumber },
  { key: "completionPct", label: "CMP %", value: (w) => (sumWeeks(w, "attempts") ? completionPct(w) : null), format: formatPercent },
  { key: "passingYards", label: "PASS YDS", value: (w) => sumWeeks(w, "passingYards"), format: formatNumber },
  { key: "passingTds", label: "PASS TD", value: (w) => sumWeeks(w, "passingTds"), format: formatNumber },
  { key: "interceptions", label: "INT", value: (w) => sumWeeks(w, "interceptions"), format: formatNumber, lowerIsBetter: true },
  { key: "passingEpa", label: "EPA / ATT", value: (w) => seasonPassingEpa(w), format: (n) => formatSigned(n, 2) },
];

const RB_HEADLINE = [
  { key: "gamesPlayed", label: "GP", value: (w, p) => p.gamesPlayed ?? w.length, format: formatNumber },
  { key: "carries", label: "CARRIES", value: (w) => sumWeeks(w, "carries"), format: formatNumber },
  { key: "rushingYards", label: "RUSH YDS", value: (w) => sumWeeks(w, "rushingYards"), format: formatNumber },
  { key: "totalTds", label: "TOTAL TD", value: (w) => totalTouchdowns(w), format: formatNumber },
  { key: "receptions", label: "REC", value: (w) => sumWeeks(w, "receptions"), format: formatNumber },
  { key: "receivingYards", label: "REC YDS", value: (w) => sumWeeks(w, "receivingYards"), format: formatNumber },
];

const RECEIVER_HEADLINE = [
  { key: "gamesPlayed", label: "GP", value: (w, p) => p.gamesPlayed ?? w.length, format: formatNumber },
  { key: "targets", label: "TGT", value: (w) => sumWeeks(w, "targets"), format: formatNumber },
  { key: "receptions", label: "REC", value: (w) => sumWeeks(w, "receptions"), format: formatNumber },
  { key: "receivingYards", label: "REC YDS", value: (w) => sumWeeks(w, "receivingYards"), format: formatNumber },
  { key: "totalTds", label: "TOTAL TD", value: (w) => totalTouchdowns(w), format: formatNumber },
  { key: "targetShare", label: "TGT SHARE", value: (w) => (w.length ? averageWeeks(w, "targetShare") : null), format: formatPercent },
];

export const HEADLINE_CONFIG = { QB: QB_HEADLINE, RB: RB_HEADLINE, WR: RECEIVER_HEADLINE, TE: RECEIVER_HEADLINE };

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
 * @returns {{ headline: Row[], advanced: Row[] }}
 *   Row = { key, label, a: {display, share}, b: {display, share}, winner: "a"|"b"|null }
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
