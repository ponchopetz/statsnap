// routes/leaderboards.js

const router = require("express").Router();
const { getLeaderboard } = require("../controllers/leaderboards");

router.get("/", getLeaderboard);

module.exports = router;
