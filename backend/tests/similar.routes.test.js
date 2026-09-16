import { createRequire } from "node:module";
import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import request from "supertest";
import { startMongo, stopMongo, clearCollections } from "./helpers/mongo.js";
import { makePlayer } from "./helpers/fixtures.js";

process.env.FEATURE_SIMILAR = "true";

const require = createRequire(import.meta.url);
const app = require("../app.js");
const PlayerStats = require("../models/playerStats.js");
const { similarity, rankSimilar, DEFAULT_WEIGHTS } = require("../utils/similarity.js");

beforeAll(startMongo);
afterAll(stopMongo);
beforeEach(clearCollections);

describe("similarity", () => {
  it("is 1 for identical profiles, 0 for opposite corners, null below the overlap floor", () => {
    expect(similarity({ a: 0.5, b: 0.5, c: 0.5 }, { a: 0.5, b: 0.5, c: 0.5 })).toBe(1);
    expect(similarity({ a: 0, b: 0, c: 0 }, { a: 1, b: 1, c: 1 })).toBeCloseTo(0, 10);
    expect(similarity({ a: 0.5, b: 0.5 }, { a: 0.5, b: 0.5 })).toBeNull();
    expect(similarity({ a: 0.5, b: 0.5, c: 0.5 }, { a: 0.5, b: 0.5, d: 0.5 })).toBeNull();
    expect(similarity(undefined, { a: 1 })).toBeNull();
  });

  it("weights EPA metrics more heavily than volume metrics", () => {
    expect(DEFAULT_WEIGHTS.receivingEpa).toBe(2);
    const target = { receivingEpa: 0.9, targetShare: 0.9, wopr: 0.9 };
    const offOnEpa = { receivingEpa: 0.5, targetShare: 0.9, wopr: 0.9 };
    const offOnShare = { receivingEpa: 0.9, targetShare: 0.5, wopr: 0.9 };
    expect(similarity(target, offOnEpa)).toBeLessThan(similarity(target, offOnShare));
    // Unweighted, the two are identical.
    expect(similarity(target, offOnEpa, { weights: {} })).toBeCloseTo(similarity(target, offOnShare, { weights: {} }), 10);
  });

  it("ranks by similarity, drops the target itself and unmatched profiles, breaks ties by name", () => {
    const target = { playerId: "t", advanced: { a: 0.9, b: 0.9, c: 0.9 } };
    const ranked = rankSimilar(target, [
      { playerId: "far", displayName: "Far", advanced: { a: 0.1, b: 0.1, c: 0.1 } },
      { playerId: "near", displayName: "Near", advanced: { a: 0.85, b: 0.9, c: 0.95 } },
      { playerId: "t", displayName: "Self", advanced: { a: 0.9, b: 0.9, c: 0.9 } },
      { playerId: "twin-b", displayName: "Zed", advanced: { a: 0.9, b: 0.9, c: 0.9 } },
      { playerId: "twin-a", displayName: "Amy", advanced: { a: 0.9, b: 0.9, c: 0.9 } },
      { playerId: "none", displayName: "None" },
    ], 3);
    expect(ranked.map((r) => r.candidate.playerId)).toEqual(["twin-a", "twin-b", "near"]);
  });
});

describe("GET /players/:playerId/similar", () => {
  const wr = (id, name, adv, extra = {}) => makePlayer({ playerId: id, displayName: name, position: "WR", season: 2024, advanced: adv, ...extra });

  it("returns the nearest cohort profiles with a rounded similarity", async () => {
    await PlayerStats.insertMany([
      wr("me", "Me", { targetShare: 0.9, wopr: 0.9, racr: 0.5 }),
      wr("near", "Near", { targetShare: 0.85, wopr: 0.92, racr: 0.55 }),
      wr("far", "Far", { targetShare: 0.1, wopr: 0.1, racr: 0.9 }),
      wr("te", "Tight End", { targetShare: 0.9, wopr: 0.9, racr: 0.5 }, { position: "TE" }),
      wr("last-year", "Last Year", { targetShare: 0.9, wopr: 0.9, racr: 0.5 }, { season: 2023 }),
      wr("unqualified", "Unqualified", undefined),
    ]);

    const res = await request(app).get("/players/me/similar?season=2024");
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ playerId: "me", season: 2024, position: "WR", qualified: true });
    expect(res.body.similar.map((s) => s.playerId)).toEqual(["near", "far"]);
    expect(res.body.similar[0].similarity).toBeGreaterThan(res.body.similar[1].similarity);
    expect(res.body.similar[0]).not.toHaveProperty("_id");
  });

  it("scope=all compares across seasons and carries each comp's season", async () => {
    await PlayerStats.insertMany([
      wr("me", "Me", { targetShare: 0.9, wopr: 0.9, racr: 0.5 }),
      wr("me", "Me", { targetShare: 0.9, wopr: 0.9, racr: 0.5 }, { season: 2023 }),
      wr("old", "Old Timer", { targetShare: 0.9, wopr: 0.9, racr: 0.5 }, { season: 2019 }),
      wr("near", "Near", { targetShare: 0.7, wopr: 0.7, racr: 0.5 }),
    ]);
    const res = await request(app).get("/players/me/similar?season=2024&scope=all");
    expect(res.status).toBe(200);
    expect(res.body.scope).toBe("all");
    expect(res.body.similar.map((s) => [s.playerId, s.season])).toEqual([["old", 2019], ["near", 2024]]);
    expect((await request(app).get("/players/me/similar?season=2024&scope=nope")).status).toBe(400);
  });

  it("reports an unqualified target with an empty list, 404s an unknown season, 400s a bad query", async () => {
    await PlayerStats.insertMany([wr("me", "Me", undefined)]);
    expect((await request(app).get("/players/me/similar?season=2024")).body).toMatchObject({ qualified: false, similar: [] });
    expect((await request(app).get("/players/me/similar?season=2019")).status).toBe(404);
    expect((await request(app).get("/players/me/similar")).status).toBe(400);
    expect((await request(app).get("/players/me/similar?season=2024&limit=50")).status).toBe(400);
  });

  it("does not shadow the plain player route", async () => {
    await PlayerStats.insertMany([wr("me", "Me", undefined)]);
    expect((await request(app).get("/players/me")).status).toBe(200);
  });
});
