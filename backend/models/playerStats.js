// models/playerStats.js

const mongoose = require('mongoose');

const weekSchema = new mongoose.Schema(
  {
    week: { type: Number, required: true },

    // QB metrics
    passingEpa:      { type: Number },
    pacr:            { type: Number },
    passingAirYards: { type: Number },
    adot:            { type: Number },
    sacks:           { type: Number },
    sackYardsLost:   { type: Number },
    passingCpoe:     { type: Number },

    // WR / TE metrics
    targetShare:     { type: Number },
    airYardsShare:   { type: Number },
    wopr:            { type: Number },
    racr:            { type: Number },
    receivingAirYards: { type: Number },
    yacPerRec:       { type: Number },
    receivingEpa:    { type: Number },

    // RB metrics
    rushingEpa:      { type: Number },
    carries:         { type: Number },
  },
  { _id: false }
);

const playerStatsSchema = new mongoose.Schema(
  {
    playerId:    { type: String, required: true },
    displayName: { type: String, required: true },
    position:    { type: String, required: true, enum: ['QB', 'WR', 'TE', 'RB'] },
    team:        { type: String, required: true },
    season:      { type: Number, required: true },
    gamesPlayed: { type: Number },
    weeks:       { type: [weekSchema], default: [] },
  },
  {
    timestamps: true,
    collection: 'playerstats',
  }
);

playerStatsSchema.index({ playerId: 1, season: -1 });

module.exports = mongoose.model('PlayerStats', playerStatsSchema);
