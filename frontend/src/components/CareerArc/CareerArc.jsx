import { useMemo, useState } from "react";
import Sparkline from "../Sparkline/Sparkline.jsx";
import { ARC_MODES, arcOptions, buildCareerArc } from "../../utils/careerArc.js";
import "./CareerArc.css";

// Career arc — one stat across every loaded season with the player's age
// under each point. TOTALS plots a headline stat; PERCENTILE plots the
// ETL's position-cohort rank for an advanced metric, so "was he better in
// 2022 or 2024" is answered against his peers, not just his own totals.

const MODE_LABEL = { totals: "TOTALS", percentile: "PERCENTILE" };

function CareerArc({ data }) {
  const position = data?.[0]?.position;
  const [mode, setMode] = useState("totals");
  const [keys, setKeys] = useState({ totals: null, percentile: null });
  const options = useMemo(() => arcOptions(position, mode), [position, mode]);

  const { points, row } = useMemo(() => buildCareerArc(data, keys[mode], mode), [data, keys, mode]);
  if (!row || points.length < 2) return null;

  const values = points.map((p) => p.value);
  const valid = values.filter((v) => v != null);
  const best = valid.length ? Math.max(...valid) : null;
  const bestPoint = points.find((p) => p.value === best);
  const unranked = mode === "percentile" ? points.filter((p) => p.value == null).length : 0;

  return (
    <section className="arc" aria-label="Career arc">
      <div className="arc-head">
        <div className="arc-head-left">
          <h2 className="arc-label">CAREER ARC</h2>
          <div className="arc-options arc-modes" role="group" aria-label="Mode">
            {ARC_MODES.map((m) => (
              <button key={m} type="button" className={"arc-btn" + (m === mode ? " arc-btn--active" : "")} aria-pressed={m === mode} onClick={() => setMode(m)}>
                {MODE_LABEL[m]}
              </button>
            ))}
          </div>
        </div>
        <div className="arc-options" role="group" aria-label="Stat">
          {options.map((o) => (
            <button
              key={o.key}
              type="button"
              className={"arc-btn" + (o.key === row.key ? " arc-btn--active" : "")}
              aria-pressed={o.key === row.key}
              onClick={() => setKeys((k) => ({ ...k, [mode]: o.key }))}
            >
              {o.label}
            </button>
          ))}
        </div>
      </div>
      <div className="arc-stats">
        <div>
          <span className="arc-stat-label">BEST</span>
          <span className="arc-stat-value">{best != null ? row.format(best) : "—"}{bestPoint ? ` · ${bestPoint.season}` : ""}</span>
        </div>
        <div>
          <span className="arc-stat-label">SEASONS</span>
          <span className="arc-stat-value">{points.length}{unranked ? ` · ${unranked} UNRANKED` : ""}</span>
        </div>
      </div>
      <div className="arc-chart">
        <Sparkline data={values} />
      </div>
      <div className="arc-axis" style={{ gridTemplateColumns: `repeat(${points.length}, 1fr)` }}>
        {points.map((p) => (
          <span key={p.season} className="arc-tick">
            <span className="arc-tick-season">{p.season}</span>
            <span className="arc-tick-age">{p.age != null ? `AGE ${p.age}` : ""}</span>
            <span className="arc-tick-value">{p.value != null ? row.format(p.value) : "—"}</span>
          </span>
        ))}
      </div>
      <div className="arc-footnote">
        {mode === "percentile"
          ? `PERCENTILE VS ${position}S EACH SEASON, FROM THE ETL RANKING. A SEASON BELOW THE QUALIFIER HAS NO RANK AND DRAWS AS A GAP. AGE ON 1 SEPTEMBER.`
          : "SEASON TOTALS AND RATES, SAME DEFINITIONS AS THE CAREER TABLE. AGE ON 1 SEPTEMBER OF EACH SEASON."}
      </div>
    </section>
  );
}

export default CareerArc;
