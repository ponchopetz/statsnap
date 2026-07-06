// utils/oddsApiClient.js

const API_KEY = process.env.ODDS_API_KEY;
if (!API_KEY) {
  throw new Error('ODDS_API_KEY is not set in environment variables');
}

const EVENTS_URL =
  'https://api.the-odds-api.com/v4/sports/americanfootball_nfl/events';

async function fetchNflEvents() {
  const params = new URLSearchParams({ apiKey: API_KEY, dateFormat: 'iso' });
  const response = await fetch(`${EVENTS_URL}?${params}`);
  // Native fetch does not throw on 4xx/5xx; surface the status explicitly
  if (!response.ok) {
    throw new Error(`Odds API responded with ${response.status}`);
  }
  return response.json();
}

module.exports = { fetchNflEvents };
