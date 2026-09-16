import { useMemo, useState } from "react";
import { buildForm, formRecord, FORM_WINDOW, FORM_WINDOWS } from "../../utils/form.js";
import "./FormLine.css";

// LABS (flag: form) — the last four games against the season, one cell per
// chartable headline stat, with a HOT / COLD tag when the swing is large.

function FormLine({ player }) {
  const [windowSize, setWindowSize] = useState(FORM_WINDOW);
  const rows = useMemo(() => buildForm(player, windowSize), [player, windowSize]);
  if (!rows.length) return null;

  const games = player.weeks?.length ?? 0;
  const window = Math.min(windowSize, games);
  // A sixth cell (team record) keeps this grid the same shape as the
  // six-cell stat row above it at every breakpoint.
  const rec = formRecord(player, windowSize);

  return (
    <section className="form-line" aria-label="Recent form">
      <div className="form-line-head">
        <h2 className="form-line-label">FORM</h2>
        <div className="form-line-right">
          <span className="form-line-sub">LAST {window} VS SEASON AVG · PER GAME · LABS</span>
          <div className="form-windows" role="group" aria-label="Window">
            {FORM_WINDOWS.map((n) => (
              <button key={n} type="button" className={"form-window-btn" + (n === windowSize ? " form-window-btn--active" : "")} aria-pressed={n === windowSize} onClick={() => setWindowSize(n)}>
                L{n}
              </button>
            ))}
          </div>
        </div>
      </div>
      <div className="form-line-grid">
        <div className="form-cell">
          <span className="form-cell-label">RECORD</span>
          <span className="form-cell-value">{rec.recent}</span>
          <span className="form-cell-meta">
            <span>SZN {rec.season}</span>
            <span className="form-cell-tag">TEAM W-L</span>
          </span>
        </div>
        {rows.map((r) => (
          <div key={r.key} className={"form-cell" + (r.trend ? ` form-cell--${r.trend}` : "")}>
            <span className="form-cell-label">{r.label}</span>
            <span className="form-cell-value">{r.recent != null ? r.format(r.recent) : "—"}</span>
            <span className="form-cell-meta">
              <span>SZN {r.season != null ? r.format(r.season) : "—"}</span>
              <span className="form-cell-tag">
                {r.trend === "hot" && "▲ HOT"}
                {r.trend === "cold" && "▼ COLD"}
                {r.trend === "even" && "EVEN"}
                {r.trend === null && (r.season == null ? "NO DATA" : `NEED ${windowSize + 1}+ GP`)}
              </span>
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}

export default FormLine;
