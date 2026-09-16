import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter, Routes, Route, useLocation } from "react-router-dom";
import Landing from "../Landing/Landing.jsx";
import { FLAGS_STORAGE_KEY } from "../../utils/flags.js";

vi.mock("../../utils/api.js", () => ({
  searchPlayers: vi.fn().mockResolvedValue([]),
  getSchedule: vi.fn().mockResolvedValue({ season: null, week: null, games: [], fetchedAt: null }),
}));
import { searchPlayers } from "../../utils/api.js";

const RECENTS_KEY = "statsnap:recents";
const mahomes = { playerId: "00-0033873", displayName: "Patrick Mahomes", position: "QB", team: "KC" };

function LocationProbe() {
  const loc = useLocation();
  return <div data-testid="loc">{loc.pathname}{loc.search}</div>;
}

function renderLanding(path = "/") {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/" element={<><Landing /><LocationProbe /></>} />
        <Route path="/players/:playerId" element={<LocationProbe />} />
      </Routes>
    </MemoryRouter>
  );
}

beforeEach(() => window.localStorage.clear());
afterEach(() => vi.clearAllMocks());

describe("Landing", () => {
  it("renders the wordmark, tools nav, and no LABS row by default", () => {
    renderLanding();
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("STAT/SNAP");
    expect(screen.getByRole("link", { name: "COMPARE" })).toHaveAttribute("href", "/compare");
    expect(screen.getByRole("link", { name: "LEADERBOARDS" })).toHaveAttribute("href", "/leaderboards");
    expect(screen.queryByText("LABS")).not.toBeInTheDocument();
    expect(screen.queryByRole("list")).not.toBeInTheDocument(); // no recents yet
  });

  it("lists enabled LABS flags as tags", () => {
    window.localStorage.setItem(FLAGS_STORAGE_KEY, JSON.stringify({ form: true }));
    renderLanding();
    expect(screen.getByText("LABS")).toBeInTheDocument();
    expect(screen.getByText("FORM LINE")).toBeInTheDocument();
    expect(screen.queryByText("CAREER ARC")).not.toBeInTheDocument();
  });

  it("prefills the search from ?q= and mirrors typing back into the URL", async () => {
    renderLanding("/?q=mah");
    expect(screen.getByRole("combobox")).toHaveValue("mah");
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "jeff" } });
    expect(screen.getByTestId("loc")).toHaveTextContent("/?q=jeff");
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "" } });
    expect(screen.getByTestId("loc")).toHaveTextContent(/^\/$/);
  });

  it("selecting a player navigates and stores it at the front of recents, capped at five", async () => {
    window.localStorage.setItem(RECENTS_KEY, JSON.stringify([
      { playerId: "p1", displayName: "One" }, { playerId: "p2", displayName: "Two" },
      { playerId: "p3", displayName: "Three" }, { playerId: "p4", displayName: "Four" },
      { playerId: "p5", displayName: "Five" },
    ]));
    searchPlayers.mockResolvedValue([mahomes]);
    renderLanding();
    expect(screen.getAllByRole("listitem")).toHaveLength(5);

    fireEvent.change(screen.getByRole("combobox"), { target: { value: "mah" } });
    fireEvent.click(await screen.findByRole("option", { name: /Patrick Mahomes/ }));

    expect(screen.getByTestId("loc")).toHaveTextContent("/players/00-0033873");
    const stored = JSON.parse(window.localStorage.getItem(RECENTS_KEY));
    expect(stored.map((p) => p.playerId)).toEqual(["00-0033873", "p1", "p2", "p3", "p4"]);
  });

  it("a recent chip navigates and moves that player to the front", () => {
    window.localStorage.setItem(RECENTS_KEY, JSON.stringify([{ playerId: "p1", displayName: "One" }, mahomes]));
    renderLanding();
    fireEvent.click(screen.getByRole("button", { name: "← PATRICK MAHOMES" }));
    expect(screen.getByTestId("loc")).toHaveTextContent("/players/00-0033873");
    expect(JSON.parse(window.localStorage.getItem(RECENTS_KEY))[0].playerId).toBe("00-0033873");
  });

  it("survives malformed recents in storage", () => {
    window.localStorage.setItem(RECENTS_KEY, "{not json");
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    renderLanding();
    expect(screen.getByRole("heading", { level: 1 })).toBeInTheDocument();
    warn.mockRestore();
  });
});
