import { useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { usePlayerProfile } from "../../hooks/usePlayerProfile.js";
import { buildComparison } from "../../utils/compare.js";
import PlayerSearch from "../PlayerSearch/PlayerSearch.jsx";
import "./Compare.css";

// ─────────────────────────────────────────────────────────────────────────────
// Compare — head-to-head, two players at the same position.
//
// URL is the state: /compare?a=<id>&b=<id>&season=<year>&as=<year>&bs=<year>
//   season   default season for both slots (what the player-page button sets)
//   as / bs  per-slot override, so a 2022 season can face a 2024 one
// Two profile fetches, no new endpoint. Rows come from utils/compare.js,
// which reads the same headline and advanced definitions the player page
// renders, so a number here can never disagree with the player page.
// ─────────────────────────────────────────────────────────────────────────────

function IdentityCard({ player, side, seasons, onSeason, onClear }) {
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
          <label className="cmp-card-season">
            <span className="visually-hidden">Season for player {side.toUpperCase()}</span>
            <select value={player.season} onChange={(e) => onSeason(Number(e.target.value))}>
              {seasons.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </label>
        </div>
      </div>
      <button type="button" className="cmp-clear" onClick={onClear} aria-label={`Remove player ${side.toUpperCase()}`}>
        ×
      </button>
    </div>
  );
}

function Slot({ side, playerId, status, doc, seasons, onPick, onSeason, onClear }) {
  if (!playerId) {
    return (
      <div className="cmp-slot cmp-slot--empty">
        <span className="cmp-slot-label">PLAYER {side.toUpperCase()}</span>
        <PlayerSearch variant="compact" placeholder={`Add player ${side.toUpperCase()}...`} onSelect={onPick} />
      </div>
    );
  }
  if (status === "loading") return <div className="cmp-slot cmp-status">LOADING...</div>;
  if (status === "not_found") {
    return (
      <div className="cmp-slot cmp-status">
        PLAYER NOT FOUND <button type="button" className="cmp-inline-btn" onClick={onClear}>CLEAR</button>
      </div>
    );
  }
  if (status === "error" || !doc) {
    return (
      <div className="cmp-slot cmp-status">
        FAILED TO LOAD <button type="button" className="cmp-inline-btn" onClick={onClear}>CLEAR</button>
      </div>
    );
  }
  return (
    <div className="cmp-slot">
      <IdentityCard player={doc} side={side} seasons={seasons} onSeason={onSeason} onClear={onClear} />
    </div>
  );
}

function DiffRow({ row, showPct }) {
  const cls = (side) => "cmp-val" + (row.winner === side ? " cmp-val--win" : "");
  const pct = (side) => (row[side].pct != null ? `P${Math.round(row[side].pct * 100)}` : "—");
  return (
    <li className="cmp-row">
      <span className={cls("a")}>
        {row.a.display}
        {showPct && <span className="cmp-pct">{pct("a")}</span>}
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
        {showPct && <span className="cmp-pct">{pct("b")}</span>}
        {row.b.display}
      </span>
    </li>
  );
}

// Picks the season a slot shows: its own override, then the shared default,
// then the latest season the two players share, then the player's latest.
function pickSeason(own, shared, mine, theirs) {
  if (mine.includes(own)) return own;
  if (mine.includes(shared)) return shared;
  const common = mine.filter((s) => theirs.includes(s));
  if (common.length) return Math.max(...common);
  return mine[0] ?? null;
}

function Compare() {
  const [searchParams, setSearchParams] = useSearchParams();
  const idA = searchParams.get("a") || "";
  const idB = searchParams.get("b") || "";
  const shared = Number(searchParams.get("season"));
  const ownA = Number(searchParams.get("as"));
  const ownB = Number(searchParams.get("bs"));

  const profileA = usePlayerProfile(idA || null);
  const profileB = usePlayerProfile(idB || null);

  const seasonsA = useMemo(() => profileA.data?.map((d) => d.season) ?? [], [profileA.data]);
  const seasonsB = useMemo(() => profileB.data?.map((d) => d.season) ?? [], [profileB.data]);

  const seasonA = pickSeason(ownA, shared, seasonsA, seasonsB);
  const seasonB = pickSeason(ownB, shared, seasonsB, seasonsA);

  const docA = idA ? profileA.data?.find((d) => d.season === seasonA) ?? null : null;
  const docB = idB ? profileB.data?.find((d) => d.season === seasonB) ?? null : null;

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

  const swap = () => update({ a: idB, b: idA, as: ownB || null, bs: ownA || null });

  const [copied, setCopied] = useState(false);
  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard blocked: the address bar still has the link */
    }
  };

  const bothLoaded = docA && docB;
  const samePosition = bothLoaded && docA.position === docB.position;
  const comparison = samePosition ? buildComparison(docA, docB) : null;
  const seasonLabel = bothLoaded && docA.season !== docB.season ? `${docA.season} VS ${docB.season}` : docA?.season ?? docB?.season;

  return (
    <div className="cmp-page">
      <header className="cmp-topbar">
        <Link to="/" className="back-btn">← BACK</Link>
        <div className="cmp-title">
          <span className="cmp-title-main">COMPARE</span>
          <span className="cmp-title-sub">HEAD TO HEAD · SAME POSITION · ANY SEASON</span>
        </div>
        <div className="cmp-actions">
          {idA && idB && (
            <button type="button" className="back-btn" onClick={swap} aria-label="Swap players">
              ⇄ SWAP
            </button>
          )}
          {(idA || idB) && (
            <button type="button" className="back-btn" onClick={copyLink}>
              {copied ? "✓ COPIED" : "COPY LINK"}
            </button>
          )}
        </div>
      </header>

      <div className="cmp-slots">
        <Slot side="a" playerId={idA} status={profileA.status} doc={docA} seasons={seasonsA}
          onPick={(p) => update({ a: p.playerId, as: null })} onSeason={(s) => update({ as: s })} onClear={() => update({ a: null, as: null })} />
        <div className="cmp-vs">VS</div>
        <Slot side="b" playerId={idB} status={profileB.status} doc={docB} seasons={seasonsB}
          onPick={(p) => update({ b: p.playerId, bs: null })} onSeason={(s) => update({ bs: s })} onClear={() => update({ b: null, bs: null })} />
      </div>

      {bothLoaded && !samePosition && (
        <div className="cmp-notice">
          {docA.position} VS {docB.position} — PICK TWO PLAYERS AT THE SAME POSITION TO COMPARE STATS.
        </div>
      )}

      {comparison && (
        <main className="cmp-body">
          <section className="cmp-section">
            <h2 className="cmp-section-label">SEASON · {seasonLabel}</h2>
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
              BARS ARE POSITION-COHORT PERCENTILES FOR EACH PLAYER&apos;S OWN SEASON. HIGHER IS BETTER, INCLUDING SACKS (RANKED INVERTED BY THE ETL). HIGHLIGHTED VALUE WINS THE ROW.
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
