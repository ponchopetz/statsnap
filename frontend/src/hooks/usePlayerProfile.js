import { useState, useEffect } from "react";
import { getPlayerProfile } from "../utils/api.js";

/**
 * Hook for the player profile page. Takes a playerId, returns the
 * current fetch status, the array of season documents on success,
 * and any error message.
 *
 * Status enum: "loading" | "success" | "error" | "not_found"
 *   - Initial state is "loading" (no idle — playerId is known on mount).
 *   - 404 from the backend maps to "not_found", distinct from generic
 *     network/server failures so the UI can show a tailored message.
 *
 * No debouncing — playerId comes from the URL and doesn't change rapidly.
 *
 * Usage:
 *   const { status, data, errorMessage } = usePlayerProfile(playerId);
 */
export function usePlayerProfile(playerId) {
  const [status, setStatus] = useState("loading");
  const [data, setData] = useState(null);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    if (!playerId) return;

    let cancelled = false;
    setStatus("loading");

    getPlayerProfile(playerId)
      .then((result) => {
        if (cancelled) return;
        setData(result);
        setStatus("success");
      })
      .catch((err) => {
        if (cancelled) return;
        if (err.status === 404) {
          setStatus("not_found");
        } else {
          setErrorMessage(err.message);
          setStatus("error");
        }
      });

    return () => {
      cancelled = true;
    };
  }, [playerId]);

  return { status, data, errorMessage };
}
