// models/playerStats.js

const mongoose = require('mongoose');

const weekSchema = new mongoose.Schema(
  {
    week: { type: Number, required: true },

    // QB metrics
    attempts:        { type: Number },
    completions:     { type: Number },
    passingEpa:      { type: Number },
    pacr:            { type: Number },
    passingCpoe:     { type: Number },
    passingAirYards: { type: Number },
    sacksSuffered:   { type: Number },
    sackYardsLost:   { type: Number },
    adot:            { type: Number },

    // WR / TE / RB metrics
    targets:           { type: Number },
    receptions:        { type: Number },
    targetShare:       { type: Number },
    airYardsShare:     { type: Number },
    wopr:              { type: Number },
    racr:              { type: Number },
    receivingEpa:      { type: Number },
    receivingAirYards: { type: Number },
    receivingYac:      { type: Number },
    yacPerRec:         { type: Number },

    // RB metrics
    rushingEpa: { type: Number },
    carries:    { type: Number },

    // QB counting stats
    passingYards:            { type: Number },
    passingTds:              { type: Number },
    interceptions:           { type: Number },
    passingFirstDowns:       { type: Number },
    passingTwoPtConversions: { type: Number },

    // WR / TE / RB counting stats
    receivingYards:            { type: Number },
    receivingTds:              { type: Number },
    receivingFirstDowns:       { type: Number },
    receivingFumblesLost:      { type: Number },
    receivingTwoPtConversions: { type: Number },

    // RB counting stats
    rushingYards:            { type: Number },
    rushingTds:              { type: Number },
    rushingFirstDowns:       { type: Number },
    rushingFumblesLost:      { type: Number },
    rushingTwoPtConversions: { type: Number },

    // Other
    specialTeamsTds:  { type: Number },
    fantasyPoints:    { type: Number },
    fantasyPointsPpr: { type: Number },

    // Game context (Chunk 14c)
    opponent:      { type: String },
    homeAway:      { type: String },
    teamScore:     { type: Number },
    opponentScore: { type: Number },
    gameday:       { type: String },
    overtime:      { type: Number },
    result:        { type: String },
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

    // Roster fields (nflverse load_rosters)
    birthDate:    { type: String },
    college:      { type: String },
    experience:   { type: Number },
    headshotUrl:  { type: String },
    heightInches: { type: Number },
    jerseyNumber: { type: Number },
    teamCity:     { type: String },
    weight:       { type: Number },

    // Draft fields (nflverse load_draft_picks; null for undrafted players)
    draftYear:  { type: Number },
    draftRound: { type: Number },
    draftPick:  { type: Number },

    weeks: { type: [weekSchema], default: [] },

    // Per-position percentile map (e.g. passingEpa for QB, targetShare for WR).
    // Map (not a named sub-schema) because the key set varies by position.
    advanced: { type: Map, of: Number },
  },
  {
    timestamps: true,
    collection: 'playerstats',
  }
);

playerStatsSchema.index({ playerId: 1, season: -1 });

module.exports = mongoose.model('PlayerStats', playerStatsSchema);
