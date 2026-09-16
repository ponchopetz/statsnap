import { createRequire } from "node:module";
import { describe, it, expect } from "vitest";

const require = createRequire(import.meta.url);
const { deriveNflWeek, seasonForDate, SEASON_BOUNDARIES } = require("../utils/nflWeek.js");
const { teamCodeFromName, NFL_TEAM_CODES } = require("../utils/nflTeams.js");

// SEASON_BOUNDARIES is hand-maintained config. These tests pin the contract
// the rest of the schedule path relies on: Tuesday-noon-ET boundaries,
// 7-day strides, weeks 1..18 only, and January games belonging to the
// prior season.

describe("deriveNflWeek", () => {
  it("buckets the 2026 Wednesday opener into week 1", () => {
    expect(deriveNflWeek("2026-09-10T00:20:00Z", 2026)).toBe(1); // Wed night ET
  });

  it("the boundary instant itself starts week 1; one ms earlier is null", () => {
    expect(deriveNflWeek(SEASON_BOUNDARIES[2026], 2026)).toBe(1);
    expect(deriveNflWeek("2026-09-08T15:59:59.999Z", 2026)).toBeNull();
  });

  it("a Monday night game stays in the same week as the previous Thursday", () => {
    expect(deriveNflWeek("2026-09-11T00:15:00Z", 2026)).toBe(1); // Thu night
    expect(deriveNflWeek("2026-09-15T00:15:00Z", 2026)).toBe(1); // Mon night
    expect(deriveNflWeek("2026-09-15T16:00:00Z", 2026)).toBe(2); // Tue noon → next week
  });

  it("caps at week 18 and returns null for the postseason", () => {
    const start = Date.parse(SEASON_BOUNDARIES[2026]);
    const week = 7 * 24 * 60 * 60 * 1000;
    expect(deriveNflWeek(new Date(start + 17 * week + 1000).toISOString(), 2026)).toBe(18);
    expect(deriveNflWeek(new Date(start + 18 * week + 1000).toISOString(), 2026)).toBeNull();
  });

  it("returns null for unknown seasons and unparseable input", () => {
    expect(deriveNflWeek("2024-09-08T17:00:00Z", 2024)).toBeNull();
    expect(deriveNflWeek("not a date", 2026)).toBeNull();
    expect(deriveNflWeek("2026-09-13T17:00:00Z", null)).toBeNull();
  });
});

describe("seasonForDate", () => {
  it("maps a January kickoff to the season that started the previous autumn", () => {
    expect(seasonForDate("2026-01-04T18:00:00Z")).toBe(2025);
  });

  it("picks the latest boundary at or before the kickoff", () => {
    expect(seasonForDate("2026-09-08T16:00:00Z")).toBe(2026);
    expect(seasonForDate("2026-09-08T15:59:59Z")).toBe(2025);
  });

  it("returns null before every configured boundary or for garbage", () => {
    expect(seasonForDate("2020-09-10T00:00:00Z")).toBeNull();
    expect(seasonForDate("")).toBeNull();
  });
});

describe("teamCodeFromName", () => {
  it("maps all 32 current franchises and trims whitespace", () => {
    expect(Object.keys(NFL_TEAM_CODES)).toHaveLength(32);
    expect(new Set(Object.values(NFL_TEAM_CODES)).size).toBe(32);
    expect(teamCodeFromName("  Kansas City Chiefs ")).toBe("KC");
  });

  it("returns null for relocated names, wrong types, and unknowns", () => {
    expect(teamCodeFromName("Oakland Raiders")).toBeNull();
    expect(teamCodeFromName("Washington Football Team")).toBeNull();
    expect(teamCodeFromName(undefined)).toBeNull();
    expect(teamCodeFromName(42)).toBeNull();
  });
});
