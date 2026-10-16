import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import ScheduleRail from "../ScheduleRail/ScheduleRail.jsx";

vi.mock("../../utils/api.js", () => ({ getSchedule: vi.fn() }));
import { getSchedule } from "../../utils/api.js";

afterEach(() => {
  vi.clearAllMocks();
  vi.useRealTimers();
});

describe("ScheduleRail degrades instead of erroring", () => {
  it("shows a loading message first", () => {
    getSchedule.mockReturnValue(new Promise(() => {}));
    render(<ScheduleRail />);
    expect(screen.getByText("SCHEDULE · LOADING")).toBeInTheDocument();
  });

  it("cold cache (empty 200): offseason message, no cards", async () => {
    getSchedule.mockResolvedValue({ season: null, week: null, games: [], fetchedAt: null });
    render(<ScheduleRail />);
    expect(await screen.findByText("NO GAMES SCHEDULED · OFFSEASON")).toBeInTheDocument();
    expect(screen.queryByRole("list")).not.toBeInTheDocument();
  });

  it("API failure: a calm unavailable message, nothing thrown", async () => {
    getSchedule.mockRejectedValue(new Error("Schedule fetch failed: 503"));
    render(<ScheduleRail />);
    expect(await screen.findByText("SCHEDULE UNAVAILABLE")).toBeInTheDocument();
  });

  it("warm cache: one card per game with away @ home", async () => {
    getSchedule.mockResolvedValue({
      season: 2026,
      week: 1,
      fetchedAt: "2026-09-09T08:00:00Z",
      games: [
        { id: "a", kickoff: "2026-09-10T00:20:00Z", away: "NE", home: "SEA" },
        { id: "b", kickoff: "2026-09-13T17:00:00Z", away: "DAL", home: "PHI" },
      ],
    });
    render(<ScheduleRail />);
    expect(await screen.findByText("WK 1")).toBeInTheDocument();
    expect(screen.getByText("2 GAMES")).toBeInTheDocument();
    const cards = screen.getAllByRole("listitem");
    expect(cards).toHaveLength(2);
    expect(cards[0]).toHaveTextContent("NE@SEA");
    expect(cards[1]).toHaveTextContent("DAL@PHI");
  });

  it("an aborted request on unmount does not flip to the error state", async () => {
    getSchedule.mockImplementation((signal) =>
      new Promise((_, reject) => signal.addEventListener("abort", () => {
        const err = new Error("aborted");
        err.name = "AbortError";
        reject(err);
      }))
    );
    const { unmount } = render(<ScheduleRail />);
    unmount();
    await Promise.resolve();
    expect(screen.queryByText("SCHEDULE UNAVAILABLE")).not.toBeInTheDocument();
  });
});

describe("ScheduleRail keeps the whole week", () => {
  // Sunday 3:00 PM ET: Thursday is final, the 1:00 game is in progress,
  // the night game has not started.
  const WEEK = {
    season: 2026,
    week: 1,
    fetchedAt: "2026-09-13T18:00:00Z",
    games: [
      { id: "a", kickoff: "2026-09-10T00:20:00Z", away: "NE", home: "SEA", awayScore: 20, homeScore: 27, completed: true },
      { id: "b", kickoff: "2026-09-13T17:00:00Z", away: "DAL", home: "PHI" },
      { id: "c", kickoff: "2026-09-14T00:20:00Z", away: "GB", home: "CHI" },
    ],
  };

  function renderAt(iso, data) {
    // Fake only Date so findBy* polling still runs on real timers
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(iso));
    getSchedule.mockResolvedValue(data);
    render(<ScheduleRail />);
  }

  it("a finished game shows FINAL and the score, with the loser dimmed", async () => {
    renderAt("2026-09-13T19:00:00Z", WEEK);
    const [final] = await screen.findAllByRole("listitem");
    expect(final).toHaveTextContent("FINAL");
    expect(final).toHaveTextContent("20 – 27");
    expect(screen.getByText("NE")).toHaveClass("sched-team--loss");
    expect(screen.getByText("SEA")).not.toHaveClass("sched-team--loss");
  });

  it("a game under 4h past kickoff shows LIVE with no score; a later game keeps its kickoff time", async () => {
    renderAt("2026-09-13T19:00:00Z", WEEK);
    const [, live, upcoming] = await screen.findAllByRole("listitem");
    expect(live).toHaveTextContent("LIVE");
    expect(live.querySelector(".sched-score")).toBeNull();
    expect(upcoming).not.toHaveTextContent(/FINAL|LIVE/);
    expect(screen.getByText("3 GAMES")).toBeInTheDocument();
  });

  it("4h past kickoff with no score still reads FINAL, never an endless LIVE", async () => {
    renderAt("2026-09-13T21:30:00Z", WEEK);
    const [, overdue] = await screen.findAllByRole("listitem");
    expect(overdue).toHaveTextContent("FINAL");
    expect(overdue.querySelector(".sched-score")).toBeNull();
  });
});
