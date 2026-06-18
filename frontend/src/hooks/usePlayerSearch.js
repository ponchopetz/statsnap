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

    const controller = new AbortController();
    setStatus("loading");

    searchPlayers(trimmed, controller.signal)
      .then((data) => {
        setResults(data);
        setStatus("success");
      })
      .catch((err) => {
        if (err.name === "AbortError") return;
        setErrorMessage(err.message);
        setStatus("error");
      });

    return () => {
      controller.abort();
    };
  }, [debouncedQuery]);

  return { status, results, errorMessage };
}
