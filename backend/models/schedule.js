// models/schedule.js

const mongoose = require('mongoose');

const gameSchema = new mongoose.Schema(
  {
    id:      { type: String, required: true },
    kickoff: { type: String, required: true }, // verbatim ISO string from the API
    away:    { type: String, required: true },
    home:    { type: String, required: true },
    // Set only once a game is final (from /scores); absent otherwise
    awayScore: { type: Number },
    homeScore: { type: Number },
    completed: { type: Boolean },
  },
  { _id: false }
);

const scheduleSchema = new mongoose.Schema(
  {
    season:    { type: Number, required: true },
    week:      { type: Number, required: true },
    games:     { type: [gameSchema], default: [] },
    fetchedAt: { type: Date, required: true },
    // Last paid /scores call; throttles it across restarts
    scoresFetchedAt: { type: Date },
  },
  {
    timestamps: true,
    collection: 'schedules',
  }
);

scheduleSchema.index({ season: 1, week: 1 }, { unique: true });

module.exports = mongoose.model('Schedule', scheduleSchema);
