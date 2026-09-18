import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { getLeaderboard, getSeasons } from "../../utils/api.js";
import { ADVANCED_CONFIG } from "../../utils/stats.js";
import { useSlowLoading } from "../../hooks/useSlowLoading.js";
import LoadingStatus from "../LoadingStatus/LoadingStatus.jsx";
import "./Leaderboards.css";

// ─────────────────────────────────────────────────────────────────────────────
// Leaderboards — top qualified players by advanced metric.
//
// The backend ranks by the ETL's stored percentile, so the order has one
// definition. The raw value column is formatted client-side with the same
// ADVANCED_CONFIG row the Advanced panel uses for that metric. Seasons come
// from GET /seasons (what is actually loaded), newest first.
// ─────────────────────────────────────────────────────────────────────────────

const POSITIONS = ["QB", "RB", "WR", "TE"];
const FOOTNOTE = "Percentiles ranked among qualified players — QB 150+ att, RB 50+ car, WR/TE 30+ tgt.";
// Ask for more than we show so a games filter still fills the table.
const FETCH_LIMIT = 60;
const SHOW_LIMIT = 25;
const MIN_GAMES_OPTIONS = [0, 6, 10, 14];

function Leaderboards() {
  const [searchParams, setSearchParams] = useSearchParams();

  const position = POSITIONS.includes(searchParams.get("position")) ? searchParams.get("position") : "QB";
  const metrics = ADVANCED_CONFIG[position];
  const metricParam = searchParams.get("metric");
  const metricRow = metrics.find((m) => m.key === metricParam) ?? metrics[0];
  const seasonParam = Number(searchParams.get("season"));
  const minGamesParam = Number(searchParams.get("minGames"));
  const minGames = MIN_GAMES_OPTIONS.includes(minGamesParam) ? minGamesParam : 0;

  const [seasons, setSeasons] = useState(null);
  const [status, setStatus] = useState("loading");
  const [data, setData] = useState(null);
  const [errorStatus, setErrorStatus] = useState(null);
  const slow = useSlowLoading(status === "loading");

  // Seasons are whatever the ETL has loaded; the newest is the default.
  useEffect(() => {
    const controller = new AbortController();
    getSeasons(controller.signal)
      .then((json) => setSeasons(json.seasons))
      .catch((err) => {
        if (err.name === "AbortError") return;
        setErrorStatus(err.status ?? null);
        setStatus("error");
      });
    return () => controller.abort();
  }, []);

  const season = seasons?.includes(seasonParam) ? seasonParam : seasons?.[0] ?? null;

  useEffect(() => {
    if (season == null) return undefined;
    const controller = new AbortController();
    setStatus("loading");
    getLeaderboard({ season, position, metric: metricRow.key, limit: FETCH_LIMIT }, controller.signal)
      .then((json) => {
        setData(json);
        setStatus("ready");
      })
      .catch((err) => {
        if (err.name === "AbortError") return;
        setErrorStatus(err.status ?? null);
        setStatus("error");
      });
    return () => controller.abort();
  }, [season, position, metricRow.key]);

  const visibleRows = useMemo(() => {
    if (!data?.rows) return [];
    return data.rows.filter((r) => (r.gamesPlayed ?? r.weeks?.length ?? 0) >= minGames).slice(0, SHOW_LIMIT);
  }, [data, minGames]);

  const update = (patch) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      for (const [k, v] of Object.entries(patch)) next.set(k, String(v));
      return next;
    });
  };

  const inProgress = useMemo(() => data?.rows?.some((r) => r.seasonComplete === false) ?? false, [data]);
  const throughWeek = useMemo(() => {
    if (!inProgress) return null;
    return Math.max(...data.rows.flatMap((r) => (r.weeks ?? []).map((w) => w.week)));
  }, [data, inProgress]);

  let body;
  if (seasons && seasons.length === 0) {
    body = <div className="lb-status">NO SEASONS LOADED ON THIS API YET</div>;
  } else if (status === "loading") {
    body = (
      <LoadingStatus
        className="lb-status"
        label="LOADING..."
        slowLabel="LOADING · WAKING FREE SERVER — CAN TAKE ~20S"
        slow={slow}
      />
    );
  } else if (status === "error") {
    body = (
      <div className="lb-status">
        {errorStatus === 404 ? "LEADERBOARDS ARE NOT AVAILABLE ON THIS API" : "FAILED TO LOAD LEADERBOARD"}
      </div>
    );
  } else if (!visibleRows.length) {
    body = (
      <div className="lb-status">
        {data.rows.length ? `NO QUALIFIED ${position}S WITH ${minGames}+ GAMES` : `NO QUALIFIED ${position}S FOR ${season} YET`}
      </div>
    );
  } else {
    body = (
      <div className="lb-scroll">
        <table className="lb-table">
          <thead>
            <tr>
              <th className="ctx lb-rank">#</th>
              <th className="ctx">PLAYER</th>
              <th className="ctx">TEAM</th>
              <th>GP</th>
              <th>{metricRow.label}</th>
              <th className="lb-pct-head">PCTL</th>
            </tr>
          </thead>
          <tbody>
            {visibleRows.map((row, i) => {
              const pct = row.advanced?.[metricRow.key];
              return (
                <tr key={row.playerId}>
                  <td className="ctx lb-rank">{i + 1}</td>
                  <td className="ctx">
                    <Link to={`/players/${row.playerId}?season=${season}`} className="lb-player">
                      <span className={"pos-badge " + row.position}>{row.position}</span>
                      <span className="lb-name">{row.displayName}</span>
                    </Link>
                  </td>
                  <td className="ctx lb-team">{row.team}</td>
                  <td>{row.gamesPlayed ?? (row.weeks?.length ?? "—")}</td>
                  <td className="lb-value">{metricRow.rawValue(row.weeks ?? [])}</td>
                  <td className="lb-pct">
                    <span className="lb-bar"><span className="lb-fill" style={{ width: `${(pct ?? 0) * 100}%` }} /></span>
                    <span className="lb-pct-num">{pct != null ? `P${Math.round(pct * 100)}` : "—"}</span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  }

  return (
    <div className="lb-page">
      <header className="lb-topbar">
        <Link to="/" className="back-btn">← BACK</Link>
        <div className="lb-title">
          <span className="lb-title-main">LEADERBOARDS</span>
          <span className="lb-title-sub">TOP QUALIFIED PLAYERS · BY ADVANCED METRIC</span>
        </div>
      </header>

      <div className="lb-controls">
        <div className="lb-positions" role="group" aria-label="Position">
          {POSITIONS.map((p) => (
            <button
              key={p}
              type="button"
              className={"lb-pos-btn" + (p === position ? " lb-pos-btn--active" : "")}
              aria-pressed={p === position}
              onClick={() => update({ position: p, metric: ADVANCED_CONFIG[p][0].key })}
            >
              {p}
            </button>
          ))}
        </div>
        <label className="lb-control">
          <span>METRIC</span>
          <select className="lb-select" value={metricRow.key} onChange={(e) => update({ metric: e.target.value })}>
            {metrics.map((m) => <option key={m.key} value={m.key}>{m.label}</option>)}
          </select>
        </label>
        <label className="lb-control">
          <span>SEASON</span>
          <select className="lb-select" value={season ?? ""} onChange={(e) => update({ season: e.target.value })} disabled={!seasons}>
            {(seasons ?? []).map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </label>
        <label className="lb-control">
          <span>MIN GP</span>
          <select className="lb-select" value={minGames} onChange={(e) => update({ minGames: e.target.value })}>
            {MIN_GAMES_OPTIONS.map((n) => <option key={n} value={n}>{n === 0 ? "ANY" : `${n}+`}</option>)}
          </select>
        </label>
      </div>

      <main className="lb-body">
        <section className="lb-panel">
          <div className="lb-head">
            <h2 className="lb-head-label">{position} · {metricRow.label}</h2>
            <span className="lb-head-season">{inProgress ? `THROUGH WK ${throughWeek}` : season ? `${season} SEASON` : ""}{visibleRows.length ? ` · TOP ${visibleRows.length}` : ""}</span>
          </div>
          {body}
          <div className="lb-footnote">{FOOTNOTE}</div>
        </section>
      </main>
    </div>
  );
}

export default Leaderboards;
