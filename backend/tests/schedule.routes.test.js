import { createRequire } from "node:module";
import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import request from "supertest";
import { startMongo, stopMongo, clearCollections } from "./helpers/mongo.js";

const require = createRequire(import.meta.url);
const app = require("../app.js");
const Schedule = require("../models/schedule.js");

beforeAll(startMongo);
afterAll(stopMongo);
beforeEach(clearCollections);

const game = (id, kickoff = "2026-09-13T17:00:00Z") => ({ id, kickoff, away: "DAL", home: "PHI" });

describe("GET /schedule", () => {
  it("cold cache: returns 200 with the empty offseason shape, never a 404", async () => {
    const res = await request(app).get("/schedule");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ season: null, week: null, games: [], fetchedAt: null });
  });

  it("serves the most recently fetched document, not the highest week", async () => {
    await Schedule.insertMany([
      { season: 2026, week: 2, games: [game("stale")], fetchedAt: new Date("2026-09-10T08:00:00Z") },
      { season: 2026, week: 1, games: [game("fresh")], fetchedAt: new Date("2026-09-11T08:00:00Z") },
    ]);

    const res = await request(app).get("/schedule");
    expect(res.status).toBe(200);
    expect(res.body.week).toBe(1);
    expect(res.body.games.map((g) => g.id)).toEqual(["fresh"]);
  });

  it("stale cache: an old document is still served rather than erroring", async () => {
    // Nothing on the read path checks age. A cache that is weeks old (the
    // cron has been failing, or the host slept) still returns its last good
    // slate. Degrading to stale data is the documented behaviour.
    await Schedule.insertMany([
      { season: 2025, week: 18, games: [game("old", "2026-01-04T18:00:00Z")], fetchedAt: new Date("2026-01-01T08:00:00Z") },
    ]);

    const res = await request(app).get("/schedule");
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ season: 2025, week: 18 });
    expect(res.body.games).toHaveLength(1);
  });

  it("strips Mongo internals from the response", async () => {
    await Schedule.create({ season: 2026, week: 1, games: [game("a")], fetchedAt: new Date() });

    const res = await request(app).get("/schedule");
    expect(Object.keys(res.body).sort()).toEqual(["fetchedAt", "games", "season", "week"]);
    expect(res.body.games[0]).toEqual(game("a"));
  });
});
