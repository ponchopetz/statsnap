// utils/similarity.js
//
// "Plays like" comps: nearest neighbours on the ETL percentile vector.
// Percentiles are already position-cohort relative and on a 0..1 scale, so
// weighted Euclidean distance over the metrics both players have is a fair
// like-for-like measure without any re-scaling. Distance is normalised by
// the total weight of the shared metrics so a 3-metric overlap and a
// 7-metric overlap read on the same 0..1 similarity scale.

// Efficiency metrics carry more of "how a player plays" than volume ones,
// so EPA rates count double. Anything not listed weighs 1.
const DEFAULT_WEIGHTS = {
  passingEpa: 2,
  rushingEpa: 2,
  receivingEpa: 2,
  passingCpoe: 1.5,
};

function sharedMetrics(a, b) {
  return Object.keys(a).filter((k) => typeof a[k] === "number" && typeof b[k] === "number");
}

/** 0..1, where 1 is an identical percentile profile. null if too little overlaps. */
function similarity(advancedA, advancedB, { minShared = 3, weights = DEFAULT_WEIGHTS } = {}) {
  const keys = sharedMetrics(advancedA ?? {}, advancedB ?? {});
  if (keys.length < minShared) return null;
  let sum = 0;
  let totalWeight = 0;
  for (const k of keys) {
    const w = weights[k] ?? 1;
    const d = advancedA[k] - advancedB[k];
    sum += w * d * d;
    totalWeight += w;
  }
  // Max possible weighted distance is sqrt(totalWeight); normalise to 0..1.
  return 1 - Math.sqrt(sum / totalWeight);
}

/**
 * Ranks candidates by similarity to `target`. The target player's own
 * seasons are dropped. Candidates missing a comparable profile are dropped.
 * Ties break on displayName, then season, for stability.
 */
function rankSimilar(target, candidates, limit = 5, options = {}) {
  return candidates
    .filter((c) => c.playerId !== target.playerId)
    .map((c) => ({ candidate: c, similarity: similarity(target.advanced, c.advanced, options) }))
    .filter((x) => x.similarity != null)
    .sort(
      (x, y) =>
        y.similarity - x.similarity ||
        String(x.candidate.displayName).localeCompare(String(y.candidate.displayName)) ||
        (y.candidate.season ?? 0) - (x.candidate.season ?? 0),
    )
    .slice(0, limit);
}

module.exports = { similarity, rankSimilar, DEFAULT_WEIGHTS };
