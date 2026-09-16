import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import ScheduleRail from "../ScheduleRail/ScheduleRail.jsx";

vi.mock("../../utils/api.js", () => ({ getSchedule: vi.fn() }));
import { getSchedule } from "../../utils/api.js";

afterEach(() => vi.clearAllMocks());

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
