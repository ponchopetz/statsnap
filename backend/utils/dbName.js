// utils/dbName.js — which database to connect to; DB_NAME points a run at a copy

module.exports = (env = process.env) => env.DB_NAME || 'statsnap';
