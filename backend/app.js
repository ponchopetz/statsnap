// app.js — entry point

const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '.env') });
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

require('./utils/db');

const playersRouter = require('./routes/players');
const scheduleRouter = require('./routes/schedule');
const errorHandler = require('./middlewares/errorHandler');
const { startScheduleCron } = require('./utils/scheduleCron');

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

app.get('/', (req, res) => {
  res.status(200).json({ status: 'StatSnap API is running' });
});

app.use(errorHandler);

startScheduleCron();

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
