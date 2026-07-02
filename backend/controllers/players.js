// controllers/players.js

const PlayerStats = require("../models/playerStats");

const searchPlayers = async (req, res, next) => {
  const { q } = req.query;

  if (!q || q.trim().length === 0) {
    return res.status(400).json({ message: "Query parameter q is required" });
  }

  try {
    const results = await PlayerStats.aggregate([
      { $match: { displayName: { $regex: q, $options: "i" } } },
      { $sort: { season: -1 } },
      {
        $group: {
          _id: "$playerId",
          displayName: { $first: "$displayName" },
          position: { $first: "$position" },
          team: { $first: "$team" },
          gamesPlayed: { $first: "$gamesPlayed" },
        },
      },
      { $sort: { gamesPlayed: -1 } },
      {
        $project: {
          _id: 0,
          playerId: "$_id",
          displayName: 1,
          position: 1,
          team: 1,
        },
      },
      { $limit: 10 },
    ]);

    res.status(200).json(results);
  } catch (err) {
    next(err);
  }
};

const getPlayerById = async (req, res, next) => {
  const { playerId } = req.params;

  try {
    const seasons = await PlayerStats.find(
      { playerId },
      {
        _id: 0,
        playerId: 1,
        displayName: 1,
        position: 1,
        team: 1,
        season: 1,
        gamesPlayed: 1,
        seasonComplete: 1,
        // Roster fields (nflverse load_rosters)
        birthDate: 1,
        college: 1,
        experience: 1,
        headshotUrl: 1,
        heightInches: 1,
        jerseyNumber: 1,
        teamCity: 1,
        weight: 1,
        // Draft fields (nflverse load_draft_picks; null for undrafted players)
        draftYear: 1,
        draftRound: 1,
        draftPick: 1,
        weeks: 1,
        advanced: 1,
      },
    ).sort({ season: -1 });

    if (!seasons.length) {
      return res.status(404).json({ message: "Player not found" });
    }

    res.status(200).json(seasons);
  } catch (err) {
    next(err);
  }
};

module.exports = { searchPlayers, getPlayerById };
