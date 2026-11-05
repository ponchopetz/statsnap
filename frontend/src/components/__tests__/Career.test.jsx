import { describe, it, expect } from "vitest";
import { render, screen, within, fireEvent } from "@testing-library/react";
import Career from "../Career/Career.jsx";
import CareerArc from "../CareerArc/CareerArc.jsx";
import { qbSeason, week } from "../../test/fixtures.js";
import { ADVANCED_CONFIG, groupRows } from "../../utils/stats.js";

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

  describe("career arc stat chips", () => {
    const arcData = () => [qbSeason({ season: 2023 }), qbSeason({ season: 2024 })];
    const statChips = () => within(screen.getByRole("group", { name: "Stat" })).getAllByRole("button");

    it("percentile mode lays chips out under their group labels", () => {
      render(<CareerArc data={arcData()} />);
      fireEvent.click(screen.getByRole("button", { name: "PERCENTILE" }));
      const stat = screen.getByRole("group", { name: "Stat" });
      const groups = groupRows(ADVANCED_CONFIG.QB);
      for (const g of groups) {
        const el = within(stat).getByRole("group", { name: g.group });
        expect(within(el).getByText(g.group)).toBeInTheDocument();
        expect(within(el).getAllByRole("button")).toHaveLength(g.rows.length);
      }
      expect(statChips()).toHaveLength(ADVANCED_CONFIG.QB.length);
    });

    it("totals mode keeps the flat chip row", () => {
      render(<CareerArc data={arcData()} />);
      const stat = screen.getByRole("group", { name: "Stat" });
      expect(within(stat).queryAllByRole("group")).toHaveLength(0);
      expect(statChips().length).toBeGreaterThan(0);
    });

    it("a style stat's summary reads HIGHEST, not BEST", () => {
      render(<CareerArc data={arcData()} />);
      expect(screen.getByText("BEST")).toBeInTheDocument();
      fireEvent.click(screen.getByRole("button", { name: "PERCENTILE" }));
      const style = ADVANCED_CONFIG.QB.find((r) => r.direction === "style");
      const higher = ADVANCED_CONFIG.QB.find((r) => r.direction === "higher");
      fireEvent.click(within(screen.getByRole("group", { name: "Stat" })).getByRole("button", { name: style.label }));
      expect(screen.getByText("HIGHEST")).toBeInTheDocument();
      expect(screen.queryByText("BEST")).not.toBeInTheDocument();
      fireEvent.click(within(screen.getByRole("group", { name: "Stat" })).getByRole("button", { name: higher.label }));
      expect(screen.getByText("BEST")).toBeInTheDocument();
    });
  });
});
