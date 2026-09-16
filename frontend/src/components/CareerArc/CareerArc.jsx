import { useMemo, useState } from "react";
import Sparkline from "../Sparkline/Sparkline.jsx";
import { arcOptions, buildCareerArc } from "../../utils/careerArc.js";
import "./CareerArc.css";

// LABS (flag: careerArc) — one headline stat across every loaded season,
// with the player's age that season under each point.

function CareerArc({ data }) {
  const position = data?.[0]?.position;
  const options = useMemo(() => arcOptions(position), [position]);
  const [key, setKey] = useState(() => options.find((o) => o.primary)?.key ?? options[0]?.key);

  const { points, row } = useMemo(() => buildCareerArc(data, key), [data, key]);
  if (!row || points.length < 2) return null;

  const values = points.map((p) => p.value);
  const valid = values.filter((v) => v != null);
  const best = valid.length ? Math.max(...valid) : null;
  const bestPoint = points.find((p) => p.value === best);

  return (
    <section className="arc" aria-label="Career arc">
      <div className="arc-head">
        <h2 className="arc-label">CAREER ARC</h2>
        <div className="arc-options" role="group" aria-label="Stat">
          {options.map((o) => (
            <button
              key={o.key}
              type="button"
              className={"arc-btn" + (o.key === row.key ? " arc-btn--active" : "")}
              aria-pressed={o.key === row.key}
              onClick={() => setKey(o.key)}
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
          <span className="arc-stat-value">{points.length}</span>
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
      <div className="arc-footnote">SEASON TOTALS AND RATES, SAME DEFINITIONS AS THE CAREER TABLE. AGE ON 1 SEPTEMBER OF EACH SEASON · LABS</div>
    </section>
  );
}

export default CareerArc;
