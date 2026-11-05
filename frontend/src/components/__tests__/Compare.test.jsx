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
    expect(rows.length).toBe(6 + 4); // advanced groups start collapsed except the first (USAGE, 4 rows)
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

  describe("advanced groups", () => {
    const pair = (a, b) =>
      getPlayerProfile.mockImplementation(async (id) => (id === "chase" ? [a] : [b]));
    const headerFor = (name) => screen.getByRole("button", { name: new RegExp(name) });

    it("advanced rows are grouped with the first group open", async () => {
      pair(chase(2024), jefferson(2024));
      renderCompare("?a=00-0036322&b=chase");
      await screen.findByText("SEASON · 2024");
      const heads = document.querySelectorAll(".cmp-group-head");
      expect(heads.length).toBeGreaterThan(1);
      expect(heads[0]).toHaveAttribute("aria-expanded", "true");
      expect(heads[1]).toHaveAttribute("aria-expanded", "false");
      expect(heads[0]).toHaveAttribute("aria-controls", document.querySelector(".cmp-group ul").id);
      expect(document.querySelectorAll(".cmp-group ul[hidden]").length).toBe(heads.length - 1);

      fireEvent.click(heads[1]);
      expect(heads[0]).toHaveAttribute("aria-expanded", "true");
      expect(heads[1]).toHaveAttribute("aria-expanded", "true");
      fireEvent.click(heads[0]);
      expect(heads[0]).toHaveAttribute("aria-expanded", "false");
    });

    it("group header shows the win tally", async () => {
      const adv = (o) => ({ advanced: o });
      pair(
        chase(2024, adv({ targetShare: 0.9, wopr: 0.8, airYardsShare: 0.2 })),
        jefferson(2024, adv({ targetShare: 0.5, wopr: 0.1, airYardsShare: 0.7 }))
      );
      renderCompare("?a=chase&b=00-0036322");
      await screen.findByText("SEASON · 2024");
      const head = headerFor("USAGE");
      expect(within(head).getByText("A 2 · B 1")).toHaveClass("cmp-group-tally");
      expect(head.querySelector(".cmp-group-tally")).not.toHaveAttribute("aria-hidden");
    });

    it("style rows show values without a win highlight", async () => {
      pair(
        chase(2024, { advanced: { cushion: 0.9 }, advancedValues: { cushion: 6.1 } }),
        jefferson(2024, { advanced: { cushion: 0.1 }, advancedValues: { cushion: 4.2 } })
      );
      renderCompare("?a=chase&b=00-0036322");
      await screen.findByText("SEASON · 2024");
      fireEvent.click(headerFor("TRACKING"));
      const li = screen.getAllByRole("listitem").find((x) => x.textContent.includes("Avg Cushion"));
      expect(li).toHaveTextContent("6.10");
      expect(li).toHaveTextContent("4.20");
      expect(li.querySelector(".cmp-val--win")).toBeNull();
      expect(li.querySelector(".cmp-fill--win")).toBeNull();
    });

    it("a 2017 side shows — on PFR rows", async () => {
      pair(chase(2017), jefferson(2024, { advancedValues: { dropRate: 0.05 }, advanced: { dropRate: 0.6 } }));
      renderCompare("?a=chase&b=00-0036322&as=2017&bs=2024");
      await screen.findByText("SEASON · 2017 VS 2024");
      fireEvent.click(headerFor("CHARTING"));
      const li = screen.getAllByRole("listitem").find((x) => x.textContent.includes("Drop Rate"));
      expect(li.querySelector(".cmp-val")).toHaveTextContent("—");
    });

    it("the footnote says style stats have no winner", async () => {
      pair(chase(2024), jefferson(2024));
      renderCompare("?a=chase&b=00-0036322");
      await screen.findByText("SEASON · 2024");
      const note = document.querySelector(".cmp-footnote");
      expect(note).toHaveTextContent(/STYLE STATS .* HAVE NO WINNER/);
      expect(note).not.toHaveTextContent(/RANKED INVERTED BY THE ETL/);
      expect(note.textContent).not.toContain("--");
    });

    it("open state resets when a season changes", async () => {
      getPlayerProfile.mockImplementation(async (id) => (id === "chase" ? [chase(2024), chase(2023)] : [jefferson(2024), jefferson(2023)]));
      renderCompare("?a=00-0036322&b=chase&season=2024");
      await screen.findByText("SEASON · 2024");
      fireEvent.click(document.querySelectorAll(".cmp-group-head")[1]);
      expect(document.querySelectorAll(".cmp-group-head")[1]).toHaveAttribute("aria-expanded", "true");
      fireEvent.change(screen.getByLabelText("Season for player A"), { target: { value: "2023" } });
      await screen.findByText("SEASON · 2023 VS 2024");
      expect(document.querySelectorAll(".cmp-group-head")[1]).toHaveAttribute("aria-expanded", "false");
      expect(document.querySelectorAll(".cmp-group-head")[0]).toHaveAttribute("aria-expanded", "true");
    });
  });
});
