import { buildSplits, SPLIT_COLUMNS } from "../../utils/splits.js";
import "./Splits.css";

// ─────────────────────────────────────────────────────────────────────────────
// Splits — situational splits for the selected season: home/away,
// wins/losses, in/out of division, first/second half. Purely derived from
// the stored weeks; no new data, no new endpoint. Every cell is the season
// definition applied to a filtered weeks array (see utils/splits.js).
// ─────────────────────────────────────────────────────────────────────────────

function Splits({ player }) {
  const columns = SPLIT_COLUMNS[player.position] ?? [];
  const groups = buildSplits(player);
  const weeks = player.weeks ?? [];

  if (columns.length === 0 || weeks.length === 0) {
    return <div className="splits-empty">No splits available.</div>;
  }

  const inProgress = player.seasonComplete === false;
  const throughWeek = Math.max(...weeks.map((w) => w.week));
  const headerLabel = inProgress ? `THROUGH WK ${throughWeek}` : `${player.season} SEASON`;

  return (
    <section className="splits-panel">
      <div className="splits-head">
        <h2 className="splits-head-label">SPLITS</h2>
        <span className="splits-head-season">{headerLabel}</span>
      </div>
      <div className="splits-scroll">
        <table className="splits-table">
          <thead>
            <tr>
              <th className="ctx">SPLIT</th>
              {columns.map((c) => <th key={c.k}>{c.k}</th>)}
            </tr>
          </thead>
          <tbody>
            <tr className="splits-row-baseline">
              <td className="ctx">FULL SEASON</td>
              {columns.map((c) => <td key={c.k}>{c.value(weeks)}</td>)}
            </tr>
          </tbody>
          {groups.map((group) => (
            <tbody key={group.label}>
              <tr className="splits-group">
                <td colSpan={columns.length + 1}>{group.label}</td>
              </tr>
              {group.rows.map((row) => (
                <tr key={row.key} className={row.games === 0 ? "splits-row-empty" : undefined}>
                  <td className="ctx">{row.label}</td>
                  {row.cells.map((cell, i) => <td key={columns[i].k}>{cell}</td>)}
                </tr>
              ))}
            </tbody>
          ))}
        </table>
      </div>
      <div className="splits-footnote">
        RATES ARE RATIO-OF-SUMS OVER THE GAMES IN EACH SPLIT, SAME DEFINITIONS AS THE SEASON TOTALS. WEEKS 1–9 IS THE FIRST HALF.
      </div>
    </section>
  );
}

export default Splits;
