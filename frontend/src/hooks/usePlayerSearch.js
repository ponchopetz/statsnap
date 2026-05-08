import { useState, useEffect } from "react";
import { searchPlayers } from "../utils/api.js";
import { useDebouncedValue } from "./useDebouncedValue.js";

const DEBOUNCE_MS = 200;

/**
 * Hook for player search. Takes a query string, returns the current
 * search status, results, and any error message. Handles debouncing
 * and ignores stale responses internally so consumers don't have to.
 *
 * Usage:
 *   const { status, results, errorMessage } = usePlayerSearch(query);
 */
export function usePlayerSearch(query) {
  const debouncedQuery = useDebouncedValue(query, DEBOUNCE_MS);
  const [status, setStatus] = useState("idle");
  const [results, setResults] = useState([]);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    const trimmed = debouncedQuery.trim();

    if (!trimmed) {
      setStatus("idle");
      setResults([]);
      return;
    }

    let cancelled = false;
    setStatus("loading");

    searchPlayers(trimmed)
      .then((data) => {
        if (cancelled) return;
        setResults(data);
        setStatus("success");
      })
      .catch((err) => {
        if (cancelled) return;
        setErrorMessage(err.message);
        setStatus("error");
      });

    return () => {
      cancelled = true;
    };
  }, [debouncedQuery]);

  return { status, results, errorMessage };
}
