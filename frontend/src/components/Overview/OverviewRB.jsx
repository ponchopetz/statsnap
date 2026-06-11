import { useState, useMemo } from "react";
import StatRow from "../StatRow/StatRow.jsx";
import SparkBlock from "../Sparkline/SparkBlock.jsx";
import ByWeekRail from "../ByWeekRail/ByWeekRail.jsx";
import { sumWeeks, totalTouchdowns, weekSeries } from "../../utils/stats.js";
import { formatNumber } from "../../utils/format.js";

const RB_PRIMARY_KEY = "rushingYards";

function OverviewRB({ player }) {
  const weeks = player.weeks ?? [];
  const [selectedKey, setSelectedKey] = useState(RB_PRIMARY_KEY);

  const cells = useMemo(() => [
    { key: "gamesPlayed",    label: "GP",       value: formatNumber(player.gamesPlayed),               chartable: false },
    { key: "carries",        label: "CARRIES",  value: formatNumber(sumWeeks(weeks, "carries")),        chartable: true  },
    { key: "rushingYards",   label: "RUSH YDS", value: formatNumber(sumWeeks(weeks, "rushingYards")),   chartable: true  },
    { key: "totalTds",       label: "TOTAL TD", value: formatNumber(totalTouchdowns(weeks)),            chartable: true  },
    { key: "receptions",     label: "REC",      value: formatNumber(sumWeeks(weeks, "receptions")),     chartable: true  },
    { key: "receivingYards", label: "REC YDS",  value: formatNumber(sumWeeks(weeks, "receivingYards")), chartable: true  },
  ], [player]);

  const seriesMap = useMemo(() => ({
    carries:        { data: weekSeries(weeks, "carries"),        formatValue: formatNumber },
    rushingYards:   { data: weekSeries(weeks, "rushingYards"),   formatValue: formatNumber },
    totalTds:       {
      data: weeks.map((w) => (w.rushingTds ?? 0) + (w.receivingTds ?? 0)),
      formatValue: formatNumber,
    },
    receptions:     { data: weekSeries(weeks, "receptions"),     formatValue: formatNumber },
    receivingYards: { data: weekSeries(weeks, "receivingYards"), formatValue: formatNumber },
  }), [weeks]);

  const selectedCell = cells.find((c) => c.key === selectedKey);

  return (
    <>
      <StatRow cells={cells} selectedKey={selectedKey} onSelectStat={setSelectedKey} />
      <SparkBlock
        label={selectedCell.label}
        data={seriesMap[selectedKey].data}
        weeks={weeks.map((w) => w.week)}
        formatValue={seriesMap[selectedKey].formatValue}
      />
      <ByWeekRail player={player} />
    </>
  );
}

export default OverviewRB;
