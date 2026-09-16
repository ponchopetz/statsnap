import { API_BASE_URL } from "./constants.js";

/**
 * Search for players by name. Hits the backend's /players/search
 * endpoint and returns an array of up to 10 deduped player records.
 *
 * Returns: Promise<Array<{ playerId, displayName, position, team }>>
 * Throws: on network failure or non-2xx HTTP response.
 */
export async function searchPlayers(query, signal) {
  const url = `${API_BASE_URL}/players/search?q=${encodeURIComponent(query)}`;
  const response = await fetch(url, { signal });

  if (!response.ok) {
    throw new Error(`Player search failed: ${response.status}`);
  }

  return response.json();
}

/**
 * Fetch a single player's profile by ID. Returns an array of season
 * documents (most-recent first), each with identity fields and an
 * embedded weeks array.
 *
 * Returns: Promise<Array<seasonDoc>>
 * Throws:  Error with .status property on non-2xx responses.
 *          .status === 404 means the player ID does not exist.
 */
export async function getPlayerProfile(playerId) {
  const url = `${API_BASE_URL}/players/${encodeURIComponent(playerId)}`;
  const response = await fetch(url);

  if (!response.ok) {
    const err = new Error(`Player profile failed: ${response.status}`);
    err.status = response.status;
    throw err;
  }

  return response.json();
}

/**
 * Fetch the current week's NFL schedule from the cache.
 * Always resolves to a JSON object; the backend returns the cold-start shape
 * { season: null, week: null, games: [], fetchedAt: null } on a cache miss
 * (200, not 404) so the rail can render its offseason state without erroring.
 *
 * Returns: Promise<{ season, week, games, fetchedAt }>
 * Throws: on network failure or non-2xx HTTP response.
 */
export async function getSchedule(signal) {
  const url = `${API_BASE_URL}/schedule`;
  const response = await fetch(url, { signal });

  if (!response.ok) {
    throw new Error(`Schedule fetch failed: ${response.status}`);
  }

  return response.json();
}

/**
 * Fetch the top qualified players for one
 * season, position, and advanced metric. The backend ranks by the ETL's
 * stored percentile map, so ordering has exactly one definition; the rows
 * carry weeks so the client can format the raw value with stats.js.
 *
 * Returns: Promise<{ season, position, metric, count, rows }>
 * Throws:  Error with .status on non-2xx (404 when the backend flag is off).
 */
export async function getLeaderboard({ season, position, metric, limit = 25 }, signal) {
  const params = new URLSearchParams({ season, position, metric, limit });
  const response = await fetch(`${API_BASE_URL}/leaderboards?${params}`, { signal });

  if (!response.ok) {
    const err = new Error(`Leaderboard fetch failed: ${response.status}`);
    err.status = response.status;
    throw err;
  }

  return response.json();
}

/**
 * Fetch the seasons present in the stats collection, newest first.
 * Returns: Promise<{ seasons: number[] }>
 */
export async function getSeasons(signal) {
  const response = await fetch(`${API_BASE_URL}/seasons`, { signal });
  if (!response.ok) {
    const err = new Error(`Seasons fetch failed: ${response.status}`);
    err.status = response.status;
    throw err;
  }
  return response.json();
}
