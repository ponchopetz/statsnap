import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useLocalStorageState } from "../../hooks/useLocalStorageState.js";
import PlayerSearch from "../PlayerSearch/PlayerSearch.jsx";
import ScheduleRail from "../ScheduleRail/ScheduleRail.jsx";
import "./Landing.css";

const RECENTS_KEY = "statsnap:recents";
const MAX_RECENTS = 5;

function Landing() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [query, setQuery] = useState(searchParams.get("q") ?? "");
  const [recents, setRecents] = useLocalStorageState(RECENTS_KEY, []);
  const navigate = useNavigate();

  const updateQuery = (value) => {
    setQuery(value);
    setSearchParams(value ? { q: value } : {}, { replace: true });
  };

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

  return (
    <div className="landing">
      <div className="landing-grid" />
      <header className="landing-topbar">
        <span className="brand-mark">
          <span className="dot" /> STAT<span className="slash">/</span>SNAP
        </span>
        <div className="meta">
          <span>
            <span className="live-dot" /> LIVE<span className="meta-detail"> · SKILL POSITIONS ONLY</span>
          </span>
          <span>v0.2</span>
        </div>
      </header>

      <ScheduleRail />

      <main className="landing-inner">
        <h1 className="wordmark">
          STAT<span className="slash">/</span>SNAP
        </h1>

        <p className="tagline">
          NFL SKILL POSITIONS &nbsp;·&nbsp; <b>INSTANT LOOKUP</b><span className="tagline-tail"> &nbsp;·&nbsp; QB · RB · WR · TE</span>
        </p>

        <div className="search-wrap">
          <PlayerSearch
            variant="hero"
            autoFocus
            value={query}
            onChange={updateQuery}
            onSelect={handlePick}
          />
        </div>

        {recents.length > 0 && (
          <ul className="recent-row">
            {recents.map((p) => (
              <li key={p.playerId} className="recent-item">
                <button
                  type="button"
                  className="recent-chip"
                  onClick={() => handlePick(p)}
                >
                  ← {p.displayName.toUpperCase()}
                </button>
              </li>
            ))}
          </ul>
        )}
      </main>

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
