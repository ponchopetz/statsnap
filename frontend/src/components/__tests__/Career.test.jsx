import { describe, it, expect } from "vitest";
import { render, screen, within } from "@testing-library/react";
import Career from "../Career/Career.jsx";
import { qbSeason, week } from "../../test/fixtures.js";

const rowByLabel = (label) => screen.getByText(label, { selector: "td" }).closest("tr");
const cells = (row) => within(row).getAllByRole("cell").map((c) => c.textContent);

describe("Career", () => {
  it("empty state for no data or an unsupported position", () => {
    render(<Career data={[]} />);
    expect(screen.getByText("No career data available.")).toBeInTheDocument();
  });

  it("a single season gets no CAREER totals row", () => {
    render(<Career data={[qbSeason()]} />);
    expect(screen.getByText("1 SEASON")).toBeInTheDocument();
    expect(screen.queryByText("CAREER", { selector: "td" })).not.toBeInTheDocument();
    expect(screen.getAllByRole("row")).toHaveLength(2); // header + one season
  });

  it("career rates are ratio-of-sums across seasons, not the mean of season rates", () => {
    const s2023 = qbSeason({ season: 2023, team: "KC", weeks: [week({ week: 1, attempts: 10, completions: 7, passingYards: 100, passingTds: 1, interceptions: 0, passingEpa: 5 })] });
    const s2024 = qbSeason({ season: 2024, team: "KC", weeks: [week({ week: 1, attempts: 90, completions: 45, passingYards: 900, passingTds: 9, interceptions: 3, passingEpa: 4 })] });
    render(<Career data={[s2024, s2023]} />); // API order: most recent first

    // Seasons render oldest → newest, then the totals row.
    const bodyRows = screen.getAllByRole("row").slice(1);
    expect(bodyRows.map((r) => cells(r)[0])).toEqual(["2023", "2024", "CAREER"]);

    expect(cells(rowByLabel("2023"))).toEqual(["2023", "KC", "1", "70.0%", "100", "1", "0", "+0.5"]);
    const career = cells(rowByLabel("CAREER"));
    // CMP% = 52/100 (attempt-weighted), NOT (70% + 50%) / 2 = 60%.
    // PASS EPA = 9 / 100 attempts = +0.1, NOT the mean of +0.5 and +0.04.
    expect(career).toEqual(["CAREER", "—", "2", "52.0%", "1,000", "10", "3", "+0.1"]);
    expect(rowByLabel("CAREER")).toHaveClass("career-row-total");
  });
});
