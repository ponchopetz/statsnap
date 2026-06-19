import { useMemo, useState, useEffect, useRef } from "react";
import useOffscreenCount from "../../hooks/useOffscreenCount.js";
import { formatNumber } from "../../utils/format.js";
import WeekDetail from "./WeekDetail.jsx";
import "./ByWeekRail.css";

function primaryStat(wk, position) {
  switch (position) {
    case "QB": return wk.passingYards;
    case "RB": return wk.rushingYards;
    default:   return wk.receivingYards;
  }
}

function resultClass(result) {
  if (result === "W") return "win";
  if (result === "L") return "loss";
  return "tie";
}

function MiniCard({ wk, index, selectedIndex, position, onClick }) {
  const isActive = index === selectedIndex;
  const stat = primaryStat(wk, position);
  const cls = resultClass(wk.result);

  return (
    <button
      type="button"
      className={`byweek-mini${isActive ? " active" : ""}`}
      onClick={() => onClick(index)}
    >
      <div className="byweek-mini-wk">W{wk.week}</div>
      <div className="byweek-mini-opp">
        {wk.homeAway === "away" ? "@" : ""}{wk.opponent}
      </div>
      <div className={`byweek-mini-result ${cls}`}>{wk.result}</div>
      <div className="byweek-mini-num">{formatNumber(stat)}</div>
      <div className="byweek-mini-label">YDS</div>
    </button>
  );
}

function ByWeekRail({ player }) {
  const weeks = player.weeks ?? [];
  const displayWeeks = useMemo(() => [...weeks].reverse(), [weeks]);
  const stripRef = useRef(null);
  const offscreen = useOffscreenCount(stripRef, [displayWeeks]);
  const [selectedIndex, setSelectedIndex] = useState(0);

  useEffect(() => {
    setSelectedIndex(0);
  }, [player]);

  if (weeks.length === 0) return null;

  return (
    <div className="byweek">
      <div className="byweek-head">
        <div className="byweek-title">BY WEEK</div>
        <div className="byweek-count">{weeks.length} GAMES</div>
      </div>
      <div className="byweek-strip-wrap">
        <div className="byweek-strip" ref={stripRef}>
          {displayWeeks.map((wk, i) => (
            <MiniCard
              key={wk.week}
              wk={wk}
              index={i}
              selectedIndex={selectedIndex}
              position={player.position}
              onClick={setSelectedIndex}
            />
          ))}
        </div>
        <div className="byweek-strip-fade" aria-hidden="true">
          {offscreen > 0 && (
            <span className="byweek-strip-more">+{offscreen} MORE →</span>
          )}
        </div>
      </div>
      <WeekDetail week={displayWeeks[selectedIndex]} position={player.position} />
    </div>
  );
}

export default ByWeekRail;
