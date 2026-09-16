import { createRequire } from "node:module";
import { describe, it, expect, afterEach, vi } from "vitest";

const require = createRequire(import.meta.url);
const cron = require("node-cron");
const { startScheduleCron } = require("../utils/scheduleCron.js");

afterEach(() => {
  // node-cron keeps registered tasks alive; stop them so the worker exits.
  for (const task of cron.getTasks().values()) task.stop();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("startScheduleCron", () => {
  it("swallows a failing boot refresh instead of surfacing an unhandled rejection", async () => {
    // No database is connected in this file and fetch is broken, so the
    // refresh will reject. The wrapper must log and move on.
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("upstream down")));
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const unhandled = vi.fn();
    process.on("unhandledRejection", unhandled);

    expect(() => startScheduleCron()).not.toThrow();
    // Let the boot refresh run to its catch block.
    await vi.waitFor(() => {
      expect(warn).toHaveBeenCalledWith("[scheduleCron] refresh failed:", "upstream down");
    });
    await new Promise((r) => setTimeout(r, 0));

    process.off("unhandledRejection", unhandled);
    expect(unhandled).not.toHaveBeenCalled();
  });

  it("registers exactly one daily 08:00 UTC task", () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("upstream down")));
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const scheduleSpy = vi.spyOn(cron, "schedule");

    startScheduleCron();

    expect(scheduleSpy).toHaveBeenCalledTimes(1);
    expect(scheduleSpy).toHaveBeenCalledWith("0 8 * * *", expect.any(Function), { timezone: "UTC" });
  });
});
