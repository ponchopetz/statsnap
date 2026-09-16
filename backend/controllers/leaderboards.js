// controllers/leaderboards.js
//
// PROTOTYPE — mounted only when FEATURE_LEADERBOARDS=true (see app.js).
//
// Ranks qualified players for one season + position by an advanced metric.
// The sort key is the ETL-computed percentile stored in each document's
// `advanced` map, so the ordering has exactly one definition (percentiles.py)
// and the API never re-derives a stat. Rows include `weeks` so the client can
// show the raw season value through the same stats.js helpers the Advanced
// panel uses.

const PlayerStats = require("../models/playerStats");

const POSITIONS = new Set(["QB", "RB", "WR", "TE"]);
const METRIC_PATTERN = /^[a-zA-Z]{1,40}$/;
const DEFAULT_LIMIT = 25;
const MAX_LIMIT = 100;

function badRequest(res, message) {
  return res.status(400).json({ message });
}

const getLeaderboard = async (req, res, next) => {
  const { season: rawSeason, position, metric, limit: rawLimit } = req.query;

  const season = Number(rawSeason);
  if (typeof rawSeason !== "string" || !Number.isInteger(season) || season < 1999 || season > 2100) {
    return badRequest(res, "season must be a four-digit year");
  }
  if (typeof position !== "string" || !POSITIONS.has(position)) {
    return badRequest(res, "position must be one of QB, RB, WR, TE");
  }
  if (typeof metric !== "string" || !METRIC_PATTERN.test(metric)) {
    return badRequest(res, "metric must be an advanced metric name");
  }
  let limit = DEFAULT_LIMIT;
  if (rawLimit !== undefined) {
    limit = Number(rawLimit);
    if (typeof rawLimit !== "string" || !Number.isInteger(limit) || limit < 1 || limit > MAX_LIMIT) {
      return badRequest(res, `limit must be an integer from 1 to ${MAX_LIMIT}`);
    }
  }

  const metricPath = `advanced.${metric}`;

  try {
    const rows = await PlayerStats.find(
      { season, position, [metricPath]: { $exists: true } },
      {
        _id: 0,
        playerId: 1,
        displayName: 1,
        position: 1,
        team: 1,
        teamCity: 1,
        season: 1,
        gamesPlayed: 1,
        seasonComplete: 1,
        headshotUrl: 1,
        jerseyNumber: 1,
        weeks: 1,
        advanced: 1,
      },
    )
      .sort({ [metricPath]: -1, displayName: 1 })
      .limit(limit)
      .lean();

    res.status(200).json({ season, position, metric, count: rows.length, rows });
  } catch (err) {
    next(err);
  }
};

module.exports = { getLeaderboard };
