// routes/players.js

const router = require('express').Router();
const { searchPlayers, getPlayerById } = require('../controllers/players');

router.get('/search', searchPlayers);
router.get('/:playerId', getPlayerById);

module.exports = router;
