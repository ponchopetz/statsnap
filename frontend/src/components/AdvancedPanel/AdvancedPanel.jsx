import { useState, useEffect, useId } from "react";
import { buildAdvancedRows, groupRows } from "../../utils/stats.js";
import { STAT_GLOSSARY } from "../../utils/glossary.js";
import "./AdvancedPanel.css";

const FOOTNOTE =
  "Percentiles ranked among qualified players — QB 150+ att, RB 50+ car, WR/TE 30+ tgt. " +
  "Next Gen Stats cover players above its own volume minimum. PFR charting starts in 2018.";

const slug = (name) => name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

// Header preview of a collapsed group: its first row that has a value.
function peekText(rows) {
  const row = rows.find((r) => r.v !== "—");
  if (!row) return "—";
  const pct = row.bar !== null ? ` · P${Math.round(row.bar * 100)}` : "";
  return `${row.k} · ${row.v}${pct}`;
}

function AdvancedPanel({ player }) {
  const [openKey, setOpenKey] = useState(null);
  // null = default (first group only); a Set once the user toggles a group.
  const [openGroups, setOpenGroups] = useState(null);
  const [showAll, setShowAll] = useState(false);
  const idPrefix = useId();

  useEffect(() => {
    setOpenKey(null);
    setOpenGroups(null);
    setShowAll(false);
  }, [player.playerId, player.season]);

  const rows = buildAdvancedRows(player);
  const groups = groupRows(rows);
  const currentOpen = openGroups ?? new Set(groups.slice(0, 1).map((g) => g.group));
  const hasAdvanced = player.advanced != null;
  const inProgress = player.seasonComplete === false;
  const throughWeek = player.weeks?.length
    ? Math.max(...player.weeks.map((w) => w.week))
    : null;

  const headerLabel = inProgress ? `THROUGH WK ${throughWeek}` : `${player.season} SEASON`;

  const allOpen = showAll;
  const toggleAll = () => setShowAll((prev) => !prev);

  const toggleGroup = (name) => {
    const next = new Set(currentOpen);
    if (!next.delete(name)) next.add(name);
    setOpenGroups(next);
  };

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
        {groups.map(({ group, rows: groupRowsList }) => {
          const groupOpen = allOpen || currentOpen.has(group);
          const listId = `${idPrefix}-${slug(group)}`;
          return (
            <div key={group} className={"adv-group" + (groupOpen ? " adv-group-open" : "")}>
              <button
                type="button"
                className="adv-group-head"
                aria-expanded={groupOpen}
                aria-controls={listId}
                onClick={() => toggleGroup(group)}
              >
                <span className="adv-group-chev" aria-hidden="true">{groupOpen ? "▾" : "▸"}</span>
                <span className="adv-group-name">{group}</span>
                <span className="adv-group-count">{groupRowsList.length}</span>
                <span className="adv-group-peek" aria-hidden="true">{peekText(groupRowsList)}</span>
              </button>
              <ul className="adv-list" id={listId} hidden={!groupOpen}>
                {groupRowsList.map((row) => {
                  const isOpen = allOpen || openKey === row.k;
                  const clickable = Boolean(STAT_GLOSSARY[row.k]);
                  return (
                    <li
                      key={row.k}
                      className={
                        "adv-row" +
                        (row.direction === "style" ? " adv-row--style" : "") +
                        (isOpen ? " adv-row-open" : "")
                      }
                    >
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
            </div>
          );
        })}
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
