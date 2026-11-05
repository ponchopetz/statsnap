import { describe, it, expect } from "vitest";
import { SHARE_CARD_KEYS } from "../../utils/shareCard.js";
import { buildAdvancedRows } from "../../utils/stats.js";

describe("share card advanced rows", () => {
  it("keeps today's row counts", () => {
    expect(Object.fromEntries(Object.entries(SHARE_CARD_KEYS).map(([p, k]) => [p, k.length]))).toEqual({
      QB: 7, WR: 7, TE: 7, RB: 6,
    });
  });

  for (const [position, keys] of Object.entries(SHARE_CARD_KEYS)) {
    it(`${position}: every key resolves against the position's advanced rows`, () => {
      const rowKeys = buildAdvancedRows({ position, weeks: [] }).map((r) => r.key);
      for (const key of keys) expect(rowKeys, key).toContain(key);
    });
  }
});
