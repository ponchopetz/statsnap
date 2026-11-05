import { describe, it, expect } from "vitest";
import { buildComparison, groupComparison } from "../compare.js";

const qb = (advanced) => ({ position: "QB", weeks: [], advanced });

describe("buildComparison advanced rows", () => {
  it("style rows never pick a winner", () => {
    const { advanced } = buildComparison(qb({ timeToThrow: 0.9 }), qb({ timeToThrow: 0.1 }));
    const row = advanced.find((r) => r.label === "Time to Throw");
    expect(row.direction).toBe("style");
    expect(row.winner).toBeNull();
  });

  it("carries group and direction, and lower-direction rows are lowerIsBetter", () => {
    const { advanced } = buildComparison(qb({ passingEpa: 0.9, sacksSuffered: 0.2 }), qb({ passingEpa: 0.1, sacksSuffered: 0.8 }));
    const epa = advanced.find((r) => r.label === "Passing EPA");
    const sacks = advanced.find((r) => r.label === "Sacks Suffered");
    expect(epa).toMatchObject({ group: "EFFICIENCY", direction: "higher", winner: "a", lowerIsBetter: false });
    expect(sacks).toMatchObject({ group: "PRESSURE", direction: "lower", winner: "b", lowerIsBetter: true });
  });
});

describe("groupComparison", () => {
  it("tallies only rows with a winner", () => {
    const rows = [
      { group: "G", winner: "a", direction: "higher" },
      { group: "G", winner: "a", direction: "higher" },
      { group: "G", winner: "b", direction: "higher" },
      { group: "G", winner: null, direction: "style" },
      { group: "G", winner: null, direction: "higher" },
    ];
    const [g] = groupComparison(rows);
    expect(g.group).toBe("G");
    expect(g.rows).toHaveLength(5);
    expect(g.tally).toEqual({ a: 2, b: 1 });
  });

  it("preserves group order", () => {
    const out = groupComparison([{ group: "X", winner: "a" }, { group: "Y", winner: "b" }, { group: "X", winner: null }]);
    expect(out.map((g) => g.group)).toEqual(["X", "Y"]);
    expect(out[0].tally).toEqual({ a: 1, b: 0 });
  });
});
