import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getSimilarPlayers } from "../../utils/api.js";
import "./SimilarPlayers.css";

// LABS (flag: similar) — "plays like" comps under the Advanced panel.
// Nearest percentile profiles in the same position cohort and season, from
// GET /players/:id/similar. Each row links straight into Compare.

function SimilarPlayers({ player }) {
  const [state, setState] = useState({ status: "loading", data: null });

  useEffect(() => {
    const controller = new AbortController();
    setState({ status: "loading", data: null });
    getSimilarPlayers(player.playerId, player.season, controller.signal)
      .then((data) => setState({ status: "ready", data }))
      .catch((err) => {
        if (err.name === "AbortError") return;
        setState({ status: err.status === 404 ? "unavailable" : "error", data: null });
      });
    return () => controller.abort();
  }, [player.playerId, player.season]);

  // The API does not expose the route (flag off there): show nothing rather
  // than an error for a feature the reader never asked for.
  if (state.status === "unavailable") return null;

  let body;
  if (state.status === "loading") {
    body = <div className="sim-status">FINDING COMPS...</div>;
  } else if (state.status === "error") {
    body = <div className="sim-status">COMPS UNAVAILABLE</div>;
  } else if (!state.data.qualified) {
    body = <div className="sim-status">NO PERCENTILE PROFILE TO MATCH BELOW THE QUALIFIER.</div>;
  } else if (!state.data.similar.length) {
    body = <div className="sim-status">NO OTHER QUALIFIED {player.position}S THIS SEASON.</div>;
  } else {
    body = (
      <ol className="sim-list">
        {state.data.similar.map((s, i) => (
          <li key={s.playerId} className="sim-row">
            <span className="sim-rank">{i + 1}</span>
            <Link
              className="sim-name"
              to={`/compare?a=${encodeURIComponent(player.playerId)}&b=${encodeURIComponent(s.playerId)}&season=${player.season}`}
              title={`Compare with ${s.displayName}`}
            >
              {s.displayName}
            </Link>
            <span className="sim-team">{s.team}</span>
            <span className="sim-bar"><span className="sim-fill" style={{ width: `${Math.max(0, s.similarity) * 100}%` }} /></span>
            <span className="sim-pct">{Math.round(s.similarity * 100)}%</span>
          </li>
        ))}
      </ol>
    );
  }

  return (
    <section className="sim-panel" aria-label="Similar players">
      <div className="panel-head">
        <h2 className="panel-head-label">PLAYS LIKE</h2>
        <span className="panel-head-season">{player.season} {player.position}S · LABS</span>
      </div>
      {body}
      <div className="sim-footnote">NEAREST PERCENTILE PROFILES ACROSS THE RANKED METRICS. CLICK A NAME TO COMPARE.</div>
    </section>
  );
}

export default SimilarPlayers;
