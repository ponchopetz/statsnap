import { useMemo } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { usePlayerProfile } from "../../hooks/usePlayerProfile.js";
import { buildComparison } from "../../utils/compare.js";
import PlayerSearch from "../PlayerSearch/PlayerSearch.jsx";
import "./Compare.css";

// ─────────────────────────────────────────────────────────────────────────────
// PROTOTYPE (flag: compare) — head-to-head player comparison.
//
// URL is the state: /compare?a=<playerId>&b=<playerId>&season=<year>.
// Two profile fetches, no new endpoint. Rows come from utils/compare.js,
// which uses the same stats.js helpers as Overview and the Advanced panel,
// so a number here can never disagree with the player page.
// ─────────────────────────────────────────────────────────────────────────────

function IdentityCard({ player, side, onClear }) {
  const nameParts = player.displayName.split(" ");
  const last = nameParts[nameParts.length - 1];
  const first = nameParts.slice(0, -1).join(" ");
  return (
    <div className={`cmp-card cmp-card--${side}`}>
      <div className="cmp-card-photo">
        {player.headshotUrl ? (
          <img src={player.headshotUrl} alt={player.displayName} />
        ) : (
          <span className="cmp-card-jersey">{player.jerseyNumber ?? "—"}</span>
        )}
      </div>
      <div className="cmp-card-text">
        <Link to={`/players/${player.playerId}?season=${player.season}`} className="cmp-card-name">
          <span className="cmp-card-first">{first}</span>
          <span className="cmp-card-last">{last.toUpperCase()}</span>
        </Link>
        <div className="cmp-card-meta">
          <span className={"pos-badge " + player.position}>{player.position}</span>
          <span className="cmp-card-team">{player.team}</span>
          <span className="cmp-card-season">{player.season}</span>
        </div>
      </div>
      <button type="button" className="cmp-clear" onClick={onClear} aria-label={`Remove player ${side.toUpperCase()}`}>
        ×
      </button>
    </div>
  );
}

function Slot({ side, playerId, status, doc, seasons, selectedSeason, onPick, onClear }) {
  if (!playerId) {
    return (
      <div className="cmp-slot cmp-slot--empty">
        <span className="cmp-slot-label">PLAYER {side.toUpperCase()}</span>
        <PlayerSearch variant="compact" placeholder={`Add player ${side.toUpperCase()}...`} onSelect={onPick} />
      </div>
    );
  }
  if (status === "loading") return <div className="cmp-slot cmp-status">LOADING...</div>;
  if (status === "not_found") return <div className="cmp-slot cmp-status">PLAYER NOT FOUND — <button type="button" className="cmp-inline-btn" onClick={onClear}>CLEAR</button></div>;
  if (status === "error") return <div className="cmp-slot cmp-status">FAILED TO LOAD — <button type="button" className="cmp-inline-btn" onClick={onClear}>CLEAR</button></div>;
  if (!doc) {
    return (
      <div className="cmp-slot cmp-status">
        NO {selectedSeason} SEASON ON RECORD ({seasons.join(", ")})
        <button type="button" className="cmp-inline-btn" onClick={onClear}>CLEAR</button>
      </div>
    );
  }
  return (
    <div className="cmp-slot">
      <IdentityCard player={doc} side={side} onClear={onClear} />
    </div>
  );
}

function DiffRow({ row, showPct }) {
  const cls = (side) => "cmp-val" + (row.winner === side ? " cmp-val--win" : "");
  return (
    <li className="cmp-row">
      <span className={cls("a")}>
        {row.a.display}
        {showPct && <span className="cmp-pct">{row.a.pct != null ? `P${Math.round(row.a.pct * 100)}` : "—"}</span>}
      </span>
      <span className="cmp-bars">
        <span className="cmp-bar cmp-bar--a">
          <span className={"cmp-fill" + (row.winner === "a" ? " cmp-fill--win" : "")} style={{ width: `${row.a.share * 100}%` }} />
        </span>
        <span className="cmp-label">{row.label}</span>
        <span className="cmp-bar cmp-bar--b">
          <span className={"cmp-fill" + (row.winner === "b" ? " cmp-fill--win" : "")} style={{ width: `${row.b.share * 100}%` }} />
        </span>
      </span>
      <span className={cls("b")}>
        {showPct && <span className="cmp-pct">{row.b.pct != null ? `P${Math.round(row.b.pct * 100)}` : "—"}</span>}
        {row.b.display}
      </span>
    </li>
  );
}

function Compare() {
  const [searchParams, setSearchParams] = useSearchParams();
  const idA = searchParams.get("a") || "";
  const idB = searchParams.get("b") || "";
  const paramSeason = Number(searchParams.get("season"));

  const profileA = usePlayerProfile(idA || null);
  const profileB = usePlayerProfile(idB || null);

  const seasonsA = useMemo(() => profileA.data?.map((d) => d.season) ?? [], [profileA.data]);
  const seasonsB = useMemo(() => profileB.data?.map((d) => d.season) ?? [], [profileB.data]);

  // Season choices: every season either player has. Default to the latest
  // season they share, else the latest either has.
  const seasonOptions = useMemo(() => [...new Set([...seasonsA, ...seasonsB])].sort((x, y) => y - x), [seasonsA, seasonsB]);
  const shared = seasonsA.filter((s) => seasonsB.includes(s));
  const defaultSeason = shared.length ? Math.max(...shared) : seasonOptions[0];
  const selectedSeason = seasonOptions.includes(paramSeason) ? paramSeason : defaultSeason;

  const docA = idA ? profileA.data?.find((d) => d.season === selectedSeason) ?? null : null;
  const docB = idB ? profileB.data?.find((d) => d.season === selectedSeason) ?? null : null;

  const update = (patch) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      for (const [k, v] of Object.entries(patch)) {
        if (v == null || v === "") next.delete(k);
        else next.set(k, String(v));
      }
      return next;
    });
  };

  const bothLoaded = docA && docB;
  const samePosition = bothLoaded && docA.position === docB.position;
  const comparison = samePosition ? buildComparison(docA, docB) : null;

  return (
    <div className="cmp-page">
      <header className="cmp-topbar">
        <Link to="/" className="back-btn">← BACK</Link>
        <div className="cmp-title">
          <span className="cmp-title-main">COMPARE</span>
          <span className="cmp-title-sub">HEAD TO HEAD · SAME POSITION · ONE SEASON</span>
        </div>
        {seasonOptions.length > 0 && (
          <label className="cmp-season">
            <span>SEASON</span>
            <select value={selectedSeason} onChange={(e) => update({ season: e.target.value })}>
              {seasonOptions.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </label>
        )}
      </header>

      <div className="cmp-slots">
        <Slot side="a" playerId={idA} status={profileA.status} doc={docA} seasons={seasonsA} selectedSeason={selectedSeason}
          onPick={(p) => update({ a: p.playerId })} onClear={() => update({ a: null })} />
        <div className="cmp-vs">VS</div>
        <Slot side="b" playerId={idB} status={profileB.status} doc={docB} seasons={seasonsB} selectedSeason={selectedSeason}
          onPick={(p) => update({ b: p.playerId })} onClear={() => update({ b: null })} />
      </div>

      {bothLoaded && !samePosition && (
        <div className="cmp-notice">
          {docA.position} VS {docB.position} — PICK TWO PLAYERS AT THE SAME POSITION TO COMPARE STATS.
        </div>
      )}

      {comparison && (
        <main className="cmp-body">
          <section className="cmp-section">
            <h2 className="cmp-section-label">SEASON · {selectedSeason}</h2>
            <ul className="cmp-list">
              {comparison.headline.map((row) => <DiffRow key={row.key} row={row} />)}
            </ul>
          </section>
          <section className="cmp-section">
            <h2 className="cmp-section-label">
              ADVANCED · PERCENTILE VS {docA.position}S
              {(docA.advanced == null || docB.advanced == null) && (
                <span className="cmp-section-note"> · A PLAYER BELOW THE QUALIFIER SHOWS RAW VALUES ONLY</span>
              )}
            </h2>
            <ul className="cmp-list">
              {comparison.advanced.map((row) => <DiffRow key={row.key} row={row} showPct />)}
            </ul>
            <div className="cmp-footnote">
              BARS ARE POSITION-COHORT PERCENTILES. HIGHER IS BETTER, INCLUDING SACKS (RANKED INVERTED BY THE ETL). HIGHLIGHTED VALUE WINS THE ROW.
            </div>
          </section>
        </main>
      )}

      {!idA && !idB && (
        <div className="cmp-empty">
          PICK TWO PLAYERS. THE URL IS THE SHARE LINK.
        </div>
      )}
    </div>
  );
}

export default Compare;
