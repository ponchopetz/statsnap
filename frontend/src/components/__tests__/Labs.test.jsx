import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import FormLine from "../FormLine/FormLine.jsx";
import CareerArc from "../CareerArc/CareerArc.jsx";
import SimilarPlayers from "../SimilarPlayers/SimilarPlayers.jsx";
import { CardSvg } from "../ShareCard/ShareCard.jsx";
import { qbSeason, wrSeason, week } from "../../test/fixtures.js";

vi.mock("../../utils/api.js", () => ({ getSimilarPlayers: vi.fn() }));
import { getSimilarPlayers } from "../../utils/api.js";

afterEach(() => vi.clearAllMocks());

const qbWeeks = (yards) => yards.map((y, i) => week({ week: i + 1, attempts: 30, completions: 20, passingYards: y, passingTds: 1, interceptions: 0, passingEpa: 1 }));

describe("FormLine", () => {
  it("renders one cell per chartable headline stat with a trend tag", () => {
    render(<FormLine player={qbSeason({ weeks: qbWeeks([100, 100, 100, 100, 200, 200, 200, 200]) })} />);
    const cells = document.querySelectorAll(".form-cell");
    expect(cells).toHaveLength(6); // record + five chartable stats, matching the stat row
    expect(cells[0]).toHaveTextContent("RECORD");
    expect(cells[0]).toHaveTextContent("4-0");
    const yds = [...cells].find((c) => c.textContent.includes("PASS YDS"));
    expect(yds).toHaveClass("form-cell--hot");
    expect(yds).toHaveTextContent("200");
    expect(yds).toHaveTextContent("SZN 150");
    expect(screen.getByText("LAST 4 VS SEASON AVG · PER GAME · LABS")).toBeInTheDocument();
  });

  it("explains the minimum games instead of guessing a trend", () => {
    render(<FormLine player={qbSeason({ weeks: qbWeeks([100, 100]) })} />);
    expect(screen.getAllByText("NEED 5+ GP")).toHaveLength(5);
    expect(screen.getByText("LAST 2 VS SEASON AVG · PER GAME · LABS")).toBeInTheDocument();
  });
});

describe("CareerArc", () => {
  const data = [qbSeason({ season: 2024, weeks: qbWeeks([300]) }), qbSeason({ season: 2023, weeks: qbWeeks([200]) })];

  it("plots the primary stat with season and age ticks and switches stat on click", () => {
    render(<CareerArc data={data} />);
    expect(screen.getByRole("button", { name: "PASS YDS" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByText("300 · 2024")).toBeInTheDocument();
    const ticks = document.querySelectorAll(".arc-tick");
    expect(ticks).toHaveLength(2);
    expect(ticks[0]).toHaveTextContent("2023");
    expect(ticks[0]).toHaveTextContent("AGE 27");
    fireEvent.click(screen.getByRole("button", { name: "INT" }));
    expect(screen.getByRole("button", { name: "INT" })).toHaveAttribute("aria-pressed", "true");
  });

  it("percentile mode switches the stat options and shows unranked seasons as gaps", () => {
    const ranked = [
      qbSeason({ season: 2024, advanced: { passingEpa: 0.91 } }),
      qbSeason({ season: 2023, advanced: undefined }),
    ];
    render(<CareerArc data={ranked} />);
    fireEvent.click(screen.getByRole("button", { name: "PERCENTILE" }));
    expect(screen.getByRole("button", { name: "Passing EPA" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByText("P91 · 2024")).toBeInTheDocument();
    expect(screen.getByText("2 · 1 UNRANKED")).toBeInTheDocument();
    expect(screen.getByText(/A SEASON BELOW THE QUALIFIER HAS NO RANK/)).toBeInTheDocument();
    // Switching back remembers the totals selection.
    fireEvent.click(screen.getByRole("button", { name: "TOTALS" }));
    expect(screen.getByRole("button", { name: "PASS YDS" })).toHaveAttribute("aria-pressed", "true");
  });

  it("renders nothing with fewer than two seasons", () => {
    const { container } = render(<CareerArc data={[data[0]]} />);
    expect(container).toBeEmptyDOMElement();
  });
});

describe("SimilarPlayers", () => {
  const wrap = (ui) => render(<MemoryRouter>{ui}</MemoryRouter>);

  it("lists comps linking into Compare", async () => {
    getSimilarPlayers.mockResolvedValue({ qualified: true, similar: [{ playerId: "b", displayName: "Bravo Two", team: "CIN", similarity: 0.917 }] });
    wrap(<SimilarPlayers player={wrSeason()} />);
    const link = await screen.findByRole("link", { name: "Bravo Two" });
    expect(link).toHaveAttribute("href", "/compare?a=00-0036322&b=b&season=2024");
    expect(screen.getByText("92%")).toBeInTheDocument();
  });

  it("explains an unqualified player and hides itself when the API has no route", async () => {
    getSimilarPlayers.mockResolvedValue({ qualified: false, similar: [] });
    const first = wrap(<SimilarPlayers player={wrSeason()} />);
    expect(await screen.findByText(/NO PERCENTILE PROFILE/)).toBeInTheDocument();
    first.unmount();

    const err = new Error("404");
    err.status = 404;
    getSimilarPlayers.mockRejectedValue(err);
    const { container } = wrap(<SimilarPlayers player={wrSeason()} />);
    await vi.waitFor(() => expect(container).toBeEmptyDOMElement());
  });
});

describe("CardSvg", () => {
  it("renders name, season, headline values, and advanced rows as SVG text", () => {
    const player = wrSeason({ advanced: { targetShare: 0.97 } });
    render(<CardSvg player={player} svgRef={{ current: null }} />);
    const svg = screen.getByRole("img", { name: "Justin Jefferson 2024 stat card" });
    expect(within(svg).getByText("JEFFERSON")).toBeInTheDocument();
    expect(within(svg).getByText("2024 SEASON · WR · MIN")).toBeInTheDocument();
    expect(within(svg).getByText("219")).toBeInTheDocument(); // REC YDS 88 + 131
    expect(within(svg).getByText("P97")).toBeInTheDocument();
  });
});
