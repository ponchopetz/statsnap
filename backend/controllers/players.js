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
        },
      },
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

module.exports = { searchPlayers };
