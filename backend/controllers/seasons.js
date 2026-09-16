// controllers/seasons.js
//
// The seasons that actually exist in the stats collection, newest first.
// Lets the leaderboard (and anything else) offer real choices instead of a
// hardcoded year list.

const PlayerStats = require("../models/playerStats");

const getSeasons = async (req, res, next) => {
  try {
    const seasons = await PlayerStats.distinct("season");
    seasons.sort((a, b) => b - a);
    res.status(200).json({ seasons });
  } catch (err) {
    next(err);
  }
};

module.exports = { getSeasons };
