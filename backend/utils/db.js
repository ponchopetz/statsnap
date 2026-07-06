// utils/db.js — Mongoose connection

const mongoose = require('mongoose');

mongoose
  .connect(process.env.MONGO_URI, { dbName: 'statsnap' })
  .then(() => {
    console.log('Connected to MongoDB');
  })
  .catch((err) => {
    console.error('MongoDB connection error:', err.message);
    process.exit(1);
  });
