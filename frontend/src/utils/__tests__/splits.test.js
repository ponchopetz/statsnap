import { describe, it, expect } from "vitest";
import { buildSplits, isDivisionalGame, SPLIT_COLUMNS, NFL_DIVISIONS } from "../splits.js";
import { qbSeason, wrSeason, week } from "../../test/fixtures.js";

describe("isDivisionalGame", () => {
  it("recognises the 32 current codes and legacy relocations", () => {
    expect(Object.keys(NFL_DIVISIONS).length).toBeGreaterThanOrEqual(32);
    expect(isDivisionalGame("KC", "DEN")).toBe(true);
    expect(isDivisionalGame("KC", "PHI")).toBe(false);
    expect(isDivisionalGame("OAK", "KC")).toBe(true);
    expect(isDivisionalGame("KC", "XXX")).toBe(false);
    expect(isDivisionalGame(undefined, "KC")).toBe(false);
  });
});

describe("buildSplits", () => {
  const player = qbSeason({
    team: "KC",
    weeks: [
      week({ week: 1, team: "KC", opponent: "DEN", homeAway: "home", result: "W", attempts: 30, completions: 20, passingYards: 300, passingTds: 3, interceptions: 0, passingEpa: 6 }),
      week({ week: 2, team: "KC", opponent: "PHI", homeAway: "away", result: "L", attempts: 40, completions: 20, passingYards: 200, passingTds: 1, interceptions: 2, passingEpa: -4 }),
      week({ week: 12, team: "KC", opponent: "LV", homeAway: "away", result: "W", attempts: 30, completions: 24, passingYards: 250, passingTds: 2, interceptions: 1, passingEpa: 3 }),
    ],
  });

  it("returns every group with rows whose cells use ratio-of-sums over the subset", () => {
    const groups = buildSplits(player);
    expect(groups.map((g) => g.label)).toEqual(["VENUE", "RESULT", "OPPONENT", "SEASON HALF"]);
    const venue = groups[0];
    const home = venue.rows.find((r) => r.key === "home");
    const away = venue.rows.find((r) => r.key === "away");
    expect(home.games).toBe(1);
    expect(away.games).toBe(2);
    // AWAY: 44/70 completions, 450 yards, 225/g, EPA (-4+3)/70
    expect(away.cells).toEqual(["2", "62.9%", "450", "225.0", "3", "3", "-0.01"]);
  });

  it("divisional split uses the week's team and opponent", () => {
    const opp = buildSplits(player).find((g) => g.label === "OPPONENT");
    expect(opp.rows.find((r) => r.key === "division").games).toBe(2); // DEN, LV
    expect(opp.rows.find((r) => r.key === "nonDivision").games).toBe(1); // PHI
  });

  it("falls back to the season team when a legacy week has no team field", () => {
    const legacy = qbSeason({ team: "KC", weeks: [week({ week: 1, opponent: "DEN", attempts: 10, completions: 5 })] });
    const opp = buildSplits(legacy).find((g) => g.label === "OPPONENT");
    expect(opp.rows.find((r) => r.key === "division").games).toBe(1);
  });

  it("hides the ties row unless there is a tie, and blanks empty rows", () => {
    const groups = buildSplits(player);
    const result = groups.find((g) => g.label === "RESULT");
    expect(result.rows.map((r) => r.key)).toEqual(["wins", "losses"]);

    const oneHome = qbSeason({ weeks: [week({ week: 1, homeAway: "home", result: "T", attempts: 10, completions: 5 })] });
    const g2 = buildSplits(oneHome);
    expect(g2.find((g) => g.label === "RESULT").rows.map((r) => r.key)).toEqual(["wins", "losses", "ties"]);
    const away = g2[0].rows.find((r) => r.key === "away");
    expect(away.games).toBe(0);
    expect(away.cells.every((c) => c === "—")).toBe(true);
  });

  it("season halves split at week 9", () => {
    const halves = buildSplits(player).find((g) => g.label === "SEASON HALF");
    expect(halves.rows.map((r) => [r.label, r.games])).toEqual([["WEEKS 1–9", 2], ["WEEKS 10+", 1]]);
  });

  it("receiver columns and an unsupported position", () => {
    expect(SPLIT_COLUMNS.WR).toBe(SPLIT_COLUMNS.TE);
    const wr = buildSplits(wrSeason());
    expect(wr[0].rows[0].cells).toHaveLength(SPLIT_COLUMNS.WR.length);
    expect(buildSplits(qbSeason({ position: "K" }))).toEqual([]);
  });
});
