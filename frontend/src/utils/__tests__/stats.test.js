import { describe, it, expect } from "vitest";
import {
  sumWeeks,
  averageWeeks,
  completionPct,
  totalTouchdowns,
  weekSeries,
  seasonAdot,
  seasonPacr,
  seasonRacr,
  seasonYacPerRec,
  seasonPassingEpa,
  seasonRushingEpa,
  seasonReceivingEpa,
  seasonCpoe,
  gameCompletionPct,
  gameYardsPerCarry,
  gameYardsPerRec,
  combinedTds,
  buildAdvancedRows,
} from "../stats.js";

// Edge-case behaviour of the season helpers that the golden contract test
// does not pin: empty input, missing fields, zero denominators, tiny
// samples, and the distinction between "no basis" (null) and a real zero.

describe("season sums and averages", () => {
  it("treat empty, null, and undefined weeks as zero-volume", () => {
    expect(sumWeeks([], "attempts")).toBe(0);
    expect(sumWeeks(null, "attempts")).toBe(0);
    expect(sumWeeks(undefined, "attempts")).toBe(0);
    expect(averageWeeks([], "targetShare")).toBeNull();
    expect(weekSeries(null, "x")).toEqual([]);
  });

  it("sum treats a missing field as zero; average skips it", () => {
    const weeks = [{ x: 5 }, { x: null }, {}, { x: 7 }];
    expect(sumWeeks(weeks, "x")).toBe(12);
    expect(averageWeeks(weeks, "x")).toBe(6);
  });

  it("average returns null (not 0 or NaN) when every week is null", () => {
    // Mirrors Polars mean(): no basis to average means no value.
    expect(averageWeeks([{ x: null }, {}], "x")).toBeNull();
  });

  it("weekSeries keeps nulls so a DNP week is not drawn as zero", () => {
    expect(weekSeries([{ x: 3 }, { x: null }, {}, { x: 0 }], "x")).toEqual([3, null, null, 0]);
  });

  it("totalTouchdowns combines rushing and receiving", () => {
    expect(totalTouchdowns([{ rushingTds: 1, receivingTds: 2 }, { rushingTds: null }])).toBe(3);
  });
});

describe("ratio-of-sums helpers", () => {
  it("completionPct weights by attempts, returns 0 for no attempts", () => {
    // 10/10 then 10/40: mean of rates is 62.5%; ratio of sums is 40%.
    const weeks = [{ attempts: 10, completions: 10 }, { attempts: 40, completions: 10 }];
    expect(completionPct(weeks)).toBeCloseTo(0.4, 10);
    expect(completionPct([])).toBe(0);
    expect(completionPct([{ attempts: 0, completions: 0 }])).toBe(0);
  });

  it("returns null (not 0 or NaN) when the denominator is zero", () => {
    expect(seasonAdot([{ attempts: 0, passingAirYards: 0 }])).toBeNull();
    expect(seasonPacr([{ passingAirYards: 0, passingYards: 70 }])).toBeNull();
    expect(seasonRacr([{ receivingAirYards: 0, receivingYards: 10 }])).toBeNull();
    expect(seasonYacPerRec([{ receptions: 0, receivingYac: 0 }])).toBeNull();
    expect(seasonPassingEpa([{ attempts: 0, passingEpa: 0 }])).toBeNull();
    expect(seasonRushingEpa([{ carries: 0, rushingEpa: 0 }])).toBeNull();
    expect(seasonReceivingEpa([{ targets: 0, receivingEpa: 0 }])).toBeNull();
    expect(seasonCpoe([{ attempts: 0, passingCpoe: 1 }])).toBeNull();
  });

  it("returns null for empty or missing weeks", () => {
    for (const fn of [seasonAdot, seasonPacr, seasonRacr, seasonYacPerRec, seasonPassingEpa, seasonRushingEpa, seasonReceivingEpa, seasonCpoe]) {
      expect(fn([])).toBeNull();
      expect(fn(null)).toBeNull();
      expect(fn(undefined)).toBeNull();
    }
  });

  it("all-checkdown season: aDOT is a legitimate 0, PACR is undefined", () => {
    const weeks = [{ attempts: 12, passingAirYards: 0, passingYards: 70 }];
    expect(seasonAdot(weeks)).toBe(0);
    expect(seasonPacr(weeks)).toBeNull();
  });

  it("negative season air yards: aDOT stays a real number, PACR/RACR are null", () => {
    expect(seasonAdot([{ attempts: 10, passingAirYards: -12, passingYards: 50 }])).toBeCloseTo(-1.2, 10);
    expect(seasonPacr([{ attempts: 10, passingAirYards: -12, passingYards: 50 }])).toBeNull();
    expect(seasonRacr([{ receivingAirYards: -5, receivingYards: 40 }, { receivingAirYards: -8, receivingYards: 20 }])).toBeNull();
  });

  it("a null-EPA week drops its attempts from the denominator", () => {
    const weeks = [
      { attempts: 30, passingEpa: null },
      { attempts: 30, passingEpa: 6 },
    ];
    expect(seasonPassingEpa(weeks)).toBeCloseTo(0.2, 10);
  });

  it("a week with EPA but a missing play count contributes to the numerator only", () => {
    // Mirrors Python: when(epa not null).then(attempts=null) sums as 0.
    const weeks = [{ attempts: 10, passingEpa: 2 }, { passingEpa: 3 }];
    expect(seasonPassingEpa(weeks)).toBeCloseTo(0.5, 10);
  });

  it("CPOE is attempt-weighted and skips weeks missing either operand", () => {
    const weeks = [
      { attempts: 10, passingCpoe: 10 },
      { attempts: 30, passingCpoe: -2 },
      { attempts: 50, passingCpoe: null },
      { attempts: null, passingCpoe: 99 },
    ];
    expect(seasonCpoe(weeks)).toBeCloseTo(1, 10);
  });

  it("tiny sample: a single one-target week still yields a rate", () => {
    const weeks = [{ targets: 1, receptions: 1, receivingYards: 9, receivingYac: 4, receivingAirYards: 6, receivingEpa: 0.7 }];
    expect(seasonReceivingEpa(weeks)).toBeCloseTo(0.7, 10);
    expect(seasonRacr(weeks)).toBeCloseTo(1.5, 10);
    expect(seasonYacPerRec(weeks)).toBe(4);
  });

  it("weeks combined across seasons (career pseudo-doc) stay ratio-of-sums", () => {
    // Career totals are built by concatenating every season's weeks; the
    // rate must be attempt-weighted across seasons, not a mean of seasons.
    const s1 = [{ attempts: 100, completions: 70 }];
    const s2 = [{ attempts: 500, completions: 300 }];
    expect(completionPct([...s1, ...s2])).toBeCloseTo(370 / 600, 10);
  });
});

describe("per-game helpers", () => {
  it("return null when the game had no attempts/carries/receptions", () => {
    expect(gameCompletionPct({ attempts: 0, completions: 0 })).toBeNull();
    expect(gameCompletionPct({})).toBeNull();
    expect(gameYardsPerCarry({ carries: null, rushingYards: 0 })).toBeNull();
    expect(gameYardsPerRec({ receptions: 0 })).toBeNull();
  });

  it("compute plain per-game ratios otherwise", () => {
    expect(gameCompletionPct({ attempts: 40, completions: 30 })).toBe(0.75);
    expect(gameYardsPerCarry({ carries: 20, rushingYards: 110 })).toBe(5.5);
    expect(gameYardsPerRec({ receptions: 4, receivingYards: 50 })).toBe(12.5);
    expect(combinedTds({ rushingTds: 1 })).toBe(1);
    expect(combinedTds({})).toBe(0);
  });
});

describe("buildAdvancedRows", () => {
  it("returns [] for an unsupported position", () => {
    expect(buildAdvancedRows({ position: "K", weeks: [] })).toEqual([]);
  });

  it("sub-threshold player: rows with raw values but null bars", () => {
    const rows = buildAdvancedRows({ position: "QB", weeks: [{ attempts: 10, passingAirYards: 80, passingYards: 90 }] });
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.every((r) => r.bar === null)).toBe(true);
    expect(rows.find((r) => r.k === "Avg Depth of Target").v).toBe("8.0");
  });

  it("tolerates a document with no weeks array at all", () => {
    const rows = buildAdvancedRows({ position: "WR", advanced: { targetShare: 0.5 } });
    expect(rows.find((r) => r.k === "Target Share")).toEqual({ k: "Target Share", bar: 0.5, v: "—" });
    expect(rows.find((r) => r.k === "WOPR").v).toBe("—");
    expect(rows.find((r) => r.k === "RACR").v).toBe("—");
  });

  it("formats sack yards as a magnitude and CPOE with an explicit sign", () => {
    const rows = buildAdvancedRows({
      position: "QB",
      weeks: [{ attempts: 20, sackYardsLost: -35, passingCpoe: 3.25 }],
      advanced: { sackYardsLost: 0.9 },
    });
    expect(rows.find((r) => r.k === "Sack Yards Lost")).toMatchObject({ v: "35", bar: 0.9 });
    expect(rows.find((r) => r.k === "Passing CPOE").v).toBe("+3.3%");
  });
});
