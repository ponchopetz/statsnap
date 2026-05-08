import { useState, useRef, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useLocalStorageState } from "../../hooks/useLocalStorageState.js";
import { usePlayerSearch } from "../../hooks/usePlayerSearch.js";
import Typeahead from "../Typeahead/Typeahead.jsx";
import "./Landing.css";

const RECENTS_KEY = "statsnap:recents";
const MAX_RECENTS = 5;

function Landing() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [query, setQuery] = useState(() => searchParams.get("q") ?? "");
  const [recents, setRecents] = useLocalStorageState(RECENTS_KEY, []);
  const [activeIdx, setActiveIdx] = useState(0);
  const inputRef = useRef(null);
  const navigate = useNavigate();

  const updateQuery = (value) => {
    setQuery(value);
    if (value === "") {
      setSearchParams({}, { replace: true });
    } else {
      setSearchParams({ q: value }, { replace: true });
    }
  };
  const { status, results, errorMessage } = usePlayerSearch(query);

  // Reset highlight to the top whenever the result set changes.
  useEffect(() => {
    setActiveIdx(0);
  }, [results]);

  // Global Cmd+K (Mac) / Ctrl+K (others) focuses the search input.
  // preventDefault stops Chrome from opening its built-in search bar.
  useEffect(() => {
    const onKeyDown = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const handlePick = (player) => {
    const next = [
      player,
      ...recents.filter((p) => p.playerId !== player.playerId),
    ].slice(0, MAX_RECENTS);
    try {
      window.localStorage.setItem(RECENTS_KEY, JSON.stringify(next));
    } catch (err) {
      console.warn("statsnap: failed to persist recents", err);
    }
    setRecents(next);
    navigate(`/players/${player.playerId}`);
  };

  // Arrow keys navigate results, Enter picks, Escape clears.
  // preventDefault on the arrows stops them from moving the text cursor.
  const onInputKeyDown = (e) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (results.length > 0) {
        setActiveIdx((i) => Math.min(i + 1, results.length - 1));
      }
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (results.length > 0) {
        setActiveIdx((i) => Math.max(i - 1, 0));
      }
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (results.length > 0) {
        handlePick(results[activeIdx]);
      }
    } else if (e.key === "Escape") {
      e.preventDefault();
      updateQuery("");
    }
  };

  return (
    <div className="landing">
      <div className="landing-inner">
        <div className="wordmark">
          STAT<span className="slash">/</span>SNAP
        </div>

        <div className="tagline">
          NFL SKILL POSITIONS &nbsp;·&nbsp; <b>INSTANT LOOKUP</b> &nbsp;·&nbsp; QB · RB · WR · TE
        </div>

        <div className="search-wrap">
          <div className="search-box">
            <span className="caret">&gt;</span>
            <input
              ref={inputRef}
              autoFocus
              placeholder="Type a player..."
              value={query}
              onChange={(e) => updateQuery(e.target.value)}
              onKeyDown={onInputKeyDown}
            />
            <span className="kbd">⌘K</span>
          </div>
          <Typeahead
            status={status}
            results={results}
            errorMessage={errorMessage}
            activeIdx={activeIdx}
            onPick={handlePick}
          />
        </div>

        {recents.length > 0 && (
          <div className="recent-row">
            {recents.map((p) => (
              <button
                key={p.playerId}
                type="button"
                className="recent-chip"
                onClick={() => handlePick(p)}
              >
                ← {p.displayName.toUpperCase()}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="landing-help">
        <span><b>↑↓</b> NAVIGATE</span>
        <span><b>↵</b> SELECT</span>
        <span><b>ESC</b> CLEAR</span>
        <span><b>⌘K</b> FOCUS</span>
      </div>
    </div>
  );
}

export default Landing;
