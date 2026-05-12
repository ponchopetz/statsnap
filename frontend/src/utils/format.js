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
