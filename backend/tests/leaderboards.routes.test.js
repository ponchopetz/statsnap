import { createRequire } from "node:module";
import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import request from "supertest";
import { startMongo, stopMongo, clearCollections } from "./helpers/mongo.js";
import { makePlayer, makeWeek } from "./helpers/fixtures.js";

const require = createRequire(import.meta.url);
const app = require("../app.js");
const PlayerStats = require("../models/playerStats.js");

beforeAll(startMongo);
afterAll(stopMongo);
beforeEach(clearCollections);

const wr = (id, pct, extra = {}) =>
  makePlayer({ playerId: id, displayName: `Player ${id}`, position: "WR", season: 2024, advanced: pct == null ? undefined : { racr: pct, targetShare: 0.5 }, weeks: [makeWeek({ week: 1, receivingYards: 50 })], ...extra });

describe("GET /leaderboards", () => {
  it("ranks qualified players of one season and position by the stored percentile", async () => {
    await PlayerStats.insertMany([
      wr("low", 0.2),
      wr("top", 0.95),
      wr("mid", 0.6),
      wr("unranked", null),
      wr("other-season", 0.99, { season: 2023 }),
      makePlayer({ playerId: "qb", position: "QB", season: 2024, advanced: { racr: 1 } }),
    ]);

    const res = await request(app).get("/leaderboards?season=2024&position=WR&metric=racr");
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ season: 2024, position: "WR", metric: "racr", count: 3 });
    expect(res.body.rows.map((r) => r.playerId)).toEqual(["top", "mid", "low"]);
    const [top] = res.body.rows;
    expect(top).not.toHaveProperty("_id");
    expect(top.advanced).toEqual({ racr: 0.95, targetShare: 0.5 });
    expect(top.weeks).toHaveLength(1);
  });

  it("honours limit and returns an empty list for an unknown metric", async () => {
    await PlayerStats.insertMany([wr("a", 0.1), wr("b", 0.2), wr("c", 0.3)]);
    const limited = await request(app).get("/leaderboards?season=2024&position=WR&metric=racr&limit=2");
    expect(limited.body.rows).toHaveLength(2);
    const none = await request(app).get("/leaderboards?season=2024&position=WR&metric=nonsense");
    expect(none.status).toBe(200);
    expect(none.body.rows).toEqual([]);
  });

  it.each([
    ["season=abc&position=WR&metric=racr", "season"],
    ["season=2024&position=K&metric=racr", "position"],
    ["season=2024&position=WR&metric=a.b", "metric"],
    ["season=2024&position=WR&metric=racr&limit=1000", "limit"],
    ["season=2024&position=WR&metric=racr&limit=0", "limit"],
    ["season=2024&position=WR&metric=racr&season=2023", "season"],
  ])("rejects %s with a 400 naming %s", async (query, field) => {
    const res = await request(app).get(`/leaderboards?${query}`);
    expect(res.status).toBe(400);
    expect(res.body.message).toContain(field);
  });
});

describe("GET /seasons", () => {
  it("lists distinct loaded seasons newest first, or an empty list", async () => {
    expect((await request(app).get("/seasons")).body).toEqual({ seasons: [] });
    await PlayerStats.insertMany([wr("a", 0.1, { season: 2022 }), wr("b", 0.1, { season: 2024 }), wr("c", 0.1, { season: 2024 })]);
    expect((await request(app).get("/seasons")).body).toEqual({ seasons: [2024, 2022] });
  });
});
