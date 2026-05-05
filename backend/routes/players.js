// routes/players.js

const router = require('express').Router();
const { searchPlayers } = require('../controllers/players');

router.get('/search', searchPlayers);

module.exports = router;
