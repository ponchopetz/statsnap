import { useState, useEffect } from "react";

/**
 * Returns whether the given CSS media query currently matches, and updates
 * when it changes. Lets a component react to viewport breakpoints in JS for
 * things CSS can't express on its own — e.g. swapping an element's text.
 *
 * Example:
 *   const isNarrow = useMediaQuery("(max-width: 30rem)");
 *   const placeholder = isNarrow ? "Search..." : "Search another player...";
 */
export function useMediaQuery(query) {
  const [matches, setMatches] = useState(
    () => window.matchMedia(query).matches,
  );

  useEffect(() => {
    const mql = window.matchMedia(query);
    const onChange = () => setMatches(mql.matches);
    onChange();
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, [query]);

  return matches;
}
