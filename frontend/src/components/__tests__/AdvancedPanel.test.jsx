import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import AdvancedPanel from "../AdvancedPanel/AdvancedPanel.jsx";
import { qbSeason, wrSeason } from "../../test/fixtures.js";
import golden from "../../utils/__tests__/golden-season-aggregates.json";

describe("AdvancedPanel states", () => {
  it("complete season below the qualifier: explains the threshold, no bars", () => {
    render(<AdvancedPanel player={qbSeason({ advanced: undefined, seasonComplete: true })} />);
    expect(screen.getByText(/didn't reach the qualifying threshold this season/)).toBeInTheDocument();
    expect(screen.queryByRole("list")).not.toBeInTheDocument();
  });

  it("in-progress season without percentiles: pending message plus raw rows", () => {
    render(<AdvancedPanel player={qbSeason({ advanced: undefined, seasonComplete: false })} />);
    expect(screen.getByText(/Percentile ranks are pending/)).toBeInTheDocument();
    expect(screen.getByText("THROUGH WK 2")).toBeInTheDocument();
    expect(screen.getAllByRole("listitem").length).toBe(golden.positionConfigs.QB.metrics.length);
    expect(screen.getAllByText("—").length).toBeGreaterThan(0);
  });

  it("unsupported position: empty state", () => {
    render(<AdvancedPanel player={qbSeason({ position: "K" })} />);
    expect(screen.getByText("No advanced metrics for this position.")).toBeInTheDocument();
  });

  it("qualified player: percentile label, bar width, and raw value per row", () => {
    const player = wrSeason({ advanced: { targetShare: 0.875, racr: 0.5 } });
    const { container } = render(<AdvancedPanel player={player} />);

    const row = screen.getByText("Target Share").closest("li");
    expect(row).toHaveTextContent("P88");
    expect(row.querySelector(".fill")).toHaveStyle({ width: "87.5%" });
    // Raw value: mean of 0.24 and 0.29 → 26.5%
    expect(row).toHaveTextContent("26.5%");

    // A metric without a percentile still shows its raw value and an em dash.
    const wopr = screen.getByText("WOPR").closest("li");
    expect(wopr).toHaveTextContent("—");
    expect(wopr.querySelector(".fill")).toBeNull();
    expect(container.querySelector(".panel-head-season")).toHaveTextContent("2024 SEASON");
  });

  it("glossary rows toggle open on click and via the KEY button", () => {
    render(<AdvancedPanel player={wrSeason({ advanced: { targetShare: 0.5 } })} />);
    expect(screen.queryByText(/Share of the team's pass attempts/)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Target Share/ }));
    expect(screen.getByText(/Share of the team's pass attempts/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "? KEY" }));
    expect(screen.getByText(/Receiver Air Conversion Ratio/)).toBeInTheDocument();
  });
});

describe("AdvancedPanel agrees with the ETL ranking configuration", () => {
  it("renders one row per Python-ranked metric, in Python's order, for every position", () => {
    for (const [position, config] of Object.entries(golden.positionConfigs)) {
      // Give each metric a distinct percentile so row order is observable.
      const advanced = Object.fromEntries(config.metrics.map((m, i) => [m, (i + 1) / 100]));
      const base = position === "QB" ? qbSeason : wrSeason;
      const { unmount } = render(<AdvancedPanel player={base({ position, advanced })} />);

      const pcts = screen.getAllByRole("listitem").map((li) => li.querySelector(".pct").textContent);
      expect(pcts, position).toEqual(config.metrics.map((_, i) => `P${i + 1}`));
      unmount();
    }
  });

  it("the footnote quotes the same qualifier thresholds the ETL enforces", () => {
    render(<AdvancedPanel player={qbSeason()} />);
    const footnote = screen.getByText(/Percentiles ranked among qualified players/).textContent;
    const { QB, RB, WR, TE } = golden.positionConfigs;
    expect(footnote).toContain(`QB ${QB.qualifierMin}+ att`);
    expect(footnote).toContain(`RB ${RB.qualifierMin}+ car`);
    expect(WR.qualifierMin).toBe(TE.qualifierMin);
    expect(footnote).toContain(`WR/TE ${WR.qualifierMin}+ tgt`);
  });
});
