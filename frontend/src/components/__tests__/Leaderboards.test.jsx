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
  it("metric select groups options by section", async () => {
    getSeasons.mockResolvedValue({ seasons: [2025] });
    getLeaderboard.mockResolvedValue({ season: 2025, position: "WR", metric: "racr", count: 0, rows: [] });
    const { container } = renderPage();
    await screen.findByText("NO QUALIFIED WRS FOR 2025 YET");
    const group = container.querySelector('optgroup[label="CHARTING · PFR"]');
    expect(group).not.toBeNull();
    expect(within(group).getByRole("option", { name: "Drop Rate" })).toBeInTheDocument();
  });

  it("new metrics show the stored raw value", async () => {
    getSeasons.mockResolvedValue({ seasons: [2025] });
    getLeaderboard.mockResolvedValue({
      season: 2025, position: "WR", metric: "snapShare", count: 1,
      rows: [wrSeason({ playerId: "a", displayName: "Alpha One", gamesPlayed: 17, advanced: { snapShare: 0.95 }, advancedValues: { snapShare: 0.923 }, weeks: [week({ week: 1 })] })],
    });
    renderPage("/leaderboards?position=WR&metric=snapShare");
    const rows = (await screen.findAllByRole("row")).slice(1);
    expect(rows[0]).toHaveTextContent("92.3%");
  });

  it("a season before the metric's source shows the coverage message", async () => {
    getSeasons.mockResolvedValue({ seasons: [2018, 2017] });
    getLeaderboard.mockResolvedValue({ season: 2017, position: "WR", metric: "dropRate", count: 0, rows: [] });
    renderPage("/leaderboards?position=WR&metric=dropRate&season=2017");
    expect(await screen.findByText("PFR CHARTING STARTS IN 2018")).toBeInTheDocument();
    expect(screen.queryByText(/NO QUALIFIED/)).not.toBeInTheDocument();
  });

  it("the key notes style metrics", async () => {
    getSeasons.mockResolvedValue({ seasons: [2025] });
    getLeaderboard.mockResolvedValue({ season: 2025, position: "WR", metric: "cushion", count: 0, rows: [] });
    renderPage("/leaderboards?position=WR&metric=cushion");
    fireEvent.click(await screen.findByRole("button", { name: "? KEY" }));
    expect(screen.getAllByText(/higher isn't better or worse/, { selector: "dd" })).toHaveLength(1); // the glossary entry; the PCTL row does not repeat it
    expect(screen.getByText(/Rank by value among qualified WRs/)).toBeInTheDocument();
  });

  it("a style metric's bar is neutral and a quality metric's stays lime", async () => {
    getSeasons.mockResolvedValue({ seasons: [2025] });
    getLeaderboard.mockResolvedValue({
      season: 2025, position: "WR", metric: "cushion", count: 1,
      rows: [wrSeason({ playerId: "a", displayName: "Alpha One", gamesPlayed: 17, advanced: { cushion: 0.8 }, advancedValues: { cushion: 6.1 }, weeks: [week({ week: 1 })] })],
    });
    const { container, unmount } = renderPage("/leaderboards?position=WR&metric=cushion");
    await screen.findByText("Alpha One");
    expect(container.querySelector(".lb-fill")).toHaveClass("lb-fill--style");
    unmount();

    getLeaderboard.mockResolvedValue({
      season: 2025, position: "WR", metric: "racr", count: 1,
      rows: [row("a", "Alpha One", 0.97, 17)],
    });
    const second = renderPage();
    await screen.findByText("Alpha One");
    expect(second.container.querySelector(".lb-fill")).not.toHaveClass("lb-fill--style");
  });

  it("switching to a season before the source drops the old header and skips the fetch", async () => {
    getSeasons.mockResolvedValue({ seasons: [2018, 2017] });
    getLeaderboard.mockResolvedValue({
      season: 2018, position: "WR", metric: "dropRate", count: 1,
      rows: [wrSeason({ playerId: "a", displayName: "Alpha One", gamesPlayed: 5, seasonComplete: false, advanced: { dropRate: 0.5 }, advancedValues: { dropRate: 0.04 }, weeks: [week({ week: 5 })] })],
    });
    renderPage("/leaderboards?position=WR&metric=dropRate&season=2018");
    expect(await screen.findByText(/THROUGH WK 5 · TOP 1/)).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("SEASON"), { target: { value: "2017" } });
    expect(await screen.findByText("PFR CHARTING STARTS IN 2018")).toBeInTheDocument();
    expect(screen.queryByText(/TOP \d/)).not.toBeInTheDocument();
    expect(screen.queryByText(/THROUGH WK/)).not.toBeInTheDocument();
    expect(getLeaderboard).not.toHaveBeenCalledWith(expect.objectContaining({ season: 2017 }), expect.anything());
  });
});
