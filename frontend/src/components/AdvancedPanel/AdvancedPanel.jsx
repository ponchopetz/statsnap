import { useState, useEffect } from "react";
import { buildAdvancedRows } from "../../utils/stats.js";
import { STAT_GLOSSARY } from "../../utils/glossary.js";
import "./AdvancedPanel.css";

const FOOTNOTE =
  "Percentiles ranked among qualified players — QB 150+ att, RB 50+ car, WR/TE 30+ tgt.";

function AdvancedPanel({ player }) {
  const [openKey, setOpenKey] = useState(null);

  useEffect(() => {
    setOpenKey(null);
  }, [player.playerId]);

  const rows = buildAdvancedRows(player);
  const hasAdvanced = player.advanced != null;
  const inProgress = player.seasonComplete === false;
  const throughWeek = player.weeks?.length
    ? Math.max(...player.weeks.map((w) => w.week))
    : null;

  const headerLabel = inProgress ? `THROUGH WK ${throughWeek}` : `${player.season} SEASON`;

  const allOpen = openKey === "__all";
  const toggleAll = () => setOpenKey((prev) => (prev === "__all" ? null : "__all"));

  const toggleRow = (k) => {
    setOpenKey((prev) => (prev === k ? null : k));
  };

  const handleRowKeyDown = (event, k) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      toggleRow(k);
    }
  };

  const firstName = player.displayName?.split(" ").slice(0, -1).join(" ") || player.displayName;

  let body;
  if (rows.length === 0) {
    body = <div className="adv-empty">No advanced metrics for this position.</div>;
  } else if (!hasAdvanced && !inProgress) {
    body = (
      <div className="adv-empty">
        {firstName} didn&apos;t reach the qualifying threshold this season, so percentile ranks
        aren&apos;t shown.
      </div>
    );
  } else {
    body = (
      <>
        {!hasAdvanced && inProgress && (
          <div className="adv-pending">
            Percentile ranks are pending — not enough games played yet this season.
          </div>
        )}
        <ul className="adv-list">
          {rows.map((row) => {
          const isOpen = allOpen || openKey === row.k;
          const clickable = Boolean(STAT_GLOSSARY[row.k]);
          return (
            <li key={row.k} className={"adv-row" + (isOpen ? " adv-row-open" : "")}>
              <div
                className={"adv-row-main" + (clickable ? " adv-row-clickable" : "")}
                role={clickable ? "button" : undefined}
                tabIndex={clickable ? 0 : undefined}
                onClick={clickable ? () => toggleRow(row.k) : undefined}
                onKeyDown={clickable ? (e) => handleRowKeyDown(e, row.k) : undefined}
              >
                <span className="k">
                  {row.k}
                  {clickable && <span className="info-glyph">?</span>}
                </span>
                <span className="bar">
                  {row.bar !== null && (
                    <span className="fill" style={{ width: `${row.bar * 100}%` }} />
                  )}
                </span>
                <span className="pct">
                  {row.bar !== null ? `P${Math.round(row.bar * 100)}` : "—"}
                </span>
                <span className="v">{row.v}</span>
              </div>
              {isOpen && clickable && (
                <div className="adv-def">
                  <span className="adv-def-arrow">▸</span>
                  {STAT_GLOSSARY[row.k]}
                </div>
              )}
            </li>
          );
        })}
        </ul>
      </>
    );
  }

  return (
    <section className="adv-panel">
      <div className="panel-head">
        <h2 className="panel-head-label">ADVANCED</h2>
        <div className="panel-head-right">
          <span className="panel-head-season">{headerLabel}</span>
          {rows.length > 0 && (
            <button
              type="button"
              className={"key-toggle" + (allOpen ? " key-toggle--active" : "")}
              onClick={toggleAll}
            >
              {allOpen ? "✕ HIDE KEY" : "? KEY"}
            </button>
          )}
        </div>
      </div>
      {body}
      <div className="adv-footnote">{FOOTNOTE}</div>
    </section>
  );
}

export default AdvancedPanel;
