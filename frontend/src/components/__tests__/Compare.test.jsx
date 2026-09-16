import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import { MemoryRouter, Routes, Route, useLocation } from "react-router-dom";
import Compare from "../Compare/Compare.jsx";
import { qbSeason, wrSeason, week } from "../../test/fixtures.js";

vi.mock("../../utils/api.js", () => ({ getPlayerProfile: vi.fn(), searchPlayers: vi.fn().mockResolvedValue([]) }));
import { getPlayerProfile, searchPlayers } from "../../utils/api.js";

afterEach(() => vi.clearAllMocks());

function LocationProbe() {
  const loc = useLocation();
  return <div data-testid="loc">{loc.search}</div>;
}

function renderCompare(search) {
  return render(
    <MemoryRouter initialEntries={[`/compare${search}`]}>
      <Routes>
        <Route path="/compare" element={<><Compare /><LocationProbe /></>} />
      </Routes>
    </MemoryRouter>
  );
}

const jefferson = (season, extra = {}) => wrSeason({ season, ...extra });
const chase = (season, extra = {}) => wrSeason({ playerId: "chase", displayName: "Ja'Marr Chase", team: "CIN", season, ...extra });

describe("Compare page", () => {
  it("empty state invites two picks; picking fills the URL", async () => {
    searchPlayers.mockResolvedValue([{ playerId: "chase", displayName: "Ja'Marr Chase", position: "WR", team: "CIN" }]);
    getPlayerProfile.mockResolvedValue([chase(2024)]);
    renderCompare("");
    expect(screen.getByText("PICK TWO PLAYERS. THE URL IS THE SHARE LINK.")).toBeInTheDocument();
    const [inputA] = screen.getAllByRole("combobox");
    fireEvent.change(inputA, { target: { value: "cha" } });
    fireEvent.click(await screen.findByRole("option", { name: /Chase/ }));
    expect(screen.getByTestId("loc")).toHaveTextContent("?a=chase");
    expect(await screen.findByText("CHASE")).toBeInTheDocument();
  });

  it("compares two same-position players, defaulting to the latest shared season", async () => {
    getPlayerProfile.mockImplementation(async (id) =>
      id === "chase" ? [chase(2024), chase(2023)] : [jefferson(2024), jefferson(2023), jefferson(2022)]
    );
    renderCompare("?a=00-0036322&b=chase");
    expect(await screen.findByText("SEASON · 2024")).toBeInTheDocument();
    expect(screen.getByText("ADVANCED · PERCENTILE VS WRS")).toBeInTheDocument();
    const rows = screen.getAllByRole("listitem");
    expect(rows.length).toBe(6 + 7);
    // Both fixtures are identical seasons: no row has a winner.
    expect(document.querySelectorAll(".cmp-val--win")).toHaveLength(0);
    expect(screen.getAllByRole("combobox")).toHaveLength(2); // the two season selects
  });

  it("per-slot seasons: as/bs override, the header shows both years, and a select updates the URL", async () => {
    getPlayerProfile.mockImplementation(async (id) =>
      id === "chase" ? [chase(2024)] : [jefferson(2024), jefferson(2022, { weeks: [week({ week: 1, targets: 99, receptions: 1, receivingYards: 10 })] })]
    );
    renderCompare("?a=00-0036322&as=2022&b=chase&bs=2024");
    expect(await screen.findByText("SEASON · 2022 VS 2024")).toBeInTheDocument();
    const tgt = screen.getAllByRole("listitem").find((li) => li.textContent.includes("TGT"));
    expect(within(tgt).getByText("99")).toHaveClass("cmp-val--win");

    fireEvent.change(screen.getByLabelText("Season for player A"), { target: { value: "2024" } });
    expect(screen.getByTestId("loc")).toHaveTextContent("as=2024");
  });

  it("mismatched positions show a notice and no rows; swap flips the slots", async () => {
    getPlayerProfile.mockImplementation(async (id) => (id === "qb" ? [qbSeason({ playerId: "qb", season: 2024 })] : [jefferson(2024)]));
    renderCompare("?a=00-0036322&b=qb");
    expect(await screen.findByText(/WR VS QB — PICK TWO PLAYERS AT THE SAME POSITION/)).toBeInTheDocument();
    expect(screen.queryByText(/SEASON · /)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Swap players" }));
    expect(screen.getByTestId("loc")).toHaveTextContent("a=qb");
    expect(screen.getByTestId("loc")).toHaveTextContent("b=00-0036322");
  });

  it("a missing player clears from the slot; copy link writes the URL", async () => {
    const err = new Error("404");
    err.status = 404;
    getPlayerProfile.mockRejectedValue(err);
    const writeText = vi.fn().mockResolvedValue();
    Object.assign(navigator, { clipboard: { writeText } });
    renderCompare("?a=nobody");
    expect(await screen.findByText("PLAYER NOT FOUND")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "COPY LINK" }));
    expect(writeText).toHaveBeenCalledTimes(1);
    expect(await screen.findByRole("button", { name: "✓ COPIED" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "CLEAR" }));
    expect(screen.getByTestId("loc")).not.toHaveTextContent("nobody");
  });
});
