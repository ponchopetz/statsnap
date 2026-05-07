// app.js — entry point

require('dotenv').config();
const express = require('express');
const cors = require('cors');

require('./utils/db');

const playersRouter = require('./routes/players');
const errorHandler = require('./middlewares/errorHandler');

const PORT = process.env.PORT || 3001;
const app = express();

app.use(cors({
  origin: 'http://localhost:3000',
}));
app.use(express.json());

app.use('/players', playersRouter);

app.get('/', (req, res) => {
  res.status(200).json({ status: 'StatSnap API is running' });
});

app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
