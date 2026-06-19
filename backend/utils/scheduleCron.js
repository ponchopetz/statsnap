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
  // timezone: "UTC" so the 08:00 tick is independent of the host machine's locale
  cron.schedule("0 8 * * *", runRefresh, { timezone: "UTC" });

  // Refresh immediately on boot so the cache is warm within seconds of startup
  runRefresh();
}

module.exports = { startScheduleCron };
