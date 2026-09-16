// routes/seasons.js

const router = require("express").Router();
const { getSeasons } = require("../controllers/seasons");

router.get("/", getSeasons);

module.exports = router;
