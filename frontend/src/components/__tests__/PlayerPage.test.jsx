import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import PlayerPage from "../PlayerPage/PlayerPage.jsx";
import { qbSeason } from "../../test/fixtures.js";

// The page talks to the API through utils/api.js; mocking that module keeps
// the whole component tree (hooks, tabs, panels) real while removing fetch.
vi.mock("../../utils/api.js", () => ({
  getPlayerProfile: vi.fn(),
  searchPlayers: vi.fn().mockResolvedValue([]),
  getSchedule: vi.fn(),
}));
import { getPlayerProfile } from "../../utils/api.js";

function renderPage(path = "/players/00-0033873") {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/players/:playerId" element={<PlayerPage />} />
      </Routes>
    </MemoryRouter>
  );
}

// A bio cell is a label followed by a value; find the value by its label.
function bioValue(label) {
  const cell = screen.getByText(label, { selector: ".bio-label" }).closest(".bio-cell");
  return within(cell).getByText((_, el) => el.classList.contains("bio-value")).textContent;
}

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  vi.setSystemTime(new Date(2026, 8, 15));
});
afterEach(() => {
  vi.useRealTimers();
  vi.clearAllMocks();
});

describe("PlayerPage loading and error states", () => {
  it("shows the loading state while the profile is in flight", () => {
    getPlayerProfile.mockReturnValue(new Promise(() => {}));
    renderPage();
    expect(screen.getByText("LOADING PLAYER...")).toBeInTheDocument();
  });

  it("maps a 404 to the not-found state with the id", async () => {
    const err = new Error("Player profile failed: 404");
    err.status = 404;
    getPlayerProfile.mockRejectedValue(err);
    renderPage("/players/nobody");
    expect(await screen.findByText("PLAYER NOT FOUND — ID: nobody")).toBeInTheDocument();
  });

  it("shows a generic failure for network and server errors", async () => {
    getPlayerProfile.mockRejectedValue(new Error("Player profile failed: 503"));
    renderPage();
    expect(await screen.findByText(/FAILED TO LOAD PLAYER — Player profile failed: 503/)).toBeInTheDocument();
  });
});

describe("PlayerPage identity block and bio grid", () => {
  it("renders every bio cell from the season document", async () => {
    getPlayerProfile.mockResolvedValue([qbSeason()]);
    renderPage();

    expect(await screen.findByRole("heading", { level: 1 })).toHaveTextContent("PatrickMAHOMES"); // two spans, no separator
    expect(bioValue("AGE")).toBe("30"); // born 1995-09-17, today is 2026-09-15
    expect(bioValue("HT")).toBe(`6'2"`);
    expect(bioValue("WT")).toBe("225");
    expect(bioValue("COLLEGE")).toBe("Texas Tech");
    expect(bioValue("DRAFT")).toBe("2017 · R1 · #10");
    expect(screen.getByText("KC")).toBeInTheDocument();
    expect(screen.getByText("#15")).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "Patrick Mahomes" })).toHaveAttribute("src", "https://example.test/mahomes.png");
  });

  it("renders em dashes and 'Undrafted' when identity fields are missing", async () => {
    getPlayerProfile.mockResolvedValue([
      qbSeason({
        birthDate: null, heightInches: null, weight: null, college: null,
        draftYear: null, draftRound: null, draftPick: null,
        headshotUrl: null, jerseyNumber: null, teamCity: null,
      }),
    ]);
    renderPage();

    await screen.findByRole("heading", { level: 1 });
    expect(bioValue("AGE")).toBe("—");
    expect(bioValue("HT")).toBe("—");
    expect(bioValue("WT")).toBe("—");
    expect(bioValue("COLLEGE")).toBe("—");
    expect(bioValue("DRAFT")).toBe("Undrafted");
    // No headshot: the placeholder shows the team label instead of an <img>.
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
    expect(screen.getByText("PHOTO · KC")).toBeInTheDocument();
  });

  it("selects the season from the URL and falls back to the latest when invalid", async () => {
    getPlayerProfile.mockResolvedValue([
      qbSeason({ season: 2024, team: "KC" }),
      qbSeason({ season: 2023, team: "KC", college: "Older Doc" }),
    ]);
    renderPage("/players/00-0033873?season=2023");
    await screen.findByRole("heading", { level: 1 });
    expect(bioValue("COLLEGE")).toBe("Older Doc");
    expect(screen.getByRole("button", { name: "2023" })).toHaveAttribute("aria-pressed", "true");

    cleanupAndRender("/players/00-0033873?season=1999");
    await screen.findByRole("heading", { level: 1 });
    expect(bioValue("COLLEGE")).toBe("Texas Tech");
  });
});

import { cleanup } from "@testing-library/react";
function cleanupAndRender(path) {
  cleanup();
  renderPage(path);
}
