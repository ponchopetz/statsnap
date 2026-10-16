// utils/oddsApiClient.js

const API_KEY = process.env.ODDS_API_KEY;
if (!API_KEY) {
  throw new Error('ODDS_API_KEY is not set in environment variables');
}

const EVENTS_URL =
  'https://api.the-odds-api.com/v4/sports/americanfootball_nfl/events';
const SCORES_URL =
  'https://api.the-odds-api.com/v4/sports/americanfootball_nfl/scores';

async function fetchNflEvents() {
  const params = new URLSearchParams({ apiKey: API_KEY, dateFormat: 'iso' });
  const response = await fetch(`${EVENTS_URL}?${params}`);
  // Native fetch does not throw on 4xx/5xx; surface the status explicitly
  if (!response.ok) {
    throw new Error(`Odds API responded with ${response.status}`);
  }
  return response.json();
}

// Unlike /events this costs credits: 2 per call, because daysFrom adds the
// finished games (up to 3 days back) that carry final scores. Callers gate it.
async function fetchNflScores() {
  const params = new URLSearchParams({
    apiKey: API_KEY,
    daysFrom: '3',
    dateFormat: 'iso',
  });
  const response = await fetch(`${SCORES_URL}?${params}`);
  if (!response.ok) {
    throw new Error(`Odds API scores responded with ${response.status}`);
  }
  // Credit usage is only visible in these headers; log it for Render's logs
  console.log(
    `[oddsApiClient] scores call cost ${response.headers.get('x-requests-last')} credits, ` +
      `${response.headers.get('x-requests-remaining')} left this month`,
  );
  return response.json();
}

module.exports = { fetchNflEvents, fetchNflScores };
