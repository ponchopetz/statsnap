// app.js — entry point

const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '.env'), quiet: true });
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

const playersRouter = require('./routes/players');
const scheduleRouter = require('./routes/schedule');
const errorHandler = require('./middlewares/errorHandler');

const PORT = process.env.PORT || 3001;
const CLIENT_ORIGIN = process.env.CORS_ORIGIN || 'http://localhost:3000';
const app = express();

app.set('trust proxy', 1);

app.use(helmet());
app.use(cors({
  origin: CLIENT_ORIGIN,
}));
app.use(express.json());

const limiter = rateLimit({
  windowMs: 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
});
app.use(limiter);

app.use('/players', playersRouter);
app.use('/schedule', scheduleRouter);

// PROTOTYPE routes are mounted only behind an explicit env flag so a default
// deployment exposes exactly the V1 surface. Unmounted routes fall through
// to the 404 handler like any unknown path.
if (process.env.FEATURE_LEADERBOARDS === 'true') {
  app.use('/leaderboards', require('./routes/leaderboards'));
}

app.get('/', (req, res) => {
  res.status(200).json({ status: 'StatSnap API is running' });
});

app.use(errorHandler);

// Side effects (database connection, schedule cron, listening on a port) run
// only when this file is the process entry point (`node app.js`, `npm start`).
// Requiring the module — as the supertest route tests do — builds the app
// without connecting to anything, so tests can attach their own database.
if (require.main === module) {
  require('./utils/db');
  const { startScheduleCron } = require('./utils/scheduleCron');
  startScheduleCron();

  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}

module.exports = app;
