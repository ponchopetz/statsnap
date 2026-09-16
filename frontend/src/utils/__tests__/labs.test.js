import { describe, it, expect } from "vitest";
import { buildForm, formRecord, FORM_WINDOW } from "../form.js";
import { ageInSeason, arcOptions, buildCareerArc } from "../careerArc.js";
import { qbSeason, week } from "../../test/fixtures.js";

const qbWeeks = (yards) => yards.map((y, i) => week({ week: i + 1, attempts: 30, completions: 20, passingYards: y, passingTds: 1, interceptions: 0, passingEpa: 1 }));

describe("buildForm", () => {
  it("compares the last four games to the season and tags hot/cold by direction", () => {
    const player = qbSeason({ weeks: qbWeeks([100, 100, 100, 100, 200, 200, 200, 200]).map((w, i) => ({ ...w, interceptions: i < 4 ? 0 : 2 })) });
    const rows = buildForm(player);
    const yds = rows.find((r) => r.key === "passingYards");
    expect(yds.recent).toBe(200);
    expect(yds.season).toBe(150);
    expect(yds.delta).toBeCloseTo(1 / 3, 10);
    expect(yds.trend).toBe("hot");
    // More interceptions lately is cold, not hot.
    expect(rows.find((r) => r.key === "interceptions").trend).toBe("cold");
    // Flat stat is even.
    expect(rows.find((r) => r.key === "passingTds").trend).toBe("even");
  });

  it("gives no trend with too few games and handles all-null series", () => {
    const short = buildForm(qbSeason({ weeks: qbWeeks([100, 100, 100, 100]) }));
    expect(short.every((r) => r.trend === null)).toBe(true);
    expect(short.find((r) => r.key === "passingYards").recent).toBe(100);

    const nulls = buildForm(qbSeason({ weeks: Array.from({ length: FORM_WINDOW + 2 }, (_, i) => week({ week: i + 1 })) }));
    const cmp = nulls.find((r) => r.key === "completionPct");
    expect(cmp.season).toBeNull();
    expect(cmp.trend).toBeNull();
  });

  it("returns [] for an unsupported position", () => {
    expect(buildForm({ position: "K", weeks: [] })).toEqual([]);
  });

  it("formRecord tallies the last window and the season, showing ties only when present", () => {
    const weeks = ["W", "L", "W", "W", "T", "L"].map((result, i) => week({ week: i + 1, result }));
    expect(formRecord({ weeks })).toEqual({ recent: "2-1-1", season: "3-2-1" });
    expect(formRecord({ weeks: weeks.slice(0, 4) })).toEqual({ recent: "3-1", season: "3-1" });
    expect(formRecord({})).toEqual({ recent: "0-0", season: "0-0" });
  });
});

describe("career arc", () => {
  it("ages on 1 September of the season", () => {
    expect(ageInSeason("1995-09-17", 2024)).toBe(28); // birthday after 1 Sep
    expect(ageInSeason("1995-08-17", 2024)).toBe(29);
    expect(ageInSeason("1995-09-01", 2024)).toBe(29);
    expect(ageInSeason(null, 2024)).toBeNull();
  });

  it("builds oldest-first points for the chosen stat and falls back to the first option", () => {
    const seasons = [
      qbSeason({ season: 2024, weeks: qbWeeks([300, 300]) }),
      qbSeason({ season: 2022, weeks: qbWeeks([100]) }),
      qbSeason({ season: 2023, weeks: qbWeeks([200, 200, 200]) }),
    ];
    const { points, row } = buildCareerArc(seasons, "passingYards");
    expect(row.key).toBe("passingYards");
    expect(points.map((p) => [p.season, p.value, p.age])).toEqual([[2022, 100, 26], [2023, 600, 27], [2024, 600, 28]]);

    expect(buildCareerArc(seasons, "nope").row.key).toBe(arcOptions("QB")[0].key);
    expect(buildCareerArc([], "passingYards")).toEqual({ points: [], row: null });
  });
});
