import { useState, useEffect } from "react";

/**
 * A useState replacement that persists to localStorage. Returns the same
 * [value, setValue] tuple shape as useState.
 *
 *   const [recents, setRecents] = useLocalStorageState("statsnap:recents", []);
 *
 * The initial value is read from localStorage on mount; subsequent
 * changes write back through. Read errors (malformed JSON) and write
 * errors (quota exceeded, private-browsing restrictions) are caught
 * and logged so the app keeps functioning even if storage misbehaves.
 */
export function useLocalStorageState(key, initialValue) {
  // Lazy initializer: passing a function to useState means React calls
  // it only once on mount, not on every render. Without this, we'd be
  // reading localStorage on every render and throwing the result away.
  const [value, setValue] = useState(() => {
    try {
      const stored = window.localStorage.getItem(key);
      if (stored === null) return initialValue;
      return JSON.parse(stored);
    } catch (err) {
      console.warn(`useLocalStorageState: read failed for "${key}"`, err);
      return initialValue;
    }
  });

  useEffect(() => {
    try {
      window.localStorage.setItem(key, JSON.stringify(value));
    } catch (err) {
      console.warn(`useLocalStorageState: write failed for "${key}"`, err);
    }
  }, [key, value]);

  return [value, setValue];
}
