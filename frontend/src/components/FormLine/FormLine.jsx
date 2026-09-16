import { useMemo } from "react";
import { buildForm, formRecord, FORM_WINDOW } from "../../utils/form.js";
import "./FormLine.css";

// LABS (flag: form) — the last four games against the season, one cell per
// chartable headline stat, with a HOT / COLD tag when the swing is large.

function FormLine({ player }) {
  const rows = useMemo(() => buildForm(player), [player]);
  if (!rows.length) return null;

  const games = player.weeks?.length ?? 0;
  const window = Math.min(FORM_WINDOW, games);
  // A sixth cell (team record) keeps this grid the same shape as the
  // six-cell stat row above it at every breakpoint.
  const rec = formRecord(player);

  return (
    <section className="form-line" aria-label="Recent form">
      <div className="form-line-head">
        <h2 className="form-line-label">FORM</h2>
        <span className="form-line-sub">LAST {window} VS SEASON AVG · PER GAME · LABS</span>
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
                {r.trend === null && `NEED ${FORM_WINDOW + 1}+ GP`}
              </span>
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}

export default FormLine;
