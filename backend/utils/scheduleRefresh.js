// utils/scheduleRefresh.js
const path = require("path");
require("dotenv").config({
  path: path.resolve(__dirname, "../.env"),
  quiet: true,
});
const { fetchNflEvents } = require("./oddsApiClient");
const Schedule = require("../models/schedule");
const { teamCodeFromName } = require("./nflTeams");
const { deriveNflWeek, seasonForDate } = require("./nflWeek");

async function refreshSchedule() {
  const events = await fetchNflEvents();

  // Never overwrite a good cache with an offseason empty response
  if (events.length === 0) {
    return { status: "empty-upstream" };
  }

  // Map events to internal shape; warn and drop any unresolvable team codes
  const mapped = [];
  for (const event of events) {
    const away = teamCodeFromName(event.away_team);
    const home = teamCodeFromName(event.home_team);
    if (away === null || home === null) {
      console.warn(
        `[scheduleRefresh] unknown team in event ${event.id}: "${event.away_team}" vs "${event.home_team}"`,
      );
      continue;
    }
    const season = seasonForDate(event.commence_time);
    const week = deriveNflWeek(event.commence_time, season);
    mapped.push({
      id: event.id,
      kickoff: event.commence_time,
      away,
      home,
      season,
      week,
    });
  }

  // Anchor to the earliest game. ISO strings are lexicographically sortable.
  mapped.sort((a, b) =>
    a.kickoff < b.kickoff ? -1 : a.kickoff > b.kickoff ? 1 : 0,
  );
  const anchor = mapped[0];

  // If the anchor has no valid season/week (e.g. playoff game past Week 18), bail
  if (!anchor || anchor.season === null || anchor.week === null) {
    return { status: "no-current-week" };
  }

  const { season, week } = anchor;

  // Keep only games in the anchor's season/week; stored objects omit season/week
  const games = mapped
    .filter((g) => g.season === season && g.week === week)
    .map(({ id, kickoff, away, home }) => ({ id, kickoff, away, home }));

  await Schedule.findOneAndUpdate(
    { season, week },
    { $set: { games, fetchedAt: new Date() } },
    { upsert: true },
  );

  return { status: "ok", season, week, gameCount: games.length };
}

// Manual-run entry point: `node utils/scheduleRefresh.js`
if (require.main === module) {
  const mongoose = require("mongoose");
  require("./db");

  refreshSchedule()
    .then((summary) => {
      console.log(summary);
      return mongoose.disconnect();
    })
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}

module.exports = { refreshSchedule };
