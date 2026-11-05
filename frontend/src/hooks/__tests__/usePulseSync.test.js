import { describe, it, expect, vi, afterEach } from "vitest";
import { renderHook } from "@testing-library/react";
import { usePulseSync, PULSE_PERIOD_MS } from "../usePulseSync.js";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("usePulseSync", () => {
  it("sets a negative delay modulo the pulse period", () => {
    vi.spyOn(performance, "now").mockReturnValue(5000);
    const el = document.createElement("span");
    renderHook(() => usePulseSync({ current: el }));
    expect(PULSE_PERIOD_MS).toBe(1800);
    expect(el.style.animationDelay).toBe("-1400ms");
  });

  it("recomputes the delay when a dependency changes", () => {
    const now = vi.spyOn(performance, "now").mockReturnValue(5000);
    const el = document.createElement("span");
    const ref = { current: el };
    const { rerender } = renderHook(({ dep }) => usePulseSync(ref, [dep]), {
      initialProps: { dep: false },
    });
    expect(el.style.animationDelay).toBe("-1400ms");
    now.mockReturnValue(7000);
    rerender({ dep: true });
    expect(el.style.animationDelay).toBe("-1600ms");
  });

  it("does nothing when the ref is empty", () => {
    expect(() => renderHook(() => usePulseSync({ current: null }))).not.toThrow();
  });
});
