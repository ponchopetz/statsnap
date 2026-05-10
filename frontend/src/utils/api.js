import { API_BASE_URL } from "./constants.js";

/**
 * Search for players by name. Hits the backend's /players/search
 * endpoint and returns an array of up to 10 deduped player records.
 *
 * Returns: Promise<Array<{ playerId, displayName, position, team }>>
 * Throws: on network failure or non-2xx HTTP response.
 */
export async function searchPlayers(query) {
  const url = `${API_BASE_URL}/players/search?q=${encodeURIComponent(query)}`;
  const response = await fetch(url);

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
