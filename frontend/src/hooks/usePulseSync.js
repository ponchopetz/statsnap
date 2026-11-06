import { useEffect } from "react";

// Must match the `pulse` animation duration in the CSS (1.8s infinite).
export const PULSE_PERIOD_MS = 1800;

/**
 * Phase-locks a CSS pulse animation to the document timeline, so every
 * element given this hook pulses together no matter when it mounted or
 * restarted its animation.
 *
 * With the Web Animations API the running animation's startTime is snapped
 * to a multiple of the period, which holds even when the browser defers the
 * animation's start (background tabs). Where getAnimations is missing (old
 * browsers, jsdom) a negative animation-delay for the current moment is the
 * fallback. Never both on one element: the delay would offset it again.
 *
 * Pass `deps` that change whenever the animation restarts (for example a
 * class that toggles `animation: none`), so the lock is redone then.
 *
 * Example:
 *   const dotRef = useRef(null);
 *   usePulseSync(dotRef);
 *   <span ref={dotRef} className="pulsing" />
 */
export function usePulseSync(ref, deps = []) {
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (typeof el.getAnimations === "function") {
      let cancelled = false;
      for (const animation of el.getAnimations()) {
        animation.ready
          .then(() => {
            if (!cancelled) animation.startTime = 0;
          })
          .catch(() => {}); // cancelled before it started: nothing to align
      }
      return () => {
        cancelled = true;
      };
    }
    el.style.animationDelay = `-${performance.now() % PULSE_PERIOD_MS}ms`;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}
