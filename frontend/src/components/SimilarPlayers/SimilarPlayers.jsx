import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getSimilarPlayers } from "../../utils/api.js";
import "./SimilarPlayers.css";

// LABS (flag: similar) — "plays like" comps under the Advanced panel.
// Nearest percentile profiles in the same position cohort, from
// GET /players/:id/similar. THIS SEASON compares against the same season;
// ALL SEASONS compares against every loaded season of every other player at
// the position. Each row links straight into Compare, cross-season when
// needed.

const SCOPES = [
  { key: "season", label: "THIS SEASON" },
  { key: "all", label: "ALL SEASONS" },
];

function SimilarPlayers({ player }) {
  const [scope, setScope] = useState("season");
  const [state, setState] = useState({ status: "loading", data: null });

  useEffect(() => {
    const controller = new AbortController();
    setState({ status: "loading", data: null });
    getSimilarPlayers(player.playerId, player.season, controller.signal, scope)
      .then((data) => setState({ status: "ready", data }))
      .catch((err) => {
        if (err.name === "AbortError") return;
        setState({ status: err.status === 404 ? "unavailable" : "error", data: null });
      });
    return () => controller.abort();
  }, [player.playerId, player.season, scope]);

  // The API does not expose the route (flag off there): show nothing rather
  // than an error for a feature the reader never asked for.
  if (state.status === "unavailable") return null;

  const compareHref = (s) => {
    const params = new URLSearchParams({ a: player.playerId, b: s.playerId, as: player.season, bs: s.season ?? player.season });
    return `/compare?${params}`;
  };

  let body;
  if (state.status === "loading") {
    body = <div className="sim-status">FINDING COMPS...</div>;
  } else if (state.status === "error") {
    body = <div className="sim-status">COMPS UNAVAILABLE</div>;
  } else if (!state.data.qualified) {
    body = <div className="sim-status">NO PERCENTILE PROFILE TO MATCH BELOW THE QUALIFIER.</div>;
  } else if (!state.data.similar.length) {
    body = <div className="sim-status">NO OTHER QUALIFIED {player.position}S{scope === "season" ? " THIS SEASON" : ""}.</div>;
  } else {
    body = (
      <ol className="sim-list">
        {state.data.similar.map((s, i) => (
          <li key={`${s.playerId}-${s.season}`} className="sim-row">
            <span className="sim-rank">{i + 1}</span>
            <Link className="sim-name" to={compareHref(s)} title={`Compare with ${s.displayName}`}>
              {s.displayName}
            </Link>
            <span className="sim-team">
              {s.team}
              {scope === "all" && s.season != null && <span className="sim-season"> · {s.season}</span>}
            </span>
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
        <div className="panel-head-right">
          <span className="panel-head-season">{scope === "season" ? `${player.season} ${player.position}S` : `ALL ${player.position} SEASONS`} · LABS</span>
          <div className="sim-scopes" role="group" aria-label="Scope">
            {SCOPES.map((s) => (
              <button key={s.key} type="button" className={"sim-scope-btn" + (s.key === scope ? " sim-scope-btn--active" : "")} aria-pressed={s.key === scope} onClick={() => setScope(s.key)}>
                {s.label}
              </button>
            ))}
          </div>
        </div>
      </div>
      {body}
      <div className="sim-footnote">NEAREST PERCENTILE PROFILES ACROSS THE RANKED METRICS, EPA WEIGHTED DOUBLE. CLICK A NAME TO COMPARE.</div>
    </section>
  );
}

export default SimilarPlayers;
