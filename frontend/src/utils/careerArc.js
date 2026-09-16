// One stat across every loaded season, with the player's age that season,
// for the career chart. Two modes:
//   totals      a headline stat's season value (same definitions as the
//               Career table)
//   percentile  the ETL-stored position-cohort percentile for an advanced
//               metric; null for a season below the qualifier, which draws
//               as a gap rather than a zero
import { HEADLINE_CONFIG } from "./headline.js";
import { ADVANCED_CONFIG } from "./stats.js";

export const ARC_MODES = ["totals", "percentile"];

/** Age on 1 September of `season`, or null without a birth date. */
export function ageInSeason(birthDate, season) {
  if (!birthDate) return null;
  const [y, m, d] = birthDate.split("-").map(Number);
  if (!y || !m || !d) return null;
  let age = season - y;
  if (m > 9 || (m === 9 && d > 1)) age -= 1;
  return age;
}

const formatPercentile = (p) => (p == null ? "—" : `P${Math.round(p * 100)}`);

/** Stat choices for a position in a mode: [{ key, label, format, primary? }]. */
export function arcOptions(position, mode = "totals") {
  if (mode === "percentile") {
    return (ADVANCED_CONFIG[position] ?? []).map((r) => ({ key: r.key, label: r.label, format: formatPercentile }));
  }
  return (HEADLINE_CONFIG[position] ?? []).filter((r) => r.chartable).map((r) => ({ key: r.key, label: r.label, format: r.format, primary: r.primary }));
}

/**
 * @param {Array} seasons  player-season documents (any order)
 * @param {string} key     stat key for the mode
 * @param {string} mode    "totals" | "percentile"
 * @returns {{ points: Array<{season, age, value}>, row }}  oldest first
 */
export function buildCareerArc(seasons, key, mode = "totals") {
  if (!seasons?.length) return { points: [], row: null };
  const position = seasons[0].position;
  const options = arcOptions(position, mode);
  const row = options.find((r) => r.key === key) ?? options.find((r) => r.primary) ?? options[0] ?? null;
  if (!row) return { points: [], row: null };

  const headlineRow = mode === "totals" ? HEADLINE_CONFIG[position].find((r) => r.key === row.key) : null;
  const valueOf = (doc) =>
    mode === "percentile" ? doc.advanced?.[row.key] ?? null : headlineRow.value(doc.weeks ?? [], doc);

  const points = [...seasons]
    .sort((a, b) => a.season - b.season)
    .map((doc) => ({ season: doc.season, age: ageInSeason(doc.birthDate, doc.season), value: valueOf(doc) }));
  return { points, row };
}
