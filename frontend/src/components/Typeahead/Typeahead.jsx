import { useState, useEffect } from "react";
import { searchPlayers } from "../../utils/api.js";
import { useDebouncedValue } from "../../hooks/useDebouncedValue.js";
import "./Typeahead.css";

const DEBOUNCE_MS = 200;

function Typeahead({ query, onPick }) {
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

  if (status === "idle") return null;

  return (
    <div className="typeahead" role="listbox">
      {status === "loading" && (
        <div className="typeahead-hint">SEARCHING...</div>
      )}

      {status === "error" && (
        <div className="typeahead-empty">SEARCH FAILED — {errorMessage}</div>
      )}

      {status === "success" && results.length === 0 && (
        <div className="typeahead-empty">
          NO PLAYER FOUND — TRY "JEFFERSON" OR "MAHOMES"
        </div>
      )}

      {status === "success" && results.length > 0 && (
        <>
          <div className="typeahead-hint">
            <b>{results.length}</b> {results.length === 1 ? "MATCH" : "MATCHES"}
          </div>
          {results.map((p) => (
            <div
              key={p.playerId}
              className="typeahead-item"
              role="option"
              onClick={() => onPick(p)}
            >
              <div className={"pos-badge " + p.position}>{p.position}</div>
              <div>
                <div className="typeahead-name">{p.displayName}</div>
                <div className="typeahead-meta">{p.team}</div>
              </div>
            </div>
          ))}
        </>
      )}
    </div>
  );
}

export default Typeahead;
