import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import Overview from "../Overview/Overview.jsx";
import { HEADLINE_CONFIG } from "../../utils/headline.js";
import { qbSeason, wrSeason, week } from "../../test/fixtures.js";

const cellLabels = () => [...document.querySelectorAll(".stat-cell-label")].map((el) => el.textContent);
const cellValues = () => [...document.querySelectorAll(".stat-cell-value")].map((el) => el.textContent);

describe("Overview", () => {
  it("renders the headline row from HEADLINE_CONFIG for each position", () => {
    for (const [position, base] of [["QB", qbSeason], ["RB", wrSeason], ["WR", wrSeason], ["TE", wrSeason]]) {
      const player = base({ position });
      const { unmount } = render(<Overview player={player} />);
      expect(cellLabels(), position).toEqual(HEADLINE_CONFIG[position].map((r) => r.label));
      expect(cellValues(), position).toEqual(HEADLINE_CONFIG[position].map((r) => r.format(r.value(player.weeks, player))));
      unmount();
    }
  });

  it("selects the primary stat by default and swaps the sparkline on click", () => {
    render(<Overview player={qbSeason()} />);
    expect(screen.getByRole("heading", { level: 2, name: "PASS YDS" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /INT/ }));
    expect(screen.getByRole("heading", { level: 2, name: "INT" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /PASS EPA/ }));
    expect(screen.getByText("AVG/GM")).toBeInTheDocument();
  });

  it("GP is not a button and renders nothing for an unsupported position", () => {
    render(<Overview player={qbSeason({ weeks: [week({ attempts: 1, completions: 1 })] })} />);
    expect(screen.queryByRole("button", { name: /^GP/ })).not.toBeInTheDocument();
    const { container } = render(<Overview player={qbSeason({ position: "K" })} />);
    expect(container.querySelector(".overview")).toBeNull();
  });
});
