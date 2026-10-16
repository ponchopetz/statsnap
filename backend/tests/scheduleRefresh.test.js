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
// Routed by path: `body`/`ok`/`status` answer /events, `scores` answers /scores.
function stubUpstream({ ok = true, status = 200, body = [], scores = {} } = {}) {
  const respond = (r) => ({
    ok: r.ok,
    status: r.status,
    headers: new Headers({ "x-requests-last": "2", "x-requests-remaining": "498" }),
    json: async () => r.body,
  });
  const fetchMock = vi.fn().mockImplementation(async (url) =>
    url.includes("/scores")
      ? respond({ ok: true, status: 200, body: [], ...scores })
      : respond({ ok, status, body }),
  );
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

const scoresCalls = (fetchMock) => fetchMock.mock.calls.filter(([url]) => url.includes("/scores"));

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
    expect(summary).toEqual({ status: "ok", season: 2026, week: 1, gameCount: 2, scoresFetched: false });

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

  it("re-running for the same week merges into the one document and keeps finished games", async () => {
    stubUpstream({ body: WEEK1 });
    await refreshSchedule();
    const [first] = await Schedule.find({}).lean();

    // Thursday's game is over and has dropped out of the upstream feed.
    stubUpstream({ body: [WEEK1[1]] });
    const summary = await refreshSchedule();

    const docs = await Schedule.find({}).lean();
    expect(docs).toHaveLength(1);
    expect(docs[0]._id.toString()).toBe(first._id.toString());
    expect(docs[0].games.map((g) => g.id)).toEqual(["w1-a", "w1-b"]);
    expect(summary.gameCount).toBe(2);
    expect(docs[0].fetchedAt.getTime()).toBeGreaterThanOrEqual(first.fetchedAt.getTime());
  });

  it("a flexed kickoff from the feed wins, and a stored final score survives the merge", async () => {
    await Schedule.create({
      season: 2026,
      week: 1,
      games: [
        { id: "w1-a", kickoff: "2026-09-10T00:20:00Z", away: "NE", home: "SEA", awayScore: 20, homeScore: 27, completed: true },
        { id: "w1-b", kickoff: "2026-09-13T17:00:00Z", away: "DAL", home: "PHI" },
      ],
      fetchedAt: new Date("2026-09-12T08:00:00Z"),
    });
    // Sunday's game moved from 1:00 to 4:25 ET
    stubUpstream({ body: [event("w1-b", "2026-09-13T20:25:00Z", "Dallas Cowboys", "Philadelphia Eagles")] });

    await refreshSchedule();

    const [doc] = await Schedule.find({}).lean();
    expect(doc.games).toEqual([
      { id: "w1-a", kickoff: "2026-09-10T00:20:00Z", away: "NE", home: "SEA", awayScore: 20, homeScore: 27, completed: true },
      { id: "w1-b", kickoff: "2026-09-13T20:25:00Z", away: "DAL", home: "PHI" },
    ]);
  });

  it("week rollover creates a new document and it becomes the freshest", async () => {
    // Fake only Date (not timers, which the Mongo driver relies on) so the
    // two fetchedAt stamps are a week apart instead of racing within one ms.
    vi.useFakeTimers({ toFake: ["Date"] });
    try {
      vi.setSystemTime(new Date("2026-09-09T08:00:00Z"));
      stubUpstream({ body: WEEK1 });
      await refreshSchedule();

      vi.setSystemTime(new Date("2026-09-16T08:00:00Z"));
      stubUpstream({ body: WEEK2 });
      await refreshSchedule();
    } finally {
      vi.useRealTimers();
    }

    const docs = await Schedule.find({}).sort({ fetchedAt: -1 }).lean();
    expect(docs).toHaveLength(2);
    expect(docs[0].week).toBe(2);
    expect(docs[0].fetchedAt.toISOString()).toBe("2026-09-16T08:00:00.000Z");
  });
});

// The /scores entry for a game; scores arrive as strings keyed by full name
const scoreEvent = (id, completed, away_team, awayScore, home_team, homeScore) => ({
  id,
  completed,
  away_team,
  home_team,
  scores: [
    { name: home_team, score: String(homeScore) },
    { name: away_team, score: String(awayScore) },
  ],
});

const DAL_PHI_FINAL = scoreEvent("w1-b", true, "Dallas Cowboys", 24, "Philadelphia Eagles", 17);

describe("refreshSchedule: final scores", () => {
  // Fake only Date (not timers, which the Mongo driver relies on). WEEK1's
  // DAL @ PHI kicks off 2026-09-13T17:00Z; NE @ SEA is days older.
  beforeEach(() => vi.useFakeTimers({ toFake: ["Date"] }));
  afterEach(() => vi.useRealTimers());

  async function refreshAt(iso) {
    vi.setSystemTime(new Date(iso));
    return refreshSchedule();
  }

  it("under 4h after kickoff: no paid scores call", async () => {
    const fetchMock = stubUpstream({ body: WEEK1, scores: { body: [DAL_PHI_FINAL] } });

    const summary = await refreshAt("2026-09-13T20:30:00Z");

    expect(scoresCalls(fetchMock)).toHaveLength(0);
    expect(summary.scoresFetched).toBe(false);
  });

  it("4h after kickoff: one scores call stores the final on that game only", async () => {
    vi.spyOn(console, "log").mockImplementation(() => {});
    const fetchMock = stubUpstream({ body: WEEK1, scores: { body: [DAL_PHI_FINAL] } });

    const summary = await refreshAt("2026-09-13T21:30:00Z");

    expect(summary.scoresFetched).toBe(true);
    const calls = scoresCalls(fetchMock);
    expect(calls).toHaveLength(1);
    const url = new URL(calls[0][0]);
    expect(url.pathname).toBe("/v4/sports/americanfootball_nfl/scores");
    expect(url.searchParams.get("daysFrom")).toBe("3");

    const [doc] = await Schedule.find({}).lean();
    expect(doc.games[1]).toEqual({
      id: "w1-b", kickoff: "2026-09-13T17:00:00Z", away: "DAL", home: "PHI",
      awayScore: 24, homeScore: 17, completed: true,
    });
    expect(doc.games[0]).not.toHaveProperty("completed");
    expect(doc.scoresFetchedAt.toISOString()).toBe("2026-09-13T21:30:00.000Z");
  });

  it("a game still in progress stores nothing, and the retry waits out the 1h throttle", async () => {
    vi.spyOn(console, "log").mockImplementation(() => {});
    const inProgress = scoreEvent("w1-b", false, "Dallas Cowboys", 24, "Philadelphia Eagles", 24);
    const fetchMock = stubUpstream({ body: WEEK1, scores: { body: [inProgress] } });

    await refreshAt("2026-09-13T21:30:00Z");
    let [doc] = await Schedule.find({}).lean();
    expect(doc.games[1]).not.toHaveProperty("completed");

    await refreshAt("2026-09-13T22:00:00Z");
    expect(scoresCalls(fetchMock)).toHaveLength(1);

    await refreshAt("2026-09-13T22:31:00Z");
    expect(scoresCalls(fetchMock)).toHaveLength(2);
  });

  it("a final already stored is never fetched again", async () => {
    vi.spyOn(console, "log").mockImplementation(() => {});
    const fetchMock = stubUpstream({ body: WEEK1, scores: { body: [DAL_PHI_FINAL] } });

    await refreshAt("2026-09-13T21:30:00Z");
    await refreshAt("2026-09-14T09:00:00Z");

    expect(scoresCalls(fetchMock)).toHaveLength(1);
  });

  it("past the 72h daysFrom window: stops asking for a missing final", async () => {
    const fetchMock = stubUpstream({ body: WEEK1, scores: { body: [DAL_PHI_FINAL] } });

    await refreshAt("2026-09-16T18:00:00Z");

    expect(scoresCalls(fetchMock)).toHaveLength(0);
  });

  it("scores endpoint failure: the events merge is still saved and the throttle is stamped", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    stubUpstream({ body: WEEK1, scores: { ok: false, status: 429 } });

    const summary = await refreshAt("2026-09-13T21:30:00Z");

    expect(summary).toMatchObject({ status: "ok", gameCount: 2, scoresFetched: false });
    expect(warn).toHaveBeenCalledWith("[scheduleRefresh] scores fetch failed:", "Odds API scores responded with 429");
    const [doc] = await Schedule.find({}).lean();
    expect(doc.games.map((g) => g.id)).toEqual(["w1-a", "w1-b"]);
    expect(doc.scoresFetchedAt.toISOString()).toBe("2026-09-13T21:30:00.000Z");
  });
});
