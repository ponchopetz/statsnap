import { describe, it, expect, vi, afterEach } from "vitest";
import { searchPlayers, getPlayerProfile, getSchedule, getLeaderboard, getSeasons, getSimilarPlayers } from "../api.js";
import { API_BASE_URL } from "../constants.js";

function stubFetch(status, body) {
  const fetchMock = vi.fn().mockResolvedValue({ ok: status >= 200 && status < 300, status, json: async () => body });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

afterEach(() => vi.unstubAllGlobals());

describe("api client", () => {
  it("encodes the search query and passes the abort signal", async () => {
    const fetchMock = stubFetch(200, []);
    const controller = new AbortController();
    await searchPlayers("a.j. brown", controller.signal);
    expect(fetchMock).toHaveBeenCalledWith(`${API_BASE_URL}/players/search?q=a.j.%20brown`, { signal: controller.signal });
  });

  it("attaches the HTTP status to profile errors so 404 can mean not-found", async () => {
    stubFetch(404, { message: "Player not found" });
    await expect(getPlayerProfile("x")).rejects.toMatchObject({ status: 404, message: "Player profile failed: 404" });
  });

  it("returns parsed JSON on success for every endpoint", async () => {
    stubFetch(200, { ok: true });
    expect(await getSchedule()).toEqual({ ok: true });
    expect(await getSeasons()).toEqual({ ok: true });
    expect(await getSimilarPlayers("00-1", 2024)).toEqual({ ok: true });
    expect(await getLeaderboard({ season: 2024, position: "WR", metric: "racr" })).toEqual({ ok: true });
  });

  it("builds the leaderboard query with a default limit and rejects non-2xx with the status", async () => {
    const fetchMock = stubFetch(503, {});
    await expect(getLeaderboard({ season: 2024, position: "WR", metric: "racr" })).rejects.toMatchObject({ status: 503 });
    const url = new URL(fetchMock.mock.calls[0][0]);
    expect(url.pathname).toBe("/leaderboards");
    expect(Object.fromEntries(url.searchParams)).toEqual({ season: "2024", position: "WR", metric: "racr", limit: "25" });
  });

  it("schedule and search throw on non-2xx", async () => {
    stubFetch(500, {});
    await expect(getSchedule()).rejects.toThrow("Schedule fetch failed: 500");
    await expect(searchPlayers("x")).rejects.toThrow("Player search failed: 500");
    await expect(getSimilarPlayers("x", 2024)).rejects.toMatchObject({ status: 500 });
    await expect(getSeasons()).rejects.toMatchObject({ status: 500 });
  });
});
