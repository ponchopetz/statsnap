/**
 * Computes a player's age in whole years from an ISO date string.
 * @param {string|null|undefined} birthDate - ISO date string e.g. "1995-09-17"
 * @returns {number|null} Age in years, or null if input is missing/invalid.
 */
export function formatAge(birthDate) {
  if (!birthDate) return null;
  const parsed = new Date(birthDate);
  if (Number.isNaN(parsed.getTime())) return null;

  const today = new Date();
  let age = today.getFullYear() - parsed.getFullYear();
  if (
    today.getMonth() < parsed.getMonth() ||
    (today.getMonth() === parsed.getMonth() && today.getDate() < parsed.getDate())
  ) {
    age -= 1;
  }
  return age;
}

/**
 * Formats a height in total inches into a feet-and-inches string.
 * @param {number|null|undefined} heightInches - Total height in inches e.g. 75
 * @returns {string|null} Formatted string like `6'3"`, or null if input is missing.
 */
export function formatHeight(heightInches) {
  if (heightInches == null) return null;
  const feet = Math.floor(heightInches / 12);
  const inches = heightInches % 12;
  return `${feet}'${inches}"`;
}

/**
 * Formats draft information into a readable string.
 * @param {number|null|undefined} year - Draft year e.g. 2018
 * @param {number|null|undefined} round - Draft round e.g. 1
 * @param {number|null|undefined} pick - Draft pick number e.g. 32
 * @returns {string|null} "Undrafted" if all are null, formatted string like
 *   "2018 · R1 · #32" if all are present, or null if only some are present.
 */
export function formatDraft(year, round, pick) {
  if (year == null && round == null && pick == null) return "Undrafted";
  if (year == null || round == null || pick == null) return null;
  return `${year} · R${round} · #${pick}`;
}

/**
 * Formats a number with comma thousands separators and no decimal places.
 * @param {number|null|undefined} n - Number to format e.g. 4280
 * @returns {string} Formatted string like "4,280", or "—" if input is missing
 */
export function formatNumber(n) {
  if (n == null) return "—";
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(n);
}

/**
 * Formats a decimal ratio as a percentage string.
 * @param {number|null|undefined} n - Decimal value e.g. 0.673
 * @param {number} [decimals=1] - Number of decimal places in the output
 * @returns {string} Formatted string like "67.3%", or "—" if input is missing
 */
export function formatPercent(n, decimals = 1) {
  if (n == null) return "—";
  return `${(n * 100).toFixed(decimals)}%`;
}

/**
 * Formats a number with an explicit sign prefix.
 * @param {number|null|undefined} n - Number to format e.g. 4.2 or -1.8
 * @param {number} [decimals=1] - Number of decimal places in the output
 * @returns {string} Signed string like "+4.2" or "-1.8", or "—" if input is missing
 */
export function formatSigned(n, decimals = 1) {
  if (n == null) return "—";
  const fixed = n.toFixed(decimals);
  return n >= 0 ? `+${fixed}` : fixed;
}

/**
 * Formats a number to a fixed number of decimal places.
 * @param {number|null|undefined} n
 * @param {number} [decimals=1]
 * @returns {string} e.g. "13.6", or "—" if input is missing
 */
export function formatDecimal(n, decimals = 1) {
  if (n == null) return "—";
  return n.toFixed(decimals);
}
