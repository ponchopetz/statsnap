import { sumWeeks, completionPct, totalTouchdowns, averageWeeks, seasonPassingEpa } from "../../utils/stats.js";
import { formatNumber, formatPercent, formatSigned } from "../../utils/format.js";
import "./Career.css";

const QB_COLUMNS = [
  { k: "GP",       value: (d) => formatNumber(d.gamesPlayed) },
  { k: "CMP%",     value: (d) => formatPercent(completionPct(d.weeks)) },
  { k: "PASS YDS", value: (d) => formatNumber(sumWeeks(d.weeks, "passingYards")) },
  { k: "PASS TD",  value: (d) => formatNumber(sumWeeks(d.weeks, "passingTds")) },
  { k: "INT",      value: (d) => formatNumber(sumWeeks(d.weeks, "interceptions")) },
  { k: "PASS EPA", value: (d) => formatSigned(seasonPassingEpa(d.weeks)) },
];

const RB_COLUMNS = [
  { k: "GP",       value: (d) => formatNumber(d.gamesPlayed) },
  { k: "CARRIES",  value: (d) => formatNumber(sumWeeks(d.weeks, "carries")) },
  { k: "RUSH YDS", value: (d) => formatNumber(sumWeeks(d.weeks, "rushingYards")) },
  { k: "TOTAL TD", value: (d) => formatNumber(totalTouchdowns(d.weeks)) },
  { k: "REC",      value: (d) => formatNumber(sumWeeks(d.weeks, "receptions")) },
  { k: "REC YDS",  value: (d) => formatNumber(sumWeeks(d.weeks, "receivingYards")) },
];

const RECEIVER_COLUMNS = [
  { k: "GP",        value: (d) => formatNumber(d.gamesPlayed) },
  { k: "TGT",       value: (d) => formatNumber(sumWeeks(d.weeks, "targets")) },
  { k: "REC",       value: (d) => formatNumber(sumWeeks(d.weeks, "receptions")) },
  { k: "REC YDS",   value: (d) => formatNumber(sumWeeks(d.weeks, "receivingYards")) },
  { k: "TOTAL TD",  value: (d) => formatNumber(totalTouchdowns(d.weeks)) },
  { k: "TGT SHARE", value: (d) => formatPercent(averageWeeks(d.weeks, "targetShare")) },
];

const CAREER_CONFIG = {
  QB: QB_COLUMNS,
  RB: RB_COLUMNS,
  WR: RECEIVER_COLUMNS,
  TE: RECEIVER_COLUMNS,
};

function Career({ data }) {
  if (!data?.length) {
    return <div className="career-empty">No career data available.</div>;
  }

  const position = data[0].position;
  const columns = CAREER_CONFIG[position] ?? [];

  if (columns.length === 0) {
    return <div className="career-empty">No career data available.</div>;
  }

  const seasonRows = [...data].reverse();

  const careerRow = {
    season: "CAREER",
    team: "—",
    gamesPlayed: data.reduce((acc, d) => acc + (d.gamesPlayed ?? 0), 0),
    weeks: data.flatMap((d) => d.weeks ?? []),
  };

  const rows = data.length > 1 ? [...seasonRows, careerRow] : seasonRows;

  return (
    <div className="career-panel">
      <div className="career-head">
        <span className="career-head-label">CAREER</span>
        <span className="career-head-count">{data.length} {data.length === 1 ? "SEASON" : "SEASONS"}</span>
      </div>
      <div className="career-scroll">
        <table className="career-table">
          <thead>
            <tr>
              <th className="ctx">SEASON</th>
              <th className="ctx">TEAM</th>
              {columns.map((c) => <th key={c.k}>{c.k}</th>)}
            </tr>
          </thead>
          <tbody>
            {rows.map((d) => {
              const isTotal = d.season === "CAREER";
              return (
                <tr key={d.season} className={isTotal ? "career-row-total" : undefined}>
                  <td className="ctx">{d.season}</td>
                  <td className="ctx">{d.team}</td>
                  {columns.map((c) => <td key={c.k}>{c.value(d)}</td>)}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default Career;
