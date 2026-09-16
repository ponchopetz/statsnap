import { createRequire } from "node:module";
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
import request from "supertest";
import { startMongo, stopMongo, clearCollections } from "./helpers/mongo.js";
import { makePlayer, makeWeek } from "./helpers/fixtures.js";

const require = createRequire(import.meta.url);
const app = require("../app.js");
const PlayerStats = require("../models/playerStats.js");

beforeAll(startMongo);
afterAll(stopMongo);
beforeEach(clearCollections);

describe("GET /players/search", () => {
  it("returns 400 when q is missing or blank", async () => {
    const missing = await request(app).get("/players/search");
    expect(missing.status).toBe(400);
    expect(missing.body).toEqual({ message: "Query parameter q is required" });

    const blank = await request(app).get("/players/search?q=%20%20");
    expect(blank.status).toBe(400);
  });

  it("matches at word boundaries, case-insensitively, and returns the projected shape", async () => {
    await PlayerStats.insertMany([
      makePlayer({ playerId: "mahomes", displayName: "Patrick Mahomes", team: "KC" }),
      makePlayer({ playerId: "jefferson", displayName: "Justin Jefferson", position: "WR", team: "MIN" }),
    ]);

    const byLastName = await request(app).get("/players/search?q=MAH");
    expect(byLastName.status).toBe(200);
    expect(byLastName.body).toEqual([
      { playerId: "mahomes", displayName: "Patrick Mahomes", position: "QB", team: "KC" },
    ]);

    // "aho" sits mid-word in Mahomes; the \b anchor must reject it.
    const midWord = await request(app).get("/players/search?q=aho");
    expect(midWord.status).toBe(200);
    expect(midWord.body).toEqual([]);
  });

  it("treats regex metacharacters in q as literal text", async () => {
    await PlayerStats.insertMany([
      makePlayer({ displayName: "Patrick Mahomes" }),
      makePlayer({ displayName: "A.J. Brown", position: "WR" }),
    ]);

    // Unescaped, "(" is a MongoDB regex syntax error (500) and ".*" matches everyone.
    const paren = await request(app).get("/players/search?q=(");
    expect(paren.status).toBe(200);
    expect(paren.body).toEqual([]);

    const wildcard = await request(app).get("/players/search?q=.*");
    expect(wildcard.status).toBe(200);
    expect(wildcard.body).toEqual([]);

    const literalDot = await request(app).get("/players/search?q=A.J");
    expect(literalDot.body.map((p) => p.displayName)).toEqual(["A.J. Brown"]);
  });

  it("collapses a multi-season player into one row carrying the most recent team", async () => {
    await PlayerStats.insertMany([
      makePlayer({ playerId: "sb", displayName: "Saquon Barkley", position: "RB", season: 2022, team: "NYG" }),
      makePlayer({ playerId: "sb", displayName: "Saquon Barkley", position: "RB", season: 2024, team: "PHI" }),
      makePlayer({ playerId: "sb", displayName: "Saquon Barkley", position: "RB", season: 2023, team: "NYG" }),
    ]);

    const res = await request(app).get("/players/search?q=barkley");
    expect(res.body).toHaveLength(1);
    expect(res.body[0]).toMatchObject({ playerId: "sb", team: "PHI" });
  });

  it("orders results by most-recent-season games played, descending", async () => {
    await PlayerStats.insertMany([
      makePlayer({ playerId: "a", displayName: "Alpha Smith", gamesPlayed: 3 }),
      makePlayer({ playerId: "b", displayName: "Bravo Smith", gamesPlayed: 17 }),
      makePlayer({ playerId: "c", displayName: "Charlie Smith", gamesPlayed: 9 }),
    ]);

    const res = await request(app).get("/players/search?q=smith");
    expect(res.body.map((p) => p.playerId)).toEqual(["b", "c", "a"]);
  });

  it("caps results at 10 even when more players match", async () => {
    // There is no pagination on this endpoint: the hard $limit is the only
    // boundary. 12 matches in, 10 out, and the two lowest-gamesPlayed drop.
    const docs = Array.from({ length: 12 }, (_, i) =>
      makePlayer({ playerId: `p${i}`, displayName: `Player Jones${i}`, gamesPlayed: i })
    );
    await PlayerStats.insertMany(docs);

    const res = await request(app).get("/players/search?q=jones");
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(10);
    const ids = res.body.map((p) => p.playerId);
    expect(ids).not.toContain("p0");
    expect(ids).not.toContain("p1");
  });

  it("returns 400 (not 500) when q is repeated into an array", async () => {
    // Express parses ?q=a&q=b into an array; the controller must reject it
    // as a bad request rather than crash on q.trim().
    const res = await request(app).get("/players/search?q=a&q=b");
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ message: "Query parameter q is required" });
  });

  it("hides driver error details behind a generic 500", async () => {
    const spy = vi.spyOn(PlayerStats, "aggregate").mockRejectedValueOnce(
      new Error("secret internal driver detail")
    );
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const res = await request(app).get("/players/search?q=anyone");
    expect(res.status).toBe(500);
    expect(res.body).toEqual({ message: "Internal server error" });
    expect(JSON.stringify(res.body)).not.toContain("driver detail");

    spy.mockRestore();
    errSpy.mockRestore();
  });
});

describe("GET /players/:playerId", () => {
  it("returns 404 with a JSON message for an unknown id", async () => {
    const res = await request(app).get("/players/does-not-exist");
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ message: "Player not found" });
  });

  it("returns every season most-recent-first with the allowlisted projection", async () => {
    await PlayerStats.insertMany([
      makePlayer({
        playerId: "x",
        season: 2023,
        team: "NYG",
        weeks: [makeWeek({ week: 1, passingYards: 200 })],
        advanced: { passingEpa: 0.42, pacr: 0.9 },
      }),
      makePlayer({ playerId: "x", season: 2024, team: "PHI", weeks: [makeWeek({ week: 1 }), makeWeek({ week: 2 })] }),
    ]);

    const res = await request(app).get("/players/x");
    expect(res.status).toBe(200);
    expect(res.body.map((d) => d.season)).toEqual([2024, 2023]);

    const [latest, prior] = res.body;
    // Mongo internals and Mongoose timestamps never reach the client.
    expect(latest).not.toHaveProperty("_id");
    expect(latest).not.toHaveProperty("__v");
    expect(latest).not.toHaveProperty("createdAt");
    expect(latest).not.toHaveProperty("updatedAt");

    // Identity, roster, and draft fields all survive the projection.
    expect(latest).toMatchObject({
      playerId: "x",
      team: "PHI",
      birthDate: "1995-09-17",
      college: "Texas Tech",
      experience: 7,
      heightInches: 74,
      jerseyNumber: 15,
      draftYear: 2017,
      draftRound: 1,
      draftPick: 10,
    });
    expect(latest.weeks).toHaveLength(2);

    // The advanced map serialises as a plain object, not a Map.
    expect(prior.advanced).toEqual({ passingEpa: 0.42, pacr: 0.9 });
    expect(latest.advanced).toBeUndefined();
  });

  it("does not match a playerId by substring or regex", async () => {
    await PlayerStats.insertMany([makePlayer({ playerId: "00-0033873" })]);

    expect((await request(app).get("/players/00-003")).status).toBe(404);
    expect((await request(app).get("/players/.*")).status).toBe(404);
  });
});

describe("GET /", () => {
  it("healthcheck responds", async () => {
    const res = await request(app).get("/");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: "StatSnap API is running" });
  });

  it("unknown routes fall through to a 404", async () => {
    const res = await request(app).get("/nope");
    expect(res.status).toBe(404);
  });
});
