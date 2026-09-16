// utils/similarity.js
//
// "Plays like" comps: nearest neighbours on the ETL percentile vector.
// Percentiles are already position-cohort relative and on a 0..1 scale, so
// plain Euclidean distance over the metrics both players have is a fair
// like-for-like measure without any re-scaling. Distance is normalised by
// the number of shared metrics so a 3-metric overlap and a 7-metric overlap
// read on the same 0..1 similarity scale.

function sharedMetrics(a, b) {
  return Object.keys(a).filter((k) => typeof a[k] === "number" && typeof b[k] === "number");
}

/** 0..1, where 1 is an identical percentile profile. null if nothing overlaps. */
function similarity(advancedA, advancedB, minShared = 3) {
  const keys = sharedMetrics(advancedA ?? {}, advancedB ?? {});
  if (keys.length < minShared) return null;
  let sum = 0;
  for (const k of keys) {
    const d = advancedA[k] - advancedB[k];
    sum += d * d;
  }
  // Max possible distance over n metrics is sqrt(n); normalise to 0..1.
  return 1 - Math.sqrt(sum / keys.length);
}

/**
 * Ranks candidates by similarity to `target`. Candidates missing a
 * comparable profile are dropped. Ties break on displayName for stability.
 */
function rankSimilar(target, candidates, limit = 5) {
  return candidates
    .filter((c) => c.playerId !== target.playerId)
    .map((c) => ({ candidate: c, similarity: similarity(target.advanced, c.advanced) }))
    .filter((x) => x.similarity != null)
    .sort((x, y) => y.similarity - x.similarity || String(x.candidate.displayName).localeCompare(String(y.candidate.displayName)))
    .slice(0, limit);
}

module.exports = { similarity, rankSimilar };
