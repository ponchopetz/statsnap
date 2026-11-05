import { useEffect } from "react";

// Must match the `pulse` animation duration in the CSS (1.8s infinite).
export const PULSE_PERIOD_MS = 1800;

/**
 * Phase-locks a CSS pulse animation to the document timeline. Every element
 * given this hook gets the same negative animation-delay for the current
 * moment, so they all sit at the same point of the cycle and pulse together,
 * no matter when each one mounted or restarted its animation.
 *
 * Pass `deps` that change whenever the animation restarts (for example a
 * class that toggles `animation: none`), so the delay is recomputed then.
 *
 * Example:
 *   const dotRef = useRef(null);
 *   usePulseSync(dotRef);
 *   <span ref={dotRef} className="pulsing" />
 */
export function usePulseSync(ref, deps = []) {
  useEffect(() => {
    if (!ref.current) return;
    ref.current.style.animationDelay = `-${performance.now() % PULSE_PERIOD_MS}ms`;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}
