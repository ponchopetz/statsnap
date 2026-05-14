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
