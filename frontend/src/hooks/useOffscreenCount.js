import { useState, useEffect } from "react";

// Children whose left edge is within this many px of the container right are
// considered visible, so the count only bumps when they're clearly out of view.
const OFFSCREEN_THRESHOLD = 24;

// Measures how many DIRECT CHILDREN of scrollRef are fully off the right edge.
// Generic — no card class hardcoded, so any scrollable rail can reuse this.
export default function useOffscreenCount(scrollRef, deps = []) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!scrollRef.current) return;

    function measure() {
      const container = scrollRef.current;
      if (!container) return;
      const right = container.getBoundingClientRect().right - OFFSCREEN_THRESHOLD;
      let offscreen = 0;
      for (const child of container.children) {
        if (child.getBoundingClientRect().left >= right) offscreen++;
      }
      setCount(offscreen);
    }

    measure();
    const el = scrollRef.current; // capture before cleanup closure runs
    el.addEventListener("scroll", measure);
    window.addEventListener("resize", measure);
    return () => {
      el.removeEventListener("scroll", measure);
      window.removeEventListener("resize", measure);
    };
  // deps is forwarded from the caller so the effect re-runs after data loads
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return count;
}
