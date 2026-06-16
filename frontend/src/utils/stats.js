import { formatNumber, formatPercent, formatSigned } from "./format.js";

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
 * didn't play, not actual zeros).
 * @param {Array<Object>|null|undefined} weeks - Weekly stat objects
 * @param {string} key - Property name to average
 * @returns {number} Mean of non-null values, or 0 if none exist
 */
export function averageWeeks(weeks, key) {
  if (!weeks?.length) return 0;
  const valid = weeks.filter((week) => week[key] != null);
  if (!valid.length) return 0;
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
 * targeted. Ratio of sums. Null when no passing air yards (QB never recorded
 * any downfield target), which excludes the player from PACR ranking.
 * @param {Array<Object>|null|undefined} weeks
 * @returns {number|null}
 */
export function seasonPacr(weeks) {
  const totalAirYards = sumWeeks(weeks, "passingAirYards");
  if (totalAirYards === 0) return null;
  return sumWeeks(weeks, "passingYards") / totalAirYards;
}

/**
 * Season-level Receiver Air Conversion Ratio: receiving yards per air yard
 * allocated to the receiver. Ratio of sums. Null when no receiving air yards.
 * @param {Array<Object>|null|undefined} weeks
 * @returns {number|null}
 */
export function seasonRacr(weeks) {
  const totalAirYards = sumWeeks(weeks, "receivingAirYards");
  if (totalAirYards === 0) return null;
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
// Each entry: { key, label, rawValue(weeks) → string }
// key    — matches player.advanced map keys and Python metric names
// label  — must match STAT_GLOSSARY keys so the panel's glossary lookup works
// rawValue — formatted display string for the raw season value

const RECEIVER_ROWS = [
  {
    key: "targetShare",
    label: "Target Share",
    rawValue: (weeks) => formatPercent(averageWeeks(weeks, "targetShare")),
  },
  {
    key: "airYardsShare",
    label: "Air Yards Share",
    rawValue: (weeks) => formatPercent(averageWeeks(weeks, "airYardsShare")),
  },
  {
    key: "wopr",
    label: "WOPR",
    // wopr is a 0–2ish rating, not a percentage — plain 2-decimal display.
    // format.js has no plain decimal formatter, so using toFixed(2) directly.
    rawValue: (weeks) => averageWeeks(weeks, "wopr").toFixed(2),
  },
  {
    key: "racr",
    label: "RACR",
    rawValue: (weeks) => {
      const v = seasonRacr(weeks);
      return v == null ? "—" : v.toFixed(2);
    },
  },
  {
    key: "receivingAirYards",
    label: "Receiving Air Yards",
    rawValue: (weeks) => formatNumber(sumWeeks(weeks, "receivingAirYards")),
  },
  {
    key: "yacPerRec",
    label: "YAC / Rec",
    rawValue: (weeks) => {
      const v = seasonYacPerRec(weeks);
      return v == null ? "—" : v.toFixed(1);
    },
  },
  {
    key: "receivingEpa",
    label: "Receiving EPA",
    rawValue: (weeks) => formatSigned(seasonReceivingEpa(weeks), 2),
  },
];

const ADVANCED_CONFIG = {
  QB: [
    {
      key: "passingEpa",
      label: "Passing EPA",
      rawValue: (weeks) => formatSigned(seasonPassingEpa(weeks), 2),
    },
    {
      key: "pacr",
      label: "PACR",
      rawValue: (weeks) => {
        const v = seasonPacr(weeks);
        return v == null ? "—" : v.toFixed(2);
      },
    },
    {
      key: "passingCpoe",
      label: "Passing CPOE",
      // passingCpoe is stored in percentage points (11.78 = +11.78 pp).
      // formatPercent expects a decimal, so divide by 100. Null guard is
      // required because null / 100 === 0 in JS, not null.
      rawValue: (weeks) => {
        const v = seasonCpoe(weeks);
        return v == null ? "—" : formatPercent(v / 100);
      },
    },
    {
      key: "passingAirYards",
      label: "Passing Air Yards",
      rawValue: (weeks) => formatNumber(sumWeeks(weeks, "passingAirYards")),
    },
    {
      key: "adot",
      label: "Avg Depth of Target",
      rawValue: (weeks) => {
        const v = seasonAdot(weeks);
        return v == null ? "—" : v.toFixed(1);
      },
    },
    {
      key: "sacksSuffered",
      label: "Sacks Suffered",
      rawValue: (weeks) => formatNumber(sumWeeks(weeks, "sacksSuffered")),
    },
    {
      key: "sackYardsLost",
      label: "Sack Yards Lost",
      rawValue: (weeks) => formatNumber(sumWeeks(weeks, "sackYardsLost")),
    },
  ],
  WR: RECEIVER_ROWS,
  TE: RECEIVER_ROWS,
  RB: [
    {
      key: "rushingEpa",
      label: "Rushing EPA",
      rawValue: (weeks) => formatSigned(seasonRushingEpa(weeks), 2),
    },
    {
      key: "targetShare",
      label: "Target Share",
      rawValue: (weeks) => formatPercent(averageWeeks(weeks, "targetShare")),
    },
    {
      key: "wopr",
      label: "WOPR",
      rawValue: (weeks) => averageWeeks(weeks, "wopr").toFixed(2),
    },
    {
      key: "yacPerRec",
      label: "YAC / Rec",
      rawValue: (weeks) => {
        const v = seasonYacPerRec(weeks);
        return v == null ? "—" : v.toFixed(1);
      },
    },
    {
      key: "carries",
      label: "Carries",
      rawValue: (weeks) => formatNumber(sumWeeks(weeks, "carries")),
    },
    {
      key: "receivingAirYards",
      label: "Receiving Air Yards",
      rawValue: (weeks) => formatNumber(sumWeeks(weeks, "receivingAirYards")),
    },
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
 * Each row: { k: displayLabel, bar: percentile|null, v: formattedRawValue }
 * @param {Object} player - Player document with .position, .weeks, .advanced
 * @returns {Array<{k: string, bar: number|null, v: string}>}
 */
export function buildAdvancedRows(player) {
  const rows = ADVANCED_CONFIG[player.position];
  if (!rows) return [];

  const weeks = player.weeks ?? [];

  return rows.map(({ key, label, rawValue }) => ({
    k: label,
    bar: player.advanced?.[key] ?? null,
    v: rawValue(weeks),
  }));
}
