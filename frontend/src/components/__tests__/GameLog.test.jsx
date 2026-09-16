import { describe, it, expect } from "vitest";
import { render, screen, within } from "@testing-library/react";
import GameLog from "../GameLog/GameLog.jsx";
import { qbSeason, wrSeason, week } from "../../test/fixtures.js";

const rows = () => screen.getAllByRole("row").slice(1); // drop the header row
const cells = (row) => within(row).getAllByRole("cell").map((c) => c.textContent);

describe("GameLog", () => {
  it("empty state when there are no weeks", () => {
    render(<GameLog player={qbSeason({ weeks: [] })} />);
    expect(screen.getByText("No game log available.")).toBeInTheDocument();
  });

  it("fills interior gaps with DNP rows but never speculates about trailing weeks", () => {
    render(<GameLog player={wrSeason()} />); // weeks 1 and 3, nothing after
    const r = rows();
    expect(r).toHaveLength(3);
    expect(cells(r[1]).slice(0, 3)).toEqual(["2", "—", "DNP"]);
    expect(r[1]).toHaveClass("gamelog-dnp");
    expect(screen.getByText("2 GAMES")).toBeInTheDocument();
  });

  it("renders per-game values with home/away prefix, score, and per-game ratios", () => {
    render(<GameLog player={qbSeason()} />);
    const [w1, w2] = rows();
    expect(cells(w1)).toEqual(["1", "vs DEN", "W 27-20", "20", "30", "66.7%", "250", "2", "0", "2", "+8.40", "—", "21.5"]);
    expect(cells(w2).slice(0, 3)).toEqual(["2", "@ LAC", "L 17-24"]);
    expect(within(w2).getAllByRole("cell")[2]).toHaveClass("loss");
  });

  it("marks overtime and shows an em dash for a zero-attempt game's rate", () => {
    const player = qbSeason({
      weeks: [week({ week: 5, overtime: 1, result: "T", teamScore: 20, opponentScore: 20, attempts: 0, completions: 0 })],
    });
    render(<GameLog player={player} />);
    const c = cells(rows()[0]);
    expect(c[2]).toBe("T 20-20 OT");
    expect(c[5]).toBe("—"); // CMP% with no attempts
  });
});
