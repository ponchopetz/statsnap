// LABS (flag: careerArc). One headline stat across every loaded season,
// with the player's age that season, for the career chart.
import { HEADLINE_CONFIG } from "./headline.js";

/** Age on 1 September of `season`, or null without a birth date. */
export function ageInSeason(birthDate, season) {
  if (!birthDate) return null;
  const [y, m, d] = birthDate.split("-").map(Number);
  if (!y || !m || !d) return null;
  let age = season - y;
  if (m > 9 || (m === 9 && d > 1)) age -= 1;
  return age;
}

/** Chartable headline rows for a position (the stat choices). */
export function arcOptions(position) {
  return (HEADLINE_CONFIG[position] ?? []).filter((r) => r.chartable);
}

/**
 * @param {Array} seasons  player-season documents (any order)
 * @param {string} key     headline row key
 * @returns {{ points: Array<{season, age, value}>, row }}  oldest first
 */
export function buildCareerArc(seasons, key) {
  if (!seasons?.length) return { points: [], row: null };
  const position = seasons[0].position;
  const row = arcOptions(position).find((r) => r.key === key) ?? arcOptions(position)[0] ?? null;
  if (!row) return { points: [], row: null };
  const points = [...seasons]
    .sort((a, b) => a.season - b.season)
    .map((doc) => ({
      season: doc.season,
      age: ageInSeason(doc.birthDate, doc.season),
      value: row.value(doc.weeks ?? [], doc),
    }));
  return { points, row };
}
