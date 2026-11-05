import { formatNumber, formatPercent, formatSigned, formatDecimal } from "./format.js";

/**
 * Sums a numeric field across an array of weekly stat objects.
 * null/undefined values are treated as 0 so they don't break the total.
 * @param {Array<Object>|null|undefined} weeks - Weekly stat objects
 * @param {string} key - Property name to sum
 * @returns {number} Sum of all values, or 0 for empty/missing input
 */
export function sumWeeks(weeks, key) {
  if (!weeks?.length) return 0;
  return weeks.reduce((acc, week) => acc + (week[key] ?? 0), 0);
}

/**
 * Averages a numeric field across an array of weekly stat objects,
 * ignoring null/undefined entries (they represent weeks where the player
 * didn't play, not actual zeros). Returns null (not 0) when there is
 * nothing to average — mirrors Polars mean() in percentiles.py, where an
 * all-null column yields null and the player is excluded from ranking.
 * @param {Array<Object>|null|undefined} weeks - Weekly stat objects
 * @param {string} key - Property name to average
 * @returns {number|null} Mean of non-null values, or null if none exist
 */
export function averageWeeks(weeks, key) {
  if (!weeks?.length) return null;
  const valid = weeks.filter((week) => week[key] != null);
  if (!valid.length) return null;
  return valid.reduce((acc, week) => acc + week[key], 0) / valid.length;
}

/**
 * Computes aggregate completion percentage as sum(completions) / sum(attempts).
 * Uses aggregate totals rather than a mean of per-week rates to avoid
 * weighting low-attempt games equally with high-attempt games.
 * @param {Array<Object>|null|undefined} weeks - Weekly stat objects with
 *   `completions` and `attempts` fields
 * @returns {number} Decimal completion rate e.g. 0.673, or 0 if no attempts
 */
export function completionPct(weeks) {
  const totalAttempts = sumWeeks(weeks, "attempts");
  if (totalAttempts === 0) return 0;
  return sumWeeks(weeks, "completions") / totalAttempts;
}

/**
 * Sums all touchdown types relevant to RB and WR/TE overviews.
 * @param {Array<Object>|null|undefined} weeks - Weekly stat objects with
 *   `rushingTds` and `receivingTds` fields
 * @returns {number} Combined rushing + receiving touchdown total
 */
export function totalTouchdowns(weeks) {
  return sumWeeks(weeks, "rushingTds") + sumWeeks(weeks, "receivingTds");
}

/**
 * Maps the weeks array to per-week values for a single stat key.
 * null/undefined values are preserved as null — the Sparkline distinguishes
 * null (player didn't play / no data) from zero (played and posted nothing).
 * @param {Array<Object>|null|undefined} weeks - Weekly stat objects
 * @param {string} key - Property name to extract
 * @returns {Array<number|null>} Per-week values in order, or [] for missing input
 */
export function weekSeries(weeks, key) {
  if (!weeks?.length) return [];
  return weeks.map((w) => w[key] ?? null);
}

// Season-aggregate advanced helpers — mirror of the aggregation contract in etl/percentiles.py (see docs/Decisions.md ADR for 15a). Any change here must change there.

/**
 * Season-level Avg Depth of Target: ratio of total passing air yards to total
 * attempts. Ratio of sums prevents low-attempt games from distorting the rate.
 * Returns null (not 0) when there are no attempts — null means "no basis to
 * compute", matching Python's null-exclusion from percentile ranking.
 * @param {Array<Object>|null|undefined} weeks
 * @returns {number|null}
 */
export function seasonAdot(weeks) {
  const totalAttempts = sumWeeks(weeks, "attempts");
  if (totalAttempts === 0) return null;
  return sumWeeks(weeks, "passingAirYards") / totalAttempts;
}

/**
 * Season-level Passing Air Conversion Ratio: passing yards earned per air yard
 * targeted. Ratio of sums. Null when total passing air yards are zero or
 * negative (screens and checkdowns only) — a conversion ratio over a
 * non-positive base has no meaning. Mirrors the `> 0` gate in
 * percentiles.py, which excludes such players from PACR ranking.
 * @param {Array<Object>|null|undefined} weeks
 * @returns {number|null}
 */
export function seasonPacr(weeks) {
  const totalAirYards = sumWeeks(weeks, "passingAirYards");
  if (totalAirYards <= 0) return null;
  return sumWeeks(weeks, "passingYards") / totalAirYards;
}

/**
 * Season-level Receiver Air Conversion Ratio: receiving yards per air yard
 * allocated to the receiver. Ratio of sums. Null when total receiving air
 * yards are zero or negative (a back or tight end fed only behind the line
 * of scrimmage). Mirrors the `> 0` gate in percentiles.py.
 * @param {Array<Object>|null|undefined} weeks
 * @returns {number|null}
 */
export function seasonRacr(weeks) {
  const totalAirYards = sumWeeks(weeks, "receivingAirYards");
  if (totalAirYards <= 0) return null;
  return sumWeeks(weeks, "receivingYards") / totalAirYards;
}

/**
 * Season-level YAC per reception: yards after catch divided by total receptions.
 * Ratio of sums prevents weeks with one catch from inflating the rate.
 * Null when no receptions.
 * @param {Array<Object>|null|undefined} weeks
 * @returns {number|null}
 */
export function seasonYacPerRec(weeks) {
  const totalReceptions = sumWeeks(weeks, "receptions");
  if (totalReceptions === 0) return null;
  return sumWeeks(weeks, "receivingYac") / totalReceptions;
}

/**
 * Season-level Passing EPA per dropback: sum of weekly passing EPA totals
 * divided by sum of attempts. Ratio of sums, not an average of weekly
 * totals — averaging per-game EPA totals would produce neither a per-play
 * rate nor a season total. sumWeeks is not used here because its
 * null-as-zero contract is wrong for a conditional ratio denominator: a
 * week with null passingEpa must drop its attempts from the denominator
 * too, not contribute them as if EPA were zero that week. Null when no
 * eligible attempts (mirrors seasonCpoe's null-exclusion pattern).
 * @param {Array<Object>|null|undefined} weeks
 * @returns {number|null}
 */
export function seasonPassingEpa(weeks) {
  if (!weeks?.length) return null;
  let numerator = 0;
  let denominator = 0;
  for (const week of weeks) {
    if (week.passingEpa != null) {
      numerator += week.passingEpa;
      denominator += week.attempts ?? 0;
    }
  }
  if (denominator === 0) return null;
  return numerator / denominator;
}

/**
 * Season-level Rushing EPA per carry: sum of weekly rushing EPA totals
 * divided by sum of carries. Ratio of sums — see seasonPassingEpa for why
 * sumWeeks can't express this conditional denominator. Null when no
 * eligible carries.
 * @param {Array<Object>|null|undefined} weeks
 * @returns {number|null}
 */
export function seasonRushingEpa(weeks) {
  if (!weeks?.length) return null;
  let numerator = 0;
  let denominator = 0;
  for (const week of weeks) {
    if (week.rushingEpa != null) {
      numerator += week.rushingEpa;
      denominator += week.carries ?? 0;
    }
  }
  if (denominator === 0) return null;
  return numerator / denominator;
}

/**
 * Season-level Receiving EPA per target: sum of weekly receiving EPA totals
 * divided by sum of targets. Ratio of sums — see seasonPassingEpa for why
 * sumWeeks can't express this conditional denominator. Null when no
 * eligible targets.
 * @param {Array<Object>|null|undefined} weeks
 * @returns {number|null}
 */
export function seasonReceivingEpa(weeks) {
  if (!weeks?.length) return null;
  let numerator = 0;
  let denominator = 0;
  for (const week of weeks) {
    if (week.receivingEpa != null) {
      numerator += week.receivingEpa;
      denominator += week.targets ?? 0;
    }
  }
  if (denominator === 0) return null;
  return numerator / denominator;
}

/**
 * Season-level Completion Percentage Over Expected, attempt-weighted.
 * Only weeks where both passingCpoe and attempts are non-null contribute —
 * a bye or injury week must not dilute the rate (null weeks excluded from
 * both numerator and denominator, matching the Python _cpoe_denominator logic).
 * passingCpoe is stored in percentage points (e.g. 11.78 = +11.78 pp).
 * @param {Array<Object>|null|undefined} weeks
 * @returns {number|null} Weighted CPOE in percentage points, or null if no
 *   eligible attempts
 */
export function seasonCpoe(weeks) {
  if (!weeks?.length) return null;
  let numerator = 0;
  let denominator = 0;
  for (const week of weeks) {
    if (week.passingCpoe != null && week.attempts != null) {
      numerator += week.passingCpoe * week.attempts;
      denominator += week.attempts;
    }
  }
  if (denominator === 0) return null;
  return numerator / denominator;
}

// ── Per-position advanced row config (module-local) ───────────────────────────
// Each entry: { key, label, group, direction, since?, rawValue(weeks, player) → string }
// key       — matches player.advanced / player.advancedValues keys and the
//             Python metric names (etl/percentiles.py POSITION_CONFIGS)
// label     — must match STAT_GLOSSARY keys (utils/glossary.js) so the Advanced
//             panel and the Leaderboards key can look up its definition
// group     — section the Advanced panel files the row under
// direction — "higher" or "lower" is better; "style" has no better or worse
// since     — first season with data (PFR charting starts in 2018)
// rawValue  — formatted display string for the raw season value. Season-sourced
//             rows read player.advancedValues; the rest derive from weeks.

// Ranked inverted by the ETL (fewer is better).
const LOWER_KEYS = new Set([
  "sacksSuffered", "sackYardsLost", "pressureRate", "badThrowPct", "dropRate", "intsWhenTargeted", "fumbles",
]);
// Ranked by raw value but never colored good or bad.
const STYLE_KEYS = new Set(["timeToThrow", "aggressiveness", "airYardsToSticks", "cushion", "eightBoxPct", "timeToLos"]);
// Pro Football Reference charting, 2018 onward.
const PFR_KEYS = new Set([
  "pressureRate", "badThrowPct", "dropRate", "brokenTackles",
  "ratingWhenTargeted", "intsWhenTargeted", "beforeContactPerAtt", "afterContactPerAtt",
]);
const PFR_FIRST_SEASON = 2018;

function def(key, label, rawValue) {
  const row = {
    key,
    label,
    direction: LOWER_KEYS.has(key) ? "lower" : STYLE_KEYS.has(key) ? "style" : "higher",
    rawValue,
  };
  if (PFR_KEYS.has(key)) row.since = PFR_FIRST_SEASON;
  return row;
}

// A season-sourced row: the raw value is already a season total or rate in
// player.advancedValues, so it only needs formatting.
function seasonValue(key, label, format) {
  return def(key, label, (_weeks, player) => {
    const v = player?.advancedValues?.[key];
    return v == null ? "—" : format(v);
  });
}

const fmtSeconds = (v) => `${v.toFixed(2)}s`;
const fmtSignedPercent = (v) => {
  const pct = formatPercent(v);
  return v >= 0 ? `+${pct}` : pct;
};
const fmtPercent = (v) => formatPercent(v);
const fmtSigned2 = (v) => formatSigned(v, 2);
const fmtSigned1 = (v) => formatSigned(v, 1);
const fmtDec1 = (v) => formatDecimal(v, 1);
const fmtDec2 = (v) => formatDecimal(v, 2);

const inGroup = (group, rows) => rows.map((row) => ({ ...row, group }));

// Rows shared by more than one position.
const targetShare = def("targetShare", "Target Share", (weeks) => formatPercent(averageWeeks(weeks, "targetShare")));
// wopr is a 0–2ish rating, not a percentage — plain 2-decimal display.
const wopr = def("wopr", "WOPR", (weeks) => formatDecimal(averageWeeks(weeks, "wopr"), 2));
const receivingAirYards = def("receivingAirYards", "Receiving Air Yards", (weeks) => formatNumber(sumWeeks(weeks, "receivingAirYards")));
const yacPerRec = def("yacPerRec", "YAC / Rec", (weeks) => {
  const v = seasonYacPerRec(weeks);
  return v == null ? "—" : v.toFixed(1);
});
const snapShare = seasonValue("snapShare", "Snap Share", fmtPercent);
const brokenTackles = seasonValue("brokenTackles", "Broken Tackles", formatNumber);
const fumbles = seasonValue("fumbles", "Fumbles", formatNumber);
const expectedPprPoints = seasonValue("expectedPprPoints", "Expected PPR Pts", fmtDec1);
const pprPointsOverExpected = seasonValue("pprPointsOverExpected", "Pts Over Expected", fmtSigned1);
const expectedTds = seasonValue("expectedTds", "Expected TDs", fmtDec1);
const expectedReceptions = seasonValue("expectedReceptions", "Expected Receptions", fmtDec1);
const bigPlays = (noun) => [
  seasonValue("plays20Plus", `20+ Yd ${noun}`, formatNumber),
  seasonValue("plays40Plus", `40+ Yd ${noun}`, formatNumber),
];

const RECEIVER_ROWS = [
  ...inGroup("USAGE", [
    targetShare,
    def("airYardsShare", "Air Yards Share", (weeks) => formatPercent(averageWeeks(weeks, "airYardsShare"))),
    wopr,
    snapShare,
  ]),
  ...inGroup("EFFICIENCY", [
    def("receivingEpa", "Receiving EPA", (weeks) => formatSigned(seasonReceivingEpa(weeks), 2)),
    def("racr", "RACR", (weeks) => {
      const v = seasonRacr(weeks);
      return v == null ? "—" : v.toFixed(2);
    }),
    yacPerRec,
    receivingAirYards,
  ]),
  ...inGroup("TRACKING · NEXT GEN", [
    seasonValue("separation", "Avg Separation", fmtDec2),
    seasonValue("cushion", "Avg Cushion", fmtDec2),
    seasonValue("yacOverExpected", "YAC Over Expected", fmtSigned2),
    seasonValue("catchRate", "Catch Rate", fmtPercent),
  ]),
  ...inGroup("CHARTING · PFR", [
    seasonValue("dropRate", "Drop Rate", fmtPercent),
    brokenTackles,
    seasonValue("ratingWhenTargeted", "Passer Rtg When Tgt", fmtDec1),
    seasonValue("intsWhenTargeted", "INTs When Targeted", formatNumber),
  ]),
  ...inGroup("EXPECTED POINTS", [expectedPprPoints, pprPointsOverExpected, expectedTds, expectedReceptions]),
  ...inGroup("BIG PLAYS & FUMBLES", [...bigPlays("Catches"), fumbles]),
];

// Exported so prototype pages (leaderboards, compare) can list the ranked
// metrics per position from the same source as the Advanced panel.
export const ADVANCED_CONFIG = {
  QB: [
    ...inGroup("EFFICIENCY", [
      def("passingEpa", "Passing EPA", (weeks) => formatSigned(seasonPassingEpa(weeks), 2)),
      def("passingCpoe", "Passing CPOE", (weeks) => {
        // passingCpoe is stored in percentage points (11.78 = +11.78 pp).
        // formatPercent expects a decimal, so divide by 100. Null guard is
        // required because null / 100 === 0 in JS, not null. Explicit + sign
        // because CPOE is an over/under-expected stat — the sign is the story.
        const v = seasonCpoe(weeks);
        if (v == null) return "—";
        const pct = formatPercent(v / 100);
        return v >= 0 ? `+${pct}` : pct;
      }),
      def("pacr", "PACR", (weeks) => {
        const v = seasonPacr(weeks);
        return v == null ? "—" : v.toFixed(2);
      }),
      def("passingAirYards", "Passing Air Yards", (weeks) => formatNumber(sumWeeks(weeks, "passingAirYards"))),
      def("adot", "Avg Depth of Target", (weeks) => {
        const v = seasonAdot(weeks);
        return v == null ? "—" : v.toFixed(1);
      }),
    ]),
    ...inGroup("TRACKING · NEXT GEN", [
      seasonValue("timeToThrow", "Time to Throw", fmtSeconds),
      seasonValue("aggressiveness", "Aggressiveness", fmtPercent),
      seasonValue("airYardsToSticks", "Air Yards to Sticks", fmtSigned2),
    ]),
    ...inGroup("PRESSURE", [
      seasonValue("pressureRate", "Pressure Rate", fmtPercent),
      seasonValue("badThrowPct", "Bad Throw %", fmtPercent),
      def("sacksSuffered", "Sacks Suffered", (weeks) => formatNumber(sumWeeks(weeks, "sacksSuffered"))),
      // nflverse stores sack yardage as negative. The label already says
      // "lost", so show the magnitude — "-193 lost" reads as a double negative.
      def("sackYardsLost", "Sack Yards Lost", (weeks) => formatNumber(Math.abs(sumWeeks(weeks, "sackYardsLost")))),
    ]),
    ...inGroup("EXPECTED POINTS", [expectedPprPoints, pprPointsOverExpected, expectedTds]),
    ...inGroup("BIG PLAYS & FUMBLES", [...bigPlays("Completions"), fumbles]),
  ],
  WR: RECEIVER_ROWS,
  TE: RECEIVER_ROWS,
  RB: [
    ...inGroup("EFFICIENCY", [
      def("rushingEpa", "Rushing EPA", (weeks) => formatSigned(seasonRushingEpa(weeks), 2)),
      yacPerRec,
      receivingAirYards,
    ]),
    ...inGroup("USAGE", [
      def("carries", "Carries", (weeks) => formatNumber(sumWeeks(weeks, "carries"))),
      snapShare,
      targetShare,
      wopr,
    ]),
    ...inGroup("TRACKING · NEXT GEN", [
      seasonValue("ryoePerAtt", "RYOE / Att", fmtSigned2),
      seasonValue("runsOverExpectedPct", "Runs Over Expected %", fmtSignedPercent),
      seasonValue("eightBoxPct", "8+ Defenders in Box", fmtPercent),
      seasonValue("timeToLos", "Time to LOS", fmtSeconds),
    ]),
    ...inGroup("CHARTING · PFR", [
      seasonValue("beforeContactPerAtt", "Before Contact / Att", fmtDec2),
      seasonValue("afterContactPerAtt", "After Contact / Att", fmtDec2),
      brokenTackles,
    ]),
    ...inGroup("EXPECTED POINTS", [expectedPprPoints, pprPointsOverExpected, expectedTds, expectedReceptions]),
    ...inGroup("BIG PLAYS & FUMBLES", [...bigPlays("Runs"), fumbles]),
  ],
};

// ── Per-week helpers (single week object, not weeks array) ───────────────────
// These operate on one week document and return number|null. They are
// intentionally distinct from the season-aggregate helpers above.

/**
 * Per-game completion percentage: completions / attempts.
 * @param {Object} week - Single weekly stat object
 * @returns {number|null}
 */
export function gameCompletionPct(week) {
  if (!week.attempts) return null;
  return week.completions / week.attempts;
}

/**
 * Per-game yards per carry: rushingYards / carries.
 * @param {Object} week - Single weekly stat object
 * @returns {number|null}
 */
export function gameYardsPerCarry(week) {
  if (!week.carries) return null;
  return week.rushingYards / week.carries;
}

/**
 * Per-game yards per reception: receivingYards / receptions.
 * @param {Object} week - Single weekly stat object
 * @returns {number|null}
 */
export function gameYardsPerRec(week) {
  if (!week.receptions) return null;
  return week.receivingYards / week.receptions;
}

/**
 * Combined rushing + receiving touchdowns for a single game.
 * Always returns a number (nulls treated as 0).
 * @param {Object} week - Single weekly stat object
 * @returns {number}
 */
export function combinedTds(week) {
  return (week.rushingTds ?? 0) + (week.receivingTds ?? 0);
}

/**
 * Builds the ordered advanced-tab rows for a player, ready for the panel to
 * map over. Returns rows with bar:null (not an empty array) for sub-threshold
 * players whose position is supported — the panel decides whether to show
 * raw-only or a pure empty state (deferred 15b.2). Unknown positions return [].
 *
 * Each row: { k: displayLabel, key, group, direction, since, bar: percentile|null,
 * v: formattedRawValue }. `since` is undefined except on PFR rows.
 * @param {Object} player - Player document with .position, .weeks, .advanced,
 *   .advancedValues
 * @returns {Array<{k: string, key: string, group: string, direction: string,
 *   since: number|undefined, bar: number|null, v: string}>}
 */
export function buildAdvancedRows(player) {
  const rows = ADVANCED_CONFIG[player.position];
  if (!rows) return [];

  const weeks = player.weeks ?? [];

  return rows.map(({ key, label, group, direction, since, rawValue }) => ({
    k: label,
    key,
    group,
    direction,
    since,
    bar: player.advanced?.[key] ?? null,
    v: rawValue(weeks, player),
  }));
}

/**
 * Splits rows into their groups, keeping the order groups first appear in and
 * the order of rows within each group.
 * @param {Array<{group: string}>} rows
 * @returns {Array<{group: string, rows: Array<Object>}>}
 */
export function groupRows(rows) {
  const groups = [];
  const byName = new Map();
  for (const row of rows) {
    let entry = byName.get(row.group);
    if (!entry) {
      entry = { group: row.group, rows: [] };
      byName.set(row.group, entry);
      groups.push(entry);
    }
    entry.rows.push(row);
  }
  return groups;
}
