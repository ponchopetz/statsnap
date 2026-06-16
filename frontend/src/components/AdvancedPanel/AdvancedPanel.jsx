import { useState, useEffect } from "react";
import { buildAdvancedRows } from "../../utils/stats.js";
import "./AdvancedPanel.css";

const STAT_GLOSSARY = {
  "Target Share": "Share of the team's pass attempts thrown to this player. League WR1 ≈ 25–30%.",
  "Air Yards Share": "Share of the team's total air yards (downfield distance on all targets) accounted for by this player.",
  "WOPR": "Weighted Opportunity Rating — combines target share (1.5×) and air-yards share (0.7×). Single number for receiving opportunity. 0.50+ is elite.",
  "RACR": "Receiver Air Conversion Ratio — receiving yards ÷ air yards thrown his way. >1.0 means he's adding yards beyond what was thrown.",
  "Receiving Air Yards": "Total downfield distance of every pass thrown to him, whether caught or not.",
  "YAC / Rec": "Yards After Catch per Reception. Pure with-ball production.",
  "Receiving EPA": "Expected Points Added on plays targeting him. Captures yards + situation (down, distance, field position).",
  "Rushing EPA": "Expected Points Added on his carries. Positive = above league expectation given the down & distance.",
  "Passing EPA": "Expected Points Added per dropback. The single best holistic QB efficiency stat.",
  "PACR": "Passing Air Conversion Ratio — passing yards ÷ passing air yards. Measures how well the QB realizes his intended depth.",
  "Passing CPOE": "Completion Percentage Over Expected. How much better (or worse) the QB completes vs. league average on similar throws.",
  "Passing Air Yards": "Total downfield distance of every pass attempt, completed or not.",
  "Avg Depth of Target": "aDOT — average depth past the line of scrimmage on the QB's targets.",
};

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
        {rows.map((row) => {
          const isOpen = openKey === "__all" || openKey === row.k;
          const clickable = Boolean(STAT_GLOSSARY[row.k]);
          return (
            <div key={row.k} className={"adv-row" + (isOpen ? " adv-row-open" : "")}>
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
                <span className="v">{row.v}</span>
              </div>
              {isOpen && clickable && (
                <div className="adv-def">
                  <span className="adv-def-arrow">▸</span>
                  {STAT_GLOSSARY[row.k]}
                </div>
              )}
            </div>
          );
        })}
      </>
    );
  }

  return (
    <div className="adv-panel">
      <div className="panel-head">
        <span className="panel-head-label">ADVANCED</span>
        <div className="panel-head-right">
          <span className="panel-head-season">{headerLabel}</span>
          {rows.length > 0 && (
            <button type="button" className="key-toggle" onClick={toggleAll}>
              {openKey === "__all" ? "✕ HIDE KEY" : "? KEY"}
            </button>
          )}
        </div>
      </div>
      {body}
      <div className="adv-footnote">{FOOTNOTE}</div>
    </div>
  );
}

export default AdvancedPanel;
