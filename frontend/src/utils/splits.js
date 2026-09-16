// PROTOTYPE (flag: splits). Situational splits computed from the stored
// weeks of one player-season. Every value runs through the same stats.js
// helpers the rest of the app uses, so a split row is just the season
// definition applied to a filtered weeks array (the Career pseudo-document
// idea, one level down).
import {
  sumWeeks,
  averageWeeks,
  completionPct,
  totalTouchdowns,
  seasonPassingEpa,
  seasonRushingEpa,
  seasonReceivingEpa,
} from "./stats.js";
import { formatNumber, formatPercent, formatSigned, formatDecimal } from "./format.js";

// Week 9 is the last week of the first half in an 18-week season; the
// same cut keeps the halves close to even in the 17-week era.
const FIRST_HALF_LAST_WEEK = 9;

export const SPLIT_GROUPS = [
  {
    label: "VENUE",
    splits: [
      { key: "home", label: "HOME", test: (w) => w.homeAway === "home" },
      { key: "away", label: "AWAY", test: (w) => w.homeAway === "away" },
    ],
  },
  {
    label: "RESULT",
    splits: [
      { key: "wins", label: "IN WINS", test: (w) => w.result === "W" },
      { key: "losses", label: "IN LOSSES", test: (w) => w.result === "L" },
      { key: "ties", label: "IN TIES", test: (w) => w.result === "T", hideWhenEmpty: true },
    ],
  },
  {
    label: "SEASON HALF",
    splits: [
      { key: "h1", label: `WEEKS 1–${FIRST_HALF_LAST_WEEK}`, test: (w) => w.week <= FIRST_HALF_LAST_WEEK },
      { key: "h2", label: `WEEKS ${FIRST_HALF_LAST_WEEK + 1}+`, test: (w) => w.week > FIRST_HALF_LAST_WEEK },
    ],
  },
];

// Per-game and per-carry rates, ratio of sums like everything else.
function perGame(weeks, key) {
  if (!weeks.length) return null;
  return sumWeeks(weeks, key) / weeks.length;
}
function yardsPerCarry(weeks) {
  const carries = sumWeeks(weeks, "carries");
  if (carries === 0) return null;
  return sumWeeks(weeks, "rushingYards") / carries;
}

const gp = { k: "GP", value: (weeks) => formatNumber(weeks.length) };

const QB_COLUMNS = [
  gp,
  { k: "CMP%", value: (w) => (w.length ? formatPercent(completionPct(w)) : "—") },
  { k: "PASS YDS", value: (w) => formatNumber(sumWeeks(w, "passingYards")) },
  { k: "YDS/G", value: (w) => formatDecimal(perGame(w, "passingYards"), 1) },
  { k: "PASS TD", value: (w) => formatNumber(sumWeeks(w, "passingTds")) },
  { k: "INT", value: (w) => formatNumber(sumWeeks(w, "interceptions")) },
  { k: "EPA/ATT", value: (w) => formatSigned(seasonPassingEpa(w), 2) },
];

const RB_COLUMNS = [
  gp,
  { k: "CAR", value: (w) => formatNumber(sumWeeks(w, "carries")) },
  { k: "RUSH YDS", value: (w) => formatNumber(sumWeeks(w, "rushingYards")) },
  { k: "Y/A", value: (w) => formatDecimal(yardsPerCarry(w), 1) },
  { k: "TOTAL TD", value: (w) => formatNumber(totalTouchdowns(w)) },
  { k: "REC YDS", value: (w) => formatNumber(sumWeeks(w, "receivingYards")) },
  { k: "EPA/CAR", value: (w) => formatSigned(seasonRushingEpa(w), 2) },
];

const RECEIVER_COLUMNS = [
  gp,
  { k: "TGT", value: (w) => formatNumber(sumWeeks(w, "targets")) },
  { k: "REC", value: (w) => formatNumber(sumWeeks(w, "receptions")) },
  { k: "REC YDS", value: (w) => formatNumber(sumWeeks(w, "receivingYards")) },
  { k: "YDS/G", value: (w) => formatDecimal(perGame(w, "receivingYards"), 1) },
  { k: "TOTAL TD", value: (w) => formatNumber(totalTouchdowns(w)) },
  { k: "TGT SHARE", value: (w) => (w.length ? formatPercent(averageWeeks(w, "targetShare")) : "—") },
  { k: "EPA/TGT", value: (w) => formatSigned(seasonReceivingEpa(w), 2) },
];

export const SPLIT_COLUMNS = {
  QB: QB_COLUMNS,
  RB: RB_COLUMNS,
  WR: RECEIVER_COLUMNS,
  TE: RECEIVER_COLUMNS,
};

/**
 * @returns {Array<{label, rows: Array<{key, label, games, cells: string[]}>}>}
 *   or [] for an unsupported position.
 */
export function buildSplits(player) {
  const columns = SPLIT_COLUMNS[player.position];
  if (!columns) return [];
  const weeks = player.weeks ?? [];

  return SPLIT_GROUPS.map((group) => ({
    label: group.label,
    rows: group.splits
      .map((split) => {
        const subset = weeks.filter(split.test);
        return {
          key: split.key,
          label: split.label,
          games: subset.length,
          hidden: split.hideWhenEmpty && subset.length === 0,
          cells: columns.map((c) => (subset.length ? c.value(subset) : "—")),
        };
      })
      .filter((row) => !row.hidden),
  }));
}
