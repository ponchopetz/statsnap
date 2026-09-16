import { createRequire } from "node:module";
import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach, vi } from "vitest";
import { startMongo, stopMongo, clearCollections } from "./helpers/mongo.js";

const require = createRequire(import.meta.url);
const { refreshSchedule } = require("../utils/scheduleRefresh.js");
const Schedule = require("../models/schedule.js");

beforeAll(startMongo);
afterAll(stopMongo);
beforeEach(clearCollections);

// The Odds API is stubbed at the fetch boundary so the real client code
// (URL construction, non-2xx handling) is exercised without the network.
function stubUpstream({ ok = true, status = 200, body = [] } = {}) {
  const fetchMock = vi.fn().mockResolvedValue({
    ok,
    status,
    json: async () => body,
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const event = (id, commence_time, away_team, home_team) => ({ id, commence_time, away_team, home_team });

// 2026 Week 1 boundary is Tue 2026-09-08 16:00Z. These fall in weeks 1 and 2.
const WEEK1 = [
  event("w1-a", "2026-09-10T00:20:00Z", "New England Patriots", "Seattle Seahawks"),
  event("w1-b", "2026-09-13T17:00:00Z", "Dallas Cowboys", "Philadelphia Eagles"),
];
const WEEK2 = [event("w2-a", "2026-09-20T17:00:00Z", "Green Bay Packers", "Chicago Bears")];

async function seedGoodCache() {
  await Schedule.create({
    season: 2026,
    week: 1,
    games: [{ id: "existing", kickoff: "2026-09-13T17:00:00Z", away: "DAL", home: "PHI" }],
    fetchedAt: new Date("2026-09-09T08:00:00Z"),
  });
}

describe("refreshSchedule: degraded upstream never damages the cache", () => {
  it("upstream HTTP error: rejects with the status and writes nothing", async () => {
    await seedGoodCache();
    stubUpstream({ ok: false, status: 503 });

    await expect(refreshSchedule()).rejects.toThrow("Odds API responded with 503");

    const docs = await Schedule.find({}).lean();
    expect(docs).toHaveLength(1);
    expect(docs[0].games[0].id).toBe("existing");
  });

  it("upstream network failure: propagates and writes nothing", async () => {
    await seedGoodCache();
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("ECONNRESET")));

    await expect(refreshSchedule()).rejects.toThrow("ECONNRESET");
    expect(await Schedule.countDocuments()).toBe(1);
  });

  it("empty upstream (offseason): reports empty-upstream and keeps the last good slate", async () => {
    await seedGoodCache();
    stubUpstream({ body: [] });

    await expect(refreshSchedule()).resolves.toEqual({ status: "empty-upstream" });
    const [doc] = await Schedule.find({}).lean();
    expect(doc.games.map((g) => g.id)).toEqual(["existing"]);
  });

  it("games outside every known season boundary: no-current-week and no write", async () => {
    await seedGoodCache();
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    // 2024 has no boundary configured; also covers the "new season, config
    // not updated" failure the code warns about.
    stubUpstream({ body: [event("x", "2024-09-08T17:00:00Z", "Dallas Cowboys", "Philadelphia Eagles")] });

    await expect(refreshSchedule()).resolves.toEqual({ status: "no-current-week" });
    expect(await Schedule.countDocuments()).toBe(1);
    expect(errSpy).toHaveBeenCalledWith(expect.stringContaining("SEASON_BOUNDARIES"));
  });

  it("playoff game past week 18: derives null week and does not write", async () => {
    // 2026 boundary + 19 weeks lands in mid-January 2027.
    stubUpstream({ body: [event("po", "2027-01-24T20:00:00Z", "Dallas Cowboys", "Philadelphia Eagles")] });
    vi.spyOn(console, "error").mockImplementation(() => {});

    await expect(refreshSchedule()).resolves.toEqual({ status: "no-current-week" });
    expect(await Schedule.countDocuments()).toBe(0);
  });
});

describe("refreshSchedule: healthy upstream", () => {
  it("calls the events endpoint with the API key and iso dates", async () => {
    const fetchMock = stubUpstream({ body: WEEK1 });
    await refreshSchedule();

    const url = new URL(fetchMock.mock.calls[0][0]);
    expect(url.origin + url.pathname).toBe("https://api.the-odds-api.com/v4/sports/americanfootball_nfl/events");
    expect(url.searchParams.get("apiKey")).toBe("test-key-not-real");
    expect(url.searchParams.get("dateFormat")).toBe("iso");
  });

  it("anchors to the earliest game and stores only that week's games with team codes", async () => {
    stubUpstream({ body: [...WEEK2, ...WEEK1] }); // deliberately unsorted

    const summary = await refreshSchedule();
    expect(summary).toEqual({ status: "ok", season: 2026, week: 1, gameCount: 2 });

    const docs = await Schedule.find({}).lean();
    expect(docs).toHaveLength(1);
    expect(docs[0]).toMatchObject({ season: 2026, week: 1 });
    expect(docs[0].games).toEqual([
      { id: "w1-a", kickoff: "2026-09-10T00:20:00Z", away: "NE", home: "SEA" },
      { id: "w1-b", kickoff: "2026-09-13T17:00:00Z", away: "DAL", home: "PHI" },
    ]);
    expect(docs[0].fetchedAt).toBeInstanceOf(Date);
  });

  it("drops events with an unrecognised team name and keeps the rest", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    stubUpstream({
      body: [
        ...WEEK1,
        event("bad", "2026-09-13T20:00:00Z", "Oakland Raiders", "St. Louis Rams"),
      ],
    });

    const summary = await refreshSchedule();
    expect(summary.gameCount).toBe(2);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("unknown team in event bad"));
  });

  it("re-running for the same week updates the one document instead of duplicating it", async () => {
    stubUpstream({ body: WEEK1 });
    await refreshSchedule();
    const [first] = await Schedule.find({}).lean();

    // Thursday's game has kicked off and dropped out of the upstream feed.
    stubUpstream({ body: [WEEK1[1]] });
    await refreshSchedule();

    const docs = await Schedule.find({}).lean();
    expect(docs).toHaveLength(1);
    expect(docs[0]._id.toString()).toBe(first._id.toString());
    expect(docs[0].games.map((g) => g.id)).toEqual(["w1-b"]);
    expect(docs[0].fetchedAt.getTime()).toBeGreaterThanOrEqual(first.fetchedAt.getTime());
  });

  it("week rollover creates a new document and it becomes the freshest", async () => {
    stubUpstream({ body: WEEK1 });
    await refreshSchedule();
    stubUpstream({ body: WEEK2 });
    await refreshSchedule();

    const docs = await Schedule.find({}).sort({ fetchedAt: -1 }).lean();
    expect(docs).toHaveLength(2);
    expect(docs[0].week).toBe(2);
  });
});
