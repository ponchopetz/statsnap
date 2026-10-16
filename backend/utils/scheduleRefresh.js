// utils/scheduleRefresh.js
const path = require("path");
require("dotenv").config({
  path: path.resolve(__dirname, "../.env"),
  quiet: true,
});
const { fetchNflEvents, fetchNflScores } = require("./oddsApiClient");
const Schedule = require("../models/schedule");
const { teamCodeFromName } = require("./nflTeams");
const { deriveNflWeek, seasonForDate } = require("./nflWeek");

const HOUR_MS = 60 * 60 * 1000;
// A game counts as over 4h after kickoff: regulation runs about 3h10m and
// overtime rarely passes 3h45m. Mirrored in ScheduleRail.jsx.
const FINAL_AFTER_MS = 4 * HOUR_MS;
// /scores?daysFrom=3 only reaches back three days. Past that a missing final
// can never arrive, so stop asking instead of spending credits every hour.
const SCORES_WINDOW_MS = 72 * HOUR_MS;
// At most one paid /scores call per hour. Stored on the document so a
// restart (every wake on the free host) cannot bypass it.
const SCORES_THROTTLE_MS = HOUR_MS;

// ISO strings are lexicographically sortable
const byKickoff = (a, b) =>
  a.kickoff < b.kickoff ? -1 : a.kickoff > b.kickoff ? 1 : 0;

// True when a game should be over but has no final score stored yet
function needsFinal(game, now) {
  if (game.completed) return false;
  const sinceKickoff = now - Date.parse(game.kickoff);
  return sinceKickoff >= FINAL_AFTER_MS && sinceKickoff <= SCORES_WINDOW_MS;
}

// Copies final scores from a /scores response onto the matching games.
// Games still in progress are left alone: the rail shows finals only.
function applyFinals(games, scoreEvents) {
  const finals = new Map(
    scoreEvents
      .filter((event) => event.completed && event.scores)
      .map((event) => [event.id, event.scores]),
  );

  return games.map((game) => {
    const scores = finals.get(game.id);
    if (!scores) return game;

    // Scores arrive keyed by full team name, as strings
    const points = {};
    for (const { name, score } of scores) {
      points[teamCodeFromName(name)] = Number(score);
    }
    if (points[game.away] === undefined || points[game.home] === undefined) {
      return game;
    }
    return {
      ...game,
      awayScore: points[game.away],
      homeScore: points[game.home],
      completed: true,
    };
  });
}

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

  // Anchor to the earliest game
  mapped.sort(byKickoff);
  const anchor = mapped[0];

  // If the anchor has no valid season/week (e.g. playoff game past Week 18), bail
  if (!anchor || anchor.season === null || anchor.week === null) {
    // A null season/week on a real upstream game usually means SEASON_BOUNDARIES
    // in utils/nflWeek.js hasn't been updated for the new season. Without this
    // log the failure is silent: the refresh bails forever and the rail serves
    // a stale cache.
    console.error(
      "[scheduleRefresh] could not derive season/week for the earliest " +
        `upstream game (kickoff ${anchor ? anchor.kickoff : "n/a"}). ` +
        "If a new NFL season has started, add its Tuesday-noon-ET boundary " +
        "to SEASON_BOUNDARIES in utils/nflWeek.js.",
    );
    return { status: "no-current-week" };
  }

  const { season, week } = anchor;

  // Keep only games in the anchor's season/week; stored objects omit season/week
  const feedGames = mapped
    .filter((g) => g.season === season && g.week === week)
    .map(({ id, kickoff, away, home }) => ({ id, kickoff, away, home }));

  // Merge into the stored week instead of replacing it. The events feed drops
  // a game once it is over, but the rail keeps the whole week. The feed wins
  // on kickoff and teams (flexed games); stored final scores survive.
  const existing = await Schedule.findOne({ season, week }).lean();
  const byId = new Map((existing ? existing.games : []).map((g) => [g.id, g]));
  for (const game of feedGames) {
    byId.set(game.id, { ...byId.get(game.id), ...game });
  }
  let games = [...byId.values()].sort(byKickoff);

  const update = { fetchedAt: new Date() };
  let scoresFetched = false;

  // The only paid call (2 credits): made only when a game should be over but
  // has no final yet, and at most once per throttle window
  const now = Date.now();
  const lastScoresAt =
    existing && existing.scoresFetchedAt ? existing.scoresFetchedAt.getTime() : 0;
  if (
    games.some((g) => needsFinal(g, now)) &&
    now - lastScoresAt >= SCORES_THROTTLE_MS
  ) {
    // Stamped even when the call fails, so a down /scores endpoint is retried
    // on the throttle instead of on every refresh
    update.scoresFetchedAt = new Date(now);
    try {
      games = applyFinals(games, await fetchNflScores());
      scoresFetched = true;
    } catch (err) {
      // A scores failure must not cost the events merge
      console.warn("[scheduleRefresh] scores fetch failed:", err.message);
    }
  }
  update.games = games;

  await Schedule.findOneAndUpdate(
    { season, week },
    { $set: update },
    { upsert: true },
  );

  return { status: "ok", season, week, gameCount: games.length, scoresFetched };
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
