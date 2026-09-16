// controllers/similar.js
//
// LABS — mounted only when FEATURE_SIMILAR=true (see app.js).
// GET /players/:playerId/similar?season=YYYY&limit=N&scope=season|all
// Nearest percentile profiles in the same position cohort. scope=season
// (default) compares within the same season; scope=all compares against
// every loaded season of every other player at the position, so a 2024
// receiver can "play like" a 2019 one.

const PlayerStats = require("../models/playerStats");
const { rankSimilar } = require("../utils/similarity");

const DEFAULT_LIMIT = 5;
const MAX_LIMIT = 10;

const PROJECTION = { _id: 0, playerId: 1, displayName: 1, position: 1, team: 1, season: 1, gamesPlayed: 1, headshotUrl: 1, advanced: 1 };

const getSimilarPlayers = async (req, res, next) => {
  const { playerId } = req.params;
  const season = Number(req.query.season);
  if (typeof req.query.season !== "string" || !Number.isInteger(season)) {
    return res.status(400).json({ message: "season is required and must be a year" });
  }
  const scope = req.query.scope ?? "season";
  if (scope !== "season" && scope !== "all") {
    return res.status(400).json({ message: "scope must be season or all" });
  }
  let limit = DEFAULT_LIMIT;
  if (req.query.limit !== undefined) {
    limit = Number(req.query.limit);
    if (!Number.isInteger(limit) || limit < 1 || limit > MAX_LIMIT) {
      return res.status(400).json({ message: `limit must be an integer from 1 to ${MAX_LIMIT}` });
    }
  }

  try {
    const target = await PlayerStats.findOne({ playerId, season }, PROJECTION).lean();
    if (!target) return res.status(404).json({ message: "Player season not found" });

    // A player below the qualifier has no percentile profile to match on.
    if (!target.advanced) {
      return res.status(200).json({ playerId, season, scope, position: target.position, qualified: false, similar: [] });
    }

    const cohortFilter = { position: target.position, advanced: { $exists: true }, playerId: { $ne: playerId } };
    if (scope === "season") cohortFilter.season = season;
    const cohort = await PlayerStats.find(cohortFilter, PROJECTION).lean();

    const similar = rankSimilar(target, cohort, limit).map(({ candidate, similarity }) => ({
      playerId: candidate.playerId,
      displayName: candidate.displayName,
      season: candidate.season,
      team: candidate.team,
      gamesPlayed: candidate.gamesPlayed,
      headshotUrl: candidate.headshotUrl,
      similarity: Math.round(similarity * 1000) / 1000,
    }));

    res.status(200).json({ playerId, season, scope, position: target.position, qualified: true, similar });
  } catch (err) {
    next(err);
  }
};

module.exports = { getSimilarPlayers };
