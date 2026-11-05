import { useRef } from "react";
import { Link } from "react-router-dom";
import { usePulseSync } from "../../hooks/usePulseSync.js";
import { version } from "../../../package.json";
import "./SiteHeader.css";

// Persistent global header rendered above every route (App.jsx). The wordmark
// is the universal home link; the meta block carries app-level status.
function SiteHeader() {
  const liveDotRef = useRef(null);
  usePulseSync(liveDotRef);

  return (
    <header className="site-header">
      <Link to="/" className="brand-mark" aria-label="StatSnap home">
        <span className="dot" /> STAT<span className="slash">/</span>SNAP
      </Link>
      <div className="meta">
        <span>
          <span className="live-dot" ref={liveDotRef} /> LIVE<span className="meta-detail"> · SKILL POSITIONS ONLY</span>
        </span>
        <span>v{version}</span>
      </div>
    </header>
  );
}

export default SiteHeader;
