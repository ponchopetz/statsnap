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
