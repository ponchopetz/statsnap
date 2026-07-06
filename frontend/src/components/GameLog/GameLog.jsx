import { formatNumber, formatPercent, formatSigned, formatDecimal } from "../../utils/format.js";
import { gameCompletionPct, gameYardsPerCarry, gameYardsPerRec, combinedTds } from "../../utils/stats.js";
import "./GameLog.css";

function resultClass(result) {
  if (result === "W") return "win";
  if (result === "L") return "loss";
  return "tie";
}

const RECEIVER_COLS = [
  { k: "TGT",     value: (w) => formatNumber(w.targets) },
  { k: "REC",     value: (w) => formatNumber(w.receptions) },
  { k: "REC YDS", value: (w) => formatNumber(w.receivingYards) },
  { k: "Y/R",     value: (w) => formatDecimal(gameYardsPerRec(w), 1) },
  { k: "TD",      value: (w) => formatNumber(combinedTds(w)) },
  { k: "TGT%",    value: (w) => formatPercent(w.targetShare) },
  { k: "EPA",     value: (w) => formatSigned(w.receivingEpa, 2) },
  { k: "FPTS",    value: (w) => formatDecimal(w.fantasyPointsPpr, 1) },
];

const GAMELOG_CONFIG = {
  QB: [
    { k: "CMP",  value: (w) => formatNumber(w.completions) },
    { k: "ATT",  value: (w) => formatNumber(w.attempts) },
    { k: "CMP%", value: (w) => formatPercent(gameCompletionPct(w)) },
    { k: "YDS",  value: (w) => formatNumber(w.passingYards) },
    { k: "PASS TD", value: (w) => formatNumber(w.passingTds) },
    { k: "INT",  value: (w) => formatNumber(w.interceptions) },
    { k: "SACK", value: (w) => formatNumber(w.sacksSuffered) },
    { k: "EPA",     value: (w) => formatSigned(w.passingEpa, 2) },
    { k: "RUSH TD", value: (w) => formatNumber(w.rushingTds) },
    { k: "FPTS",    value: (w) => formatDecimal(w.fantasyPointsPpr, 1) },
  ],
  RB: [
    { k: "CAR",      value: (w) => formatNumber(w.carries) },
    { k: "RUSH YDS", value: (w) => formatNumber(w.rushingYards) },
    { k: "Y/A",      value: (w) => formatDecimal(gameYardsPerCarry(w), 1) },
    { k: "RUSH TD",  value: (w) => formatNumber(w.rushingTds) },
    { k: "TGT",      value: (w) => formatNumber(w.targets) },
    { k: "REC",      value: (w) => formatNumber(w.receptions) },
    { k: "REC YDS",  value: (w) => formatNumber(w.receivingYards) },
    { k: "REC TD",   value: (w) => formatNumber(w.receivingTds) },
    { k: "RUSH EPA", value: (w) => formatSigned(w.rushingEpa, 2) },
    { k: "FPTS",     value: (w) => formatDecimal(w.fantasyPointsPpr, 1) },
  ],
  WR: RECEIVER_COLS,
  TE: RECEIVER_COLS,
};

export default function GameLog({ player }) {
  const weeks = player.weeks ?? [];
  const columns = GAMELOG_CONFIG[player.position] ?? [];

  if (weeks.length === 0 || columns.length === 0) {
    return <div className="gamelog-empty">No game log available.</div>;
  }

  // Fill interior gaps (bye, inactive, injured) with DNP marker rows so a
  // jump from W9 to W11 reads as intentional rather than missing data.
  // Only gaps BETWEEN played games are filled — the data can't distinguish
  // why a season ended early, so trailing weeks aren't speculated about.
  const rows = [];
  weeks.forEach((w, i) => {
    if (i > 0) {
      for (let missed = weeks[i - 1].week + 1; missed < w.week; missed += 1) {
        rows.push({ dnp: true, week: missed });
      }
    }
    rows.push(w);
  });

  return (
    <section className="gamelog-panel">
      <div className="gamelog-head">
        <h2 className="gamelog-head-label">GAME LOG</h2>
        <span className="gamelog-head-count">{weeks.length} GAMES</span>
      </div>
      <div className="gamelog-scroll">
        <table className="gamelog-table">
          <thead>
            <tr>
              <th className="ctx">WK</th>
              <th className="ctx">OPP</th>
              <th className="ctx">RESULT</th>
              {columns.map((c) => <th key={c.k}>{c.k}</th>)}
            </tr>
          </thead>
          <tbody>
            {rows.map((w) => {
              if (w.dnp) {
                return (
                  <tr key={w.week} className="gamelog-dnp">
                    <td className="ctx">{w.week}</td>
                    <td className="ctx">—</td>
                    <td className="ctx">DNP</td>
                    {columns.map((c) => <td key={c.k}>—</td>)}
                  </tr>
                );
              }
              const oppPrefix = w.homeAway === "away" ? "@ " : "vs ";
              const cls = resultClass(w.result);
              const score = `${w.result} ${w.teamScore}-${w.opponentScore}${w.overtime ? " OT" : ""}`;
              return (
                <tr key={w.week}>
                  <td className="ctx">{w.week}</td>
                  <td className="ctx">{oppPrefix}{w.opponent}</td>
                  <td className={`ctx gamelog-result ${cls}`}>{score}</td>
                  {columns.map((c) => <td key={c.k}>{c.value(w)}</td>)}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
