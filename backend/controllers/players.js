// controllers/players.js

const PlayerStats = require('../models/playerStats');

const searchPlayers = async (req, res, next) => {
  const { q } = req.query;

  if (!q || q.trim().length === 0) {
    return res.status(400).json({ message: 'Query parameter q is required' });
  }

  try {
    const results = await PlayerStats.find(
      { displayName: { $regex: q, $options: 'i' } },
      { playerId: 1, displayName: 1, position: 1, team: 1, season: 1, _id: 0 }
    )
      .sort({ season: -1 })
      .limit(10);

    res.status(200).json(results);
  } catch (err) {
    next(err);
  }
};

module.exports = { searchPlayers };
