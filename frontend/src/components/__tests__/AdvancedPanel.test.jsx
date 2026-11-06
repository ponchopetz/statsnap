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
    fireEvent.click(screen.getByRole("button", { name: "? KEY" }));
    expect(screen.getAllByRole("listitem").length).toBe(golden.positionConfigs.QB.metrics.length);
    expect(screen.getAllByText("—").length).toBeGreaterThan(0);
  });

  it("unsupported position: empty state", () => {
    render(<AdvancedPanel player={qbSeason({ position: "K" })} />);
    expect(screen.getByText("No advanced metrics for this position.")).toBeInTheDocument();
  });

  it("qualified player: percentile label, bar width, and raw value per row", () => {
    const player = wrSeason({
      advanced: { targetShare: 0.875, racr: 0.5 },
      advancedValues: { targetShare: 0.2787 },
    });
    const { container } = render(<AdvancedPanel player={player} />);

    const row = screen.getByText("Target Share").closest("li");
    expect(row).toHaveTextContent("P88");
    expect(row.querySelector(".fill")).toHaveStyle({ width: "87.5%" });
    // Raw value: the stored season share (ratio-of-sums in the ETL), not the
    // 26.5% mean of the weekly 0.24 and 0.29.
    expect(row).toHaveTextContent("27.9%");
    expect(row).not.toHaveTextContent("26.5%");

    // A metric without a percentile still shows its raw value and an em dash.
    const wopr = screen.getByText("WOPR").closest("li");
    expect(wopr).toHaveTextContent("—");
    expect(wopr.querySelector(".fill")).toBeNull();
    expect(container.querySelector(".panel-head-season")).toHaveTextContent("2024 SEASON");
  });

  it("glossary rows toggle open on click and via the KEY button", () => {
    render(<AdvancedPanel player={wrSeason({ advanced: { targetShare: 0.5 } })} />);
    expect(screen.queryByText(/Share of the team's targets/)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /^Target Share\s*\?/ }));
    expect(screen.getByText(/Share of the team's targets/)).toBeInTheDocument();

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
      fireEvent.click(screen.getByRole("button", { name: "? KEY" }));

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
    expect(footnote).toContain("PFR charting starts in 2018");
  });
});

describe("AdvancedPanel collapsible groups", () => {
  const groupHeads = () =>
    screen.getAllByRole("button").filter((b) => b.classList.contains("adv-group-head"));
  const headFor = (name) => groupHeads().find((b) => b.textContent.includes(name));

  it("first group starts open and the rest collapsed", () => {
    render(<AdvancedPanel player={qbSeason({ advanced: {} })} />);
    const heads = groupHeads();
    expect(heads.map((h) => h.getAttribute("aria-expanded"))).toEqual(
      heads.map((_, i) => (i === 0 ? "true" : "false"))
    );
    expect(heads.length).toBeGreaterThan(1);
    const list = document.getElementById(heads[1].getAttribute("aria-controls"));
    expect(list).toHaveAttribute("hidden");
    expect(document.getElementById(heads[0].getAttribute("aria-controls"))).not.toHaveAttribute("hidden");
  });

  it("clicking a group header toggles it, several can be open", () => {
    render(<AdvancedPanel player={qbSeason({ advanced: {} })} />);
    const pressure = headFor("PRESSURE");
    fireEvent.click(pressure);
    expect(pressure).toHaveAttribute("aria-expanded", "true");
    expect(groupHeads()[0]).toHaveAttribute("aria-expanded", "true");
    fireEvent.click(groupHeads()[0]);
    expect(groupHeads()[0]).toHaveAttribute("aria-expanded", "false");
    expect(pressure).toHaveAttribute("aria-expanded", "true");
  });

  it("? KEY opens every group and definition; turning it off restores the previous open set", () => {
    render(<AdvancedPanel player={qbSeason({ advanced: {} })} />);
    fireEvent.click(screen.getByRole("button", { name: "? KEY" }));
    groupHeads().forEach((h) => expect(h).toHaveAttribute("aria-expanded", "true"));
    expect(document.querySelectorAll(".adv-def").length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole("button", { name: "✕ HIDE KEY" }));
    const heads = groupHeads();
    expect(heads.map((h) => h.getAttribute("aria-expanded"))).toEqual(
      heads.map((_, i) => (i === 0 ? "true" : "false"))
    );
  });

  it("with ? KEY on, a header click leaves KEY and collapses just that group", () => {
    render(<AdvancedPanel player={qbSeason({ advanced: {} })} />);
    fireEvent.click(screen.getByRole("button", { name: "? KEY" }));
    const first = groupHeads()[0];
    fireEvent.click(first);
    expect(first).toHaveAttribute("aria-expanded", "false");
    groupHeads().slice(1).forEach((h) => expect(h).toHaveAttribute("aria-expanded", "true"));
    expect(screen.getByRole("button", { name: "? KEY" })).toBeInTheDocument();
  });

  it("group header names read the count as stats", () => {
    render(<AdvancedPanel player={qbSeason({ advanced: {} })} />);
    expect(groupHeads()[0]).toHaveAccessibleName(/\d+ stats$/);
  });

  it("peek shows the first row that has a value, or —", () => {
    const player = qbSeason({
      advanced: { timeToThrow: 0.824 },
      advancedValues: { timeToThrow: 2.51 },
    });
    render(<AdvancedPanel player={player} />);
    expect(headFor("TRACKING").querySelector(".adv-group-peek")).toHaveTextContent(
      "Time to Throw · 2.51s · P82"
    );
    expect(headFor("EXPECTED POINTS").querySelector(".adv-group-peek")).toHaveTextContent("—");
    expect(headFor("EXPECTED POINTS").querySelector(".adv-group-count")).toHaveTextContent("3");
  });

  it("the peek is hidden from the header button's accessible name", () => {
    render(<AdvancedPanel player={qbSeason({ advanced: { timeToThrow: 0.824 }, advancedValues: { timeToThrow: 2.51 } })} />);
    expect(headFor("TRACKING").querySelector(".adv-group-peek")).toHaveAttribute("aria-hidden", "true");
    expect(screen.getByRole("button", { name: /^TRACKING/ })).not.toHaveAccessibleName(/Time to Throw/);
  });

  it("peek omits the percentile when the row has none", () => {
    const player = qbSeason({ advanced: {}, advancedValues: { timeToThrow: 2.51 } });
    render(<AdvancedPanel player={player} />);
    expect(headFor("TRACKING").querySelector(".adv-group-peek").textContent).toBe(
      "Time to Throw · 2.51s"
    );
  });

  it("style rows draw a neutral bar", () => {
    render(<AdvancedPanel player={qbSeason({ advanced: { timeToThrow: 0.5 } })} />);
    fireEvent.click(headFor("TRACKING"));
    expect(screen.getByText("Time to Throw").closest("li")).toHaveClass("adv-row--style");
    expect(screen.getByText("Passing EPA").closest("li")).not.toHaveClass("adv-row--style");
  });

  it("rows without advancedValues show — for value and percentile", () => {
    render(<AdvancedPanel player={qbSeason({ advanced: {} })} />);
    fireEvent.click(headFor("TRACKING"));
    const row = screen.getByText("Time to Throw").closest("li");
    expect(row.querySelector(".v")).toHaveTextContent("—");
    expect(row.querySelector(".pct")).toHaveTextContent("—");
  });

  it("open state resets when a different player-season loads", () => {
    // PlayerPage keys the panel by player and season; mirror that here.
    const panel = (player) => <AdvancedPanel key={`${player.playerId}-${player.season}`} player={player} />;
    const { rerender } = render(panel(qbSeason({ advanced: {} })));
    fireEvent.click(headFor("PRESSURE"));
    fireEvent.click(groupHeads()[0]);
    expect(headFor("PRESSURE")).toHaveAttribute("aria-expanded", "true");
    rerender(panel(qbSeason({ advanced: {}, season: 2023 })));
    const heads = groupHeads();
    expect(heads.map((h) => h.getAttribute("aria-expanded"))).toEqual(
      heads.map((_, i) => (i === 0 ? "true" : "false"))
    );
  });
});
