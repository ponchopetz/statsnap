import { useState, useMemo } from "react";
import StatRow from "../StatRow/StatRow.jsx";
import SparkBlock from "../Sparkline/SparkBlock.jsx";
import { sumWeeks, averageWeeks, totalTouchdowns, weekSeries } from "../../utils/stats.js";
import { formatNumber, formatPercent } from "../../utils/format.js";

const RECEIVER_PRIMARY_KEY = "receivingYards";

function OverviewReceiver({ player }) {
  const weeks = player.weeks ?? [];
  const [selectedKey, setSelectedKey] = useState(RECEIVER_PRIMARY_KEY);

  const cells = useMemo(() => [
    { key: "gamesPlayed",    label: "GP",        value: formatNumber(player.gamesPlayed),                    chartable: false },
    { key: "targets",        label: "TGT",       value: formatNumber(sumWeeks(weeks, "targets")),             chartable: true  },
    { key: "receptions",     label: "REC",       value: formatNumber(sumWeeks(weeks, "receptions")),          chartable: true  },
    { key: "receivingYards", label: "REC YDS",   value: formatNumber(sumWeeks(weeks, "receivingYards")),      chartable: true  },
    { key: "totalTds",       label: "TOTAL TD",  value: formatNumber(totalTouchdowns(weeks)),                 chartable: true  },
    { key: "targetShare",    label: "TGT SHARE", value: formatPercent(averageWeeks(weeks, "targetShare")),    chartable: true  },
  ], [player]);

  const seriesMap = useMemo(() => ({
    targets:        { data: weekSeries(weeks, "targets"),        formatValue: formatNumber },
    receptions:     { data: weekSeries(weeks, "receptions"),     formatValue: formatNumber },
    receivingYards: { data: weekSeries(weeks, "receivingYards"), formatValue: formatNumber },
    totalTds:       {
      data: weeks.map((w) => (w.rushingTds ?? 0) + (w.receivingTds ?? 0)),
      formatValue: formatNumber,
    },
    targetShare:    { data: weekSeries(weeks, "targetShare"),    formatValue: formatPercent },
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
    </>
  );
}

export default OverviewReceiver;
