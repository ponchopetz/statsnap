import { useState, useEffect } from "react";

/**
 * Returns a debounced copy of `value` that only updates after `delayMs`
 * has passed without `value` changing. Used to throttle rapid input
 * (typing in a search box) into infrequent downstream effects (network
 * calls, expensive computations).
 *
 * Example:
 *   const [query, setQuery] = useState("");
 *   const debouncedQuery = useDebouncedValue(query, 200);
 *   // debouncedQuery only updates 200ms after the user stops typing
 */
export function useDebouncedValue(value, delayMs) {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      setDebouncedValue(value);
    }, delayMs);

    return () => clearTimeout(timeoutId);
  }, [value, delayMs]);

  return debouncedValue;
}
