// utils/db.js — Mongoose connection

const mongoose = require('mongoose');

const dbName = process.env.DB_NAME || 'statsnap';

mongoose
  .connect(process.env.MONGO_URI, { dbName })
  .then(() => {
    console.log(`Connected to MongoDB (${dbName})`);
  })
  .catch((err) => {
    console.error('MongoDB connection error:', err.message);
    process.exit(1);
  });
