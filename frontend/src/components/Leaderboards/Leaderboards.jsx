import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { getLeaderboard } from "../../utils/api.js";
import { ADVANCED_CONFIG } from "../../utils/stats.js";
import { useSlowLoading } from "../../hooks/useSlowLoading.js";
import "./Leaderboards.css";

// ─────────────────────────────────────────────────────────────────────────────
// PROTOTYPE (flag: leaderboards) — top qualified players by advanced metric.
//
// The backend ranks by the ETL's stored percentile, so the order has one
// definition. The raw value column is formatted client-side with the same
// ADVANCED_CONFIG row the Advanced panel uses for that metric.
// ─────────────────────────────────────────────────────────────────────────────

const POSITIONS = ["QB", "RB", "WR", "TE"];
// Loaded seasons (README). A /seasons endpoint would replace this list.
const SEASONS = [2026, 2025, 2024, 2023, 2022, 2021, 2020, 2019, 2018, 2017, 2016];
const DEFAULT_SEASON = 2025;
const FOOTNOTE = "Percentiles ranked among qualified players — QB 150+ att, RB 50+ car, WR/TE 30+ tgt.";

function Leaderboards() {
  const [searchParams, setSearchParams] = useSearchParams();

  const position = POSITIONS.includes(searchParams.get("position")) ? searchParams.get("position") : "QB";
  const metrics = ADVANCED_CONFIG[position];
  const metricParam = searchParams.get("metric");
  const metricRow = metrics.find((m) => m.key === metricParam) ?? metrics[0];
  const seasonParam = Number(searchParams.get("season"));
  const season = SEASONS.includes(seasonParam) ? seasonParam : DEFAULT_SEASON;

  const [status, setStatus] = useState("loading");
  const [data, setData] = useState(null);
  const [errorStatus, setErrorStatus] = useState(null);
  const slow = useSlowLoading(status === "loading");

  useEffect(() => {
    const controller = new AbortController();
    setStatus("loading");
    getLeaderboard({ season, position, metric: metricRow.key }, controller.signal)
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
  if (status === "loading") {
    body = <div className="lb-status">{slow ? "LOADING · WAKING FREE SERVER — CAN TAKE ~20S" : "LOADING..."}</div>;
  } else if (status === "error") {
    body = (
      <div className="lb-status">
        {errorStatus === 404
          ? "LEADERBOARDS ARE SWITCHED OFF ON THIS API (FEATURE_LEADERBOARDS)"
          : "FAILED TO LOAD LEADERBOARD"}
      </div>
    );
  } else if (!data.rows.length) {
    body = <div className="lb-status">NO QUALIFIED {position}S FOR {season} YET</div>;
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
            {data.rows.map((row, i) => {
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
          <select className="lb-select" value={season} onChange={(e) => update({ season: e.target.value })}>
            {SEASONS.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </label>
      </div>

      <main className="lb-body">
        <section className="lb-panel">
          <div className="lb-head">
            <h2 className="lb-head-label">{position} · {metricRow.label}</h2>
            <span className="lb-head-season">{inProgress ? `THROUGH WK ${throughWeek}` : `${season} SEASON`}{data?.count ? ` · TOP ${data.count}` : ""}</span>
          </div>
          {body}
          <div className="lb-footnote">{FOOTNOTE}</div>
        </section>
      </main>
    </div>
  );
}

export default Leaderboards;
