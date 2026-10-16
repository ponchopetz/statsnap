// utils/scheduleCron.js

const cron = require("node-cron");
const { refreshSchedule } = require("./scheduleRefresh");

// Swallows errors so a failed tick cannot produce an unhandled rejection —
// the cron scheduler has no downstream error handler to catch a rejection.
async function runRefresh() {
  try {
    const summary = await refreshSchedule();
    console.log("[scheduleCron] refresh complete:", summary);
  } catch (err) {
    console.warn("[scheduleCron] refresh failed:", err.message);
  }
}

function startScheduleCron() {
  // Hourly, so final scores land within an hour while the server is awake.
  // The events call is free and the paid scores call is gated inside
  // refreshSchedule, so extra ticks cost nothing. timezone: "UTC" keeps the
  // tick independent of the host machine's locale.
  cron.schedule("0 * * * *", runRefresh, { timezone: "UTC" });

  // Refresh immediately on boot so the cache is warm within seconds of startup
  runRefresh();
}

module.exports = { startScheduleCron };
