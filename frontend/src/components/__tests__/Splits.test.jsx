import { describe, it, expect } from "vitest";
import { render, screen, within } from "@testing-library/react";
import Splits from "../Splits/Splits.jsx";
import { qbSeason, week } from "../../test/fixtures.js";

describe("Splits panel", () => {
  it("renders the baseline row, every group, and the in-progress header", () => {
    const player = qbSeason({
      seasonComplete: false,
      weeks: [
        week({ week: 1, opponent: "DEN", homeAway: "home", result: "W", attempts: 30, completions: 20, passingYards: 300 }),
        week({ week: 5, opponent: "PHI", homeAway: "away", result: "L", attempts: 30, completions: 15, passingYards: 150 }),
      ],
    });
    render(<Splits player={player} />);
    expect(screen.getByText("THROUGH WK 5")).toBeInTheDocument();
    const baseline = screen.getByText("FULL SEASON").closest("tr");
    expect(within(baseline).getAllByRole("cell").map((c) => c.textContent).slice(0, 4)).toEqual(["FULL SEASON", "2", "58.3%", "450"]);
    for (const label of ["VENUE", "RESULT", "OPPONENT", "SEASON HALF"]) expect(screen.getByText(label)).toBeInTheDocument();
    const h2 = screen.getByText("WEEKS 10+").closest("tr");
    expect(h2).toHaveClass("splits-row-empty");
  });

  it("empty state without weeks or for an unsupported position", () => {
    render(<Splits player={qbSeason({ weeks: [] })} />);
    expect(screen.getByText("No splits available.")).toBeInTheDocument();
  });
});
