import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import Leaderboards from "../Leaderboards/Leaderboards.jsx";
import { wrSeason, week } from "../../test/fixtures.js";

vi.mock("../../utils/api.js", () => ({ getLeaderboard: vi.fn(), getSeasons: vi.fn() }));
import { getLeaderboard, getSeasons } from "../../utils/api.js";

afterEach(() => vi.clearAllMocks());

const row = (id, name, pct, gp) =>
  wrSeason({ playerId: id, displayName: name, gamesPlayed: gp, advanced: { racr: pct }, weeks: Array.from({ length: gp }, (_, i) => week({ week: i + 1, receivingYards: 50, receivingAirYards: 40 })) });

function renderPage(path = "/leaderboards?position=WR&metric=racr") {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Leaderboards />
    </MemoryRouter>
  );
}

describe("Leaderboards", () => {
  it("defaults to the newest loaded season and ranks rows with percentile and raw value", async () => {
    getSeasons.mockResolvedValue({ seasons: [2025, 2024] });
    getLeaderboard.mockResolvedValue({ season: 2025, position: "WR", metric: "racr", count: 2, rows: [row("a", "Alpha One", 0.97, 17), row("b", "Bravo Two", 0.9, 5)] });
    renderPage();

    const rows = (await screen.findAllByRole("row")).slice(1);
    expect(getLeaderboard).toHaveBeenCalledWith(expect.objectContaining({ season: 2025, position: "WR", metric: "racr" }), expect.anything());
    expect(rows).toHaveLength(2);
    expect(within(rows[0]).getByText("Alpha One")).toBeInTheDocument();
    expect(rows[0]).toHaveTextContent("P97");
    expect(rows[0]).toHaveTextContent("1.25"); // 50/40 per week, ratio of sums
    expect(screen.getByText("2025 SEASON · TOP 2")).toBeInTheDocument();
  });

  it("min games filter hides short seasons and explains an empty result", async () => {
    getSeasons.mockResolvedValue({ seasons: [2025] });
    getLeaderboard.mockResolvedValue({ season: 2025, position: "WR", metric: "racr", count: 2, rows: [row("a", "Alpha One", 0.97, 17), row("b", "Bravo Two", 0.9, 5)] });
    renderPage("/leaderboards?position=WR&metric=racr&minGames=10");
    const rows = (await screen.findAllByRole("row")).slice(1);
    expect(rows).toHaveLength(1);

    fireEvent.change(screen.getByLabelText("MIN GP"), { target: { value: "14" } });
    expect(await screen.findAllByRole("row")).toHaveLength(2); // header + Alpha
  });

  it("explains an empty database instead of loading forever", async () => {
    getSeasons.mockResolvedValue({ seasons: [] });
    renderPage();
    expect(await screen.findByText("NO SEASONS LOADED ON THIS API YET")).toBeInTheDocument();
    expect(getLeaderboard).not.toHaveBeenCalled();
  });

  it("tells the user when the API has no leaderboards route", async () => {
    getSeasons.mockResolvedValue({ seasons: [2025] });
    const err = new Error("Leaderboard fetch failed: 404");
    err.status = 404;
    getLeaderboard.mockRejectedValue(err);
    renderPage();
    expect(await screen.findByText(/NOT AVAILABLE ON THIS API/)).toBeInTheDocument();
  });

  it("switching position resets the metric to that position's first ranked metric", async () => {
    getSeasons.mockResolvedValue({ seasons: [2025] });
    getLeaderboard.mockResolvedValue({ season: 2025, position: "RB", metric: "rushingEpa", count: 0, rows: [] });
    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: "RB" }));
    expect(await screen.findByText("NO QUALIFIED RBS FOR 2025 YET")).toBeInTheDocument();
    expect(getLeaderboard).toHaveBeenLastCalledWith(expect.objectContaining({ position: "RB", metric: "rushingEpa" }), expect.anything());
  });
});
