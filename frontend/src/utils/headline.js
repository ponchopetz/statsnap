// The six headline cells per position, defined once. The Overview stat row,
// the Compare page, and the form line all read this list, so "which stats
// are the headline stats" has one home. Every value goes through the same
// stats.js helpers, so the numbers cannot disagree between those surfaces.
//
// Row shape:
//   key           stable id, also the sparkline selection key
//   label         cell label (display font, uppercase)
//   value(weeks, player) → number|null      season value
//   format(n) → string                      display of the season value
//   chartable     whether the cell drives the sparkline
//   series(weeks) → (number|null)[]         per-week values for the sparkline
//   formatSeries(n) → string                display of one sparkline value
//   avgLabel      sparkline average caption override ("AVG/GM" for EPA)
//   lowerIsBetter comparison direction (INT)
//   primary       default sparkline selection
import {
  sumWeeks,
  averageWeeks,
  completionPct,
  totalTouchdowns,
  weekSeries,
  seasonPassingEpa,
} from "./stats.js";
import { formatNumber, formatPercent, formatSigned } from "./format.js";

const gamesPlayed = {
  key: "gamesPlayed",
  label: "GP",
  value: (weeks, player) => player?.gamesPlayed ?? weeks.length,
  format: formatNumber,
  chartable: false,
};

const count = (key, label, extra = {}) => ({
  key,
  label,
  value: (weeks) => sumWeeks(weeks, key),
  format: formatNumber,
  chartable: true,
  series: (weeks) => weekSeries(weeks, key),
  formatSeries: formatNumber,
  ...extra,
});

const totalTds = {
  key: "totalTds",
  label: "TOTAL TD",
  value: (weeks) => totalTouchdowns(weeks),
  format: formatNumber,
  chartable: true,
  series: (weeks) => weeks.map((w) => (w.rushingTds ?? 0) + (w.receivingTds ?? 0)),
  formatSeries: formatNumber,
};

const QB = [
  gamesPlayed,
  {
    key: "completionPct",
    label: "CMP %",
    value: (weeks) => (sumWeeks(weeks, "attempts") > 0 ? completionPct(weeks) : null),
    format: formatPercent,
    chartable: true,
    // Percent points on the chart so the axis reads naturally; the season
    // value stays a 0..1 ratio like every other percent in the app.
    series: (weeks) => weeks.map((w) => (w.attempts ? (w.completions / w.attempts) * 100 : null)),
    formatSeries: (n) => formatPercent(n / 100),
  },
  count("passingYards", "PASS YDS", { primary: true }),
  count("passingTds", "PASS TD"),
  count("interceptions", "INT", { lowerIsBetter: true }),
  {
    key: "passingEpa",
    label: "PASS EPA",
    value: (weeks) => seasonPassingEpa(weeks),
    format: (n) => formatSigned(n),
    chartable: true,
    series: (weeks) => weekSeries(weeks, "passingEpa"),
    formatSeries: (n) => formatSigned(n, 2),
    avgLabel: "AVG/GM",
  },
];

const RB = [
  gamesPlayed,
  count("carries", "CARRIES"),
  count("rushingYards", "RUSH YDS", { primary: true }),
  totalTds,
  count("receptions", "REC"),
  count("receivingYards", "REC YDS"),
];

const RECEIVER = [
  gamesPlayed,
  count("targets", "TGT"),
  count("receptions", "REC"),
  count("receivingYards", "REC YDS", { primary: true }),
  totalTds,
  {
    key: "targetShare",
    label: "TGT SHARE",
    value: (weeks) => averageWeeks(weeks, "targetShare"),
    format: formatPercent,
    chartable: true,
    series: (weeks) => weekSeries(weeks, "targetShare"),
    formatSeries: formatPercent,
  },
];

export const HEADLINE_CONFIG = { QB, RB, WR: RECEIVER, TE: RECEIVER };

/** The default sparkline selection for a position, or null if unsupported. */
export function primaryKey(position) {
  return HEADLINE_CONFIG[position]?.find((r) => r.primary)?.key ?? null;
}
