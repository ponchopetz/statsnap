import { useState, useMemo } from "react";
import StatRow from "../StatRow/StatRow.jsx";
import SparkBlock from "../Sparkline/SparkBlock.jsx";
import ByWeekRail from "../ByWeekRail/ByWeekRail.jsx";
import { sumWeeks, completionPct, weekSeries, seasonPassingEpa } from "../../utils/stats.js";
import { formatNumber, formatPercent, formatSigned } from "../../utils/format.js";

const QB_PRIMARY_KEY = "passingYards";

function OverviewQB({ player }) {
  const weeks = useMemo(() => player.weeks ?? [], [player.weeks]);
  const [selectedKey, setSelectedKey] = useState(QB_PRIMARY_KEY);

  const cells = useMemo(() => [
    { key: "gamesPlayed",   label: "GP",       value: formatNumber(player.gamesPlayed),               chartable: false },
    { key: "completionPct", label: "CMP %",    value: formatPercent(completionPct(weeks)),             chartable: true  },
    { key: "passingYards",  label: "PASS YDS", value: formatNumber(sumWeeks(weeks, "passingYards")),   chartable: true  },
    { key: "passingTds",    label: "PASS TD",  value: formatNumber(sumWeeks(weeks, "passingTds")),     chartable: true  },
    { key: "interceptions", label: "INT",      value: formatNumber(sumWeeks(weeks, "interceptions")),  chartable: true  },
    { key: "passingEpa",    label: "PASS EPA", value: formatSigned(seasonPassingEpa(weeks)),           chartable: true  },
  ], [player, weeks]);

  const seriesMap = useMemo(() => ({
    completionPct: {
      data: weeks.map((w) => {
        if (!w.attempts) return null;
        return (w.completions / w.attempts) * 100;
      }),
      formatValue: (n) => formatPercent(n / 100),
    },
    passingYards:  { data: weekSeries(weeks, "passingYards"),  formatValue: formatNumber },
    passingTds:    { data: weekSeries(weeks, "passingTds"),    formatValue: formatNumber },
    interceptions: { data: weekSeries(weeks, "interceptions"), formatValue: formatNumber },
    passingEpa:    { data: weekSeries(weeks, "passingEpa"),    formatValue: (n) => formatSigned(n, 2) },
  }), [weeks]);

  const selectedCell = cells.find((c) => c.key === selectedKey);
  const avgLabel = selectedKey === "passingEpa" ? "AVG/GM" : "AVG";

  return (
    <>
      <StatRow cells={cells} selectedKey={selectedKey} onSelectStat={setSelectedKey} />
      <SparkBlock
        label={selectedCell.label}
        data={seriesMap[selectedKey].data}
        weeks={weeks.map((w) => w.week)}
        formatValue={seriesMap[selectedKey].formatValue}
        avgLabel={avgLabel}
      />
      <ByWeekRail player={player} />
    </>
  );
}

export default OverviewQB;
