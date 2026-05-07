import { useState } from "react";
import "./Landing.css";

function Landing() {
  const [query, setQuery] = useState("");

  return (
    <div className="landing">
      <div className="landing-grid" />

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
              autoFocus
              placeholder="Type a player..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <span className="kbd">⌘K</span>
          </div>
        </div>
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
