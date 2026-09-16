import { describe, it, expect } from "vitest";
import { formatExperience } from "../format.js";

/**
 * Regression test for the off-by-one in the bio grid. nflverse `years_exp`
 * (stored as `experience`) counts seasons completed BEFORE the document's
 * season: verified against the 2024 and 2025 roster files, where
 * years_exp == season - entry_year for every row. A rookie is 0, a
 * fourth-season player is 3. The UI must show the season they are IN.
 */
describe("formatExperience", () => {
  it("a rookie (0 prior seasons) reads ROOKIE, never 0 or 1", () => {
    expect(formatExperience(0)).toBe("ROOKIE");
  });

  it("a fourth-season player (3 prior seasons) reads 4TH, not 3", () => {
    expect(formatExperience(3)).toBe("4TH");
  });

  it("a veteran reads the correct ordinal", () => {
    expect(formatExperience(7)).toBe("8TH"); // Mahomes, 2024
    expect(formatExperience(12)).toBe("13TH");
  });

  it("uses English ordinal suffixes including the 11-13 exceptions", () => {
    expect(formatExperience(1)).toBe("2ND");
    expect(formatExperience(2)).toBe("3RD");
    expect(formatExperience(10)).toBe("11TH");
    expect(formatExperience(11)).toBe("12TH");
    expect(formatExperience(12)).toBe("13TH");
    expect(formatExperience(20)).toBe("21ST");
    expect(formatExperience(21)).toBe("22ND");
    expect(formatExperience(22)).toBe("23RD");
  });

  it("returns null for missing or invalid input so the cell shows an em dash", () => {
    expect(formatExperience(null)).toBeNull();
    expect(formatExperience(undefined)).toBeNull();
    expect(formatExperience(-1)).toBeNull();
    expect(formatExperience(2.5)).toBeNull();
    expect(formatExperience("3")).toBeNull();
    expect(formatExperience(NaN)).toBeNull();
  });
});
