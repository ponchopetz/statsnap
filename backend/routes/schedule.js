// routes/schedule.js

const router = require("express").Router();
const { getSchedule } = require("../controllers/schedule");

router.get("/", getSchedule);

module.exports = router;
