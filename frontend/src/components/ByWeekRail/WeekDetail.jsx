import { formatNumber } from "../../utils/format.js";

function resultClass(result) {
  if (result === "W") return "win";
  if (result === "L") return "loss";
  return "tie";
}

function getFields(week, position) {
  switch (position) {
    case "QB":
      return [
        { k: "CMP", v: formatNumber(week.completions) },
        { k: "ATT", v: formatNumber(week.attempts) },
        { k: "YDS", v: formatNumber(week.passingYards) },
        { k: "TD",  v: formatNumber(week.passingTds) },
        { k: "INT", v: formatNumber(week.interceptions) },
      ];
    case "RB":
      return [
        { k: "ATT", v: formatNumber(week.carries) },
        { k: "YDS", v: formatNumber(week.rushingYards) },
        { k: "Y/A", v: week.carries > 0 ? (week.rushingYards / week.carries).toFixed(1) : "—" },
        { k: "REC", v: formatNumber(week.receptions) },
        { k: "TD",  v: (week.rushingTds ?? 0) + (week.receivingTds ?? 0) },
      ];
    case "WR":
    case "TE":
      return [
        { k: "REC", v: formatNumber(week.receptions) },
        { k: "TGT", v: formatNumber(week.targets) },
        { k: "YDS", v: formatNumber(week.receivingYards) },
        { k: "Y/R", v: week.receptions > 0 ? (week.receivingYards / week.receptions).toFixed(1) : "—" },
        { k: "TD",  v: (week.rushingTds ?? 0) + (week.receivingTds ?? 0) },
      ];
    default:
      return [];
  }
}

function WeekDetail({ week, position }) {
  if (!week) return null;

  const isAway = week.homeAway === "away";
  const venueLabel = isAway ? "AT" : "VS";
  const cls = resultClass(week.result);
  const fields = getFields(week, position);

  return (
    <div className="byweek-detail">
      <div className="byweek-detail-head">
        <div className="byweek-detail-matchup">
          <span className="byweek-detail-venue">{venueLabel}</span>
          <span className="byweek-detail-opp">{week.opponent}</span>
          <span className="byweek-detail-sep">·</span>
          <span className={`byweek-detail-result ${cls}`}>
            {week.result} {week.teamScore}-{week.opponentScore}{week.overtime ? " OT" : ""}
          </span>
        </div>
        <div className="byweek-detail-wk">WK {week.week}</div>
      </div>
      <div className="byweek-detail-grid byweek-detail-grid-5">
        {fields.map((f) => (
          <div key={f.k} className="byweek-detail-stat">
            <div className="byweek-detail-stat-key">{f.k}</div>
            <div className="byweek-detail-stat-val">{f.v}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default WeekDetail;
