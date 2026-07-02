import { useState, useEffect } from "react";

/**
 * Returns true once a loading state has lasted longer than delayMs.
 * Used to explain slow first responses (the free-tier API server spins
 * down when idle and takes ~20s to wake) instead of showing a silent
 * loading state. Resets to false whenever loading stops.
 *
 * @param {boolean} isLoading - Whether the request is currently in flight
 * @param {number} [delayMs=3000] - How long before the state counts as slow
 * @returns {boolean}
 */
export function useSlowLoading(isLoading, delayMs = 3000) {
  const [slow, setSlow] = useState(false);

  useEffect(() => {
    if (!isLoading) {
      setSlow(false);
      return undefined;
    }
    const id = setTimeout(() => setSlow(true), delayMs);
    return () => clearTimeout(id);
  }, [isLoading, delayMs]);

  return slow;
}
