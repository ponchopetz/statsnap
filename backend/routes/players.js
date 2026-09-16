// routes/players.js

const router = require('express').Router();
const { searchPlayers, getPlayerById } = require('../controllers/players');

router.get('/search', searchPlayers);

// LABS: "plays like" comps. Registered before /:playerId so the two-segment
// path is not swallowed by the catch-all id route.
if (process.env.FEATURE_SIMILAR === 'true') {
  const { getSimilarPlayers } = require('../controllers/similar');
  router.get('/:playerId/similar', getSimilarPlayers);
}

router.get('/:playerId', getPlayerById);

module.exports = router;
