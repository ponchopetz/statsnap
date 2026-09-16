import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import App from "../App/App.jsx";
import ErrorBoundary from "../ErrorBoundary/ErrorBoundary.jsx";
import { version } from "../../../package.json";

vi.mock("../../utils/api.js", () => ({
  searchPlayers: vi.fn().mockResolvedValue([]),
  getSchedule: vi.fn().mockResolvedValue({ season: null, week: null, games: [], fetchedAt: null }),
  getPlayerProfile: vi.fn(),
  getLeaderboard: vi.fn(),
  getSeasons: vi.fn().mockResolvedValue({ seasons: [] }),
}));

afterEach(() => vi.restoreAllMocks());

describe("App shell and routing", () => {
  it("renders the header with the package version and the landing page at /", () => {
    render(<MemoryRouter initialEntries={["/"]}><App /></MemoryRouter>);
    expect(screen.getByRole("link", { name: "StatSnap home" })).toHaveAttribute("href", "/");
    expect(screen.getByText(`v${version}`)).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("STAT/SNAP");
  });

  it("unknown routes and unflagged LABS routes fall through to the 404 page", () => {
    const { unmount } = render(<MemoryRouter initialEntries={["/nope"]}><App /></MemoryRouter>);
    expect(screen.getByText("NO ROUTE")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "← BACK TO SEARCH" })).toHaveAttribute("href", "/");
    unmount();
    render(<MemoryRouter initialEntries={["/players/x/card"]}><App /></MemoryRouter>);
    expect(screen.getByText("NO ROUTE")).toBeInTheDocument();
  });
});

describe("ErrorBoundary", () => {
  it("replaces a crashing subtree with the branded panel and logs the error", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const swallow = (e) => e.preventDefault();
    window.addEventListener("error", swallow);
    function Boom() {
      throw new Error("render exploded");
    }
    render(<ErrorBoundary><Boom /></ErrorBoundary>);
    window.removeEventListener("error", swallow);
    expect(screen.getByText("SOMETHING BROKE")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "← BACK TO SEARCH" })).toBeInTheDocument();
    expect(spy).toHaveBeenCalledWith("statsnap: render error", expect.any(Error), expect.anything());
  });

  it("renders children when nothing throws", () => {
    render(<ErrorBoundary><p>fine</p></ErrorBoundary>);
    expect(screen.getByText("fine")).toBeInTheDocument();
  });
});
