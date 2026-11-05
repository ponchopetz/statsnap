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

  it("aligns a running animation's startTime to the timeline, without a delay", async () => {
    const animation = { ready: Promise.resolve(), startTime: null };
    const el = document.createElement("span");
    el.getAnimations = () => [animation];
    renderHook(() => usePulseSync({ current: el }));
    await animation.ready;
    await Promise.resolve();
    expect(animation.startTime % PULSE_PERIOD_MS).toBe(0);
    expect(el.style.animationDelay).toBe("");
  });

  it("realigns on a dependency change", async () => {
    const animation = { ready: Promise.resolve(), startTime: null };
    const el = document.createElement("span");
    el.getAnimations = () => [animation];
    const ref = { current: el };
    const { rerender } = renderHook(({ dep }) => usePulseSync(ref, [dep]), {
      initialProps: { dep: false },
    });
    await animation.ready;
    await Promise.resolve();
    animation.startTime = 123;
    rerender({ dep: true });
    await animation.ready;
    await Promise.resolve();
    expect(animation.startTime).toBe(0);
  });

  it("does nothing when the ref is empty", () => {
    expect(() => renderHook(() => usePulseSync({ current: null }))).not.toThrow();
  });
});
