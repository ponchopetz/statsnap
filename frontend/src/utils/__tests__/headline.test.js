import { describe, it, expect } from "vitest";
import { HEADLINE_CONFIG, primaryKey } from "../headline.js";
import { buildComparison } from "../compare.js";
import { qbSeason, wrSeason, week } from "../../test/fixtures.js";

// headline.js is the single list of headline stats. Overview, Compare, and
// the form line all read it, so its shape and values are pinned here.

describe("HEADLINE_CONFIG shape", () => {
  it("has six rows per position with GP first and exactly one primary", () => {
    for (const [position, rows] of Object.entries(HEADLINE_CONFIG)) {
      expect(rows, position).toHaveLength(6);
      expect(rows[0].key).toBe("gamesPlayed");
      expect(rows.filter((r) => r.primary)).toHaveLength(1);
      for (const r of rows) {
        expect(typeof r.value).toBe("function");
        expect(typeof r.format).toBe("function");
        if (r.chartable) {
          expect(typeof r.series).toBe("function");
          expect(typeof r.formatSeries).toBe("function");
        }
      }
    }
    expect(primaryKey("QB")).toBe("passingYards");
    expect(primaryKey("K")).toBeNull();
  });

  it("WR and TE share the receiver list", () => {
    expect(HEADLINE_CONFIG.WR).toBe(HEADLINE_CONFIG.TE);
  });
});

describe("headline values", () => {
  it("QB rows are ratio-of-sums and per-week series keep nulls", () => {
    const p = qbSeason();
    const w = p.weeks;
    const byKey = Object.fromEntries(HEADLINE_CONFIG.QB.map((r) => [r.key, r]));

    expect(byKey.gamesPlayed.format(byKey.gamesPlayed.value(w, p))).toBe("2");
    // 44 completions / 70 attempts
    expect(byKey.completionPct.format(byKey.completionPct.value(w, p))).toBe("62.9%");
    expect(byKey.passingYards.format(byKey.passingYards.value(w, p))).toBe("550");
    expect(byKey.interceptions.value(w, p)).toBe(2);
    // (8.4 - 4.2) / 70 attempts
    expect(byKey.passingEpa.format(byKey.passingEpa.value(w, p))).toBe("+0.1");

    const series = byKey.completionPct.series([week({ attempts: 0 }), week({ attempts: 10, completions: 7 })]);
    expect(series).toEqual([null, 70]);
    expect(byKey.completionPct.formatSeries(70)).toBe("70.0%");
  });

  it("CMP % and TGT SHARE read as no value when there is nothing to divide", () => {
    const qb = HEADLINE_CONFIG.QB.find((r) => r.key === "completionPct");
    expect(qb.value([week({ attempts: 0 })], {})).toBeNull();
    const wr = HEADLINE_CONFIG.WR.find((r) => r.key === "targetShare");
    expect(wr.value([week({ targetShare: null })], {})).toBeNull();
    expect(wr.format(wr.value([], {}))).toBe("—");
  });

  it("receiver total TD series combines rushing and receiving per week", () => {
    const row = HEADLINE_CONFIG.WR.find((r) => r.key === "totalTds");
    expect(row.series([week({ rushingTds: 1, receivingTds: 2 }), week({})])).toEqual([3, 0]);
  });
});

describe("buildComparison", () => {
  it("aligns headline rows, sizes bars relative to the larger value, and picks winners by direction", () => {
    const a = qbSeason({ weeks: [week({ attempts: 30, completions: 20, passingYards: 300, passingTds: 3, interceptions: 0, passingEpa: 6 })] });
    const b = qbSeason({ weeks: [week({ attempts: 30, completions: 15, passingYards: 150, passingTds: 3, interceptions: 2, passingEpa: 3 })] });
    const { headline } = buildComparison(a, b);
    const row = (k) => headline.find((r) => r.key === k);

    expect(headline.map((r) => r.key)).toEqual(HEADLINE_CONFIG.QB.map((r) => r.key));
    expect(row("passingYards")).toMatchObject({ winner: "a", a: { display: "300", share: 1 }, b: { display: "150", share: 0.5 } });
    expect(row("passingTds").winner).toBeNull(); // tie
    expect(row("interceptions").winner).toBe("a"); // fewer wins
    expect(row("gamesPlayed").winner).toBeNull();
  });

  it("advanced rows carry percentiles and the higher percentile wins even for inverted metrics", () => {
    const a = qbSeason({ advanced: { sacksSuffered: 0.9, passingEpa: 0.2 }, weeks: [week({ attempts: 30, sacksSuffered: 1 })] });
    const b = qbSeason({ advanced: { sacksSuffered: 0.3, passingEpa: 0.8 }, weeks: [week({ attempts: 30, sacksSuffered: 4 })] });
    const { advanced } = buildComparison(a, b);
    const sacks = advanced.find((r) => r.key === "Sacks Suffered");
    expect(sacks).toMatchObject({ winner: "a", lowerIsBetter: true, a: { display: "1", pct: 0.9 }, b: { display: "4", pct: 0.3 } });
    expect(advanced.find((r) => r.key === "Passing EPA").winner).toBe("b");
    // No percentile on either side: bar share 0, no winner, raw value still shown.
    const pacr = advanced.find((r) => r.key === "PACR");
    expect(pacr).toMatchObject({ winner: null, a: { share: 0, pct: null } });
  });

  it("works across seasons: each side is its own document", () => {
    const a = wrSeason({ season: 2022 });
    const b = wrSeason({ season: 2024, weeks: [week({ targets: 20, receptions: 15, receivingYards: 200 })] });
    const { headline } = buildComparison(a, b);
    expect(headline.find((r) => r.key === "targets")).toMatchObject({ a: { display: "21" }, b: { display: "20" }, winner: "a" });
  });
});
