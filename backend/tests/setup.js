// Runs before every backend test file.
//
// Safety rails: these tests must never touch a real database or the real
// Odds API. Setting the variables here (before any app module loads) means
// dotenv's .env values cannot win — dotenv never overrides an existing
// process.env key — and the URI below points at a port nothing listens on.
process.env.MONGO_URI = "mongodb://127.0.0.1:1/statsnap-tests-never-connect";
process.env.ODDS_API_KEY = "test-key-not-real";
process.env.CORS_ORIGIN = "http://localhost:3000";
