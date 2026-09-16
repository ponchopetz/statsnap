/**
 * Computes a player's age in whole years from an ISO date string.
 * @param {string|null|undefined} birthDate - ISO date string e.g. "1995-09-17"
 * @returns {number|null} Age in years, or null if input is missing/invalid.
 */
export function formatAge(birthDate) {
  if (!birthDate) return null;
  // Construct from date parts: new Date("1995-09-17") parses as UTC
  // midnight, but the getMonth/getDate comparisons below are local — in
  // timezones west of UTC that shifts the birthday a day early.
  const [year, month, day] = birthDate.split("-").map(Number);
  if (!year || !month || !day) return null;
  const parsed = new Date(year, month - 1, day);
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

/**
 * Formats a player's NFL experience as the ordinal of the season being viewed.
 *
 * This is the single definition of the "experience" stat. The stored field
 * (`experience`, from nflverse `years_exp`, passed through untouched by the
 * ETL) counts seasons COMPLETED BEFORE the document's season, so a rookie is
 * 0 and a fourth-season player is 3. The number a football reader expects is
 * the season they are in, which is that count plus one. Doing the +1 here and
 * nowhere else keeps the ETL, the schema, and the API honest to the source
 * while the UI label ("NFL SEASON") matches what is shown.
 *
 * @param {number|null|undefined} yearsExp - Seasons completed before this one
 * @returns {string|null} "ROOKIE" for 0, otherwise an ordinal like "4TH" or
 *   "12TH"; null if the input is missing or not a non-negative integer.
 */
export function formatExperience(yearsExp) {
  if (yearsExp == null || !Number.isInteger(yearsExp) || yearsExp < 0) return null;
  if (yearsExp === 0) return "ROOKIE";
  const season = yearsExp + 1;
  const mod100 = season % 100;
  const mod10 = season % 10;
  let suffix = "TH";
  if (mod100 < 11 || mod100 > 13) {
    if (mod10 === 1) suffix = "ST";
    else if (mod10 === 2) suffix = "ND";
    else if (mod10 === 3) suffix = "RD";
  }
  return `${season}${suffix}`;
}
