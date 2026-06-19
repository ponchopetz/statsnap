// controllers/schedule.js

const Schedule = require("../models/schedule");

const getSchedule = async (req, res, next) => {
  try {
    const doc = await Schedule.findOne(
      {},
      { _id: 0, __v: 0, createdAt: 0, updatedAt: 0 },
    ).sort({ fetchedAt: -1 });

    if (!doc) {
      return res.status(200).json({ season: null, week: null, games: [], fetchedAt: null });
    }

    res.status(200).json(doc);
  } catch (err) {
    next(err);
  }
};

module.exports = { getSchedule };
