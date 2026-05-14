import { useMemo } from "react";
import StatRow from "../StatRow/StatRow.jsx";
import { sumWeeks, averageWeeks, completionPct } from "../../utils/stats.js";
import { formatNumber, formatPercent, formatSigned } from "../../utils/format.js";

const QB_PRIMARY_KEY = "passingYards";

function OverviewQB({ player }) {
  const weeks = player.weeks ?? [];

  const cells = useMemo(() => [
    { key: "gamesPlayed",   label: "GP",       value: formatNumber(player.gamesPlayed),               chartable: false },
    { key: "completionPct", label: "CMP %",    value: formatPercent(completionPct(weeks)),             chartable: true  },
    { key: "passingYards",  label: "PASS YDS", value: formatNumber(sumWeeks(weeks, "passingYards")),   chartable: true  },
    { key: "passingTds",    label: "PASS TD",  value: formatNumber(sumWeeks(weeks, "passingTds")),     chartable: true  },
    { key: "interceptions", label: "INT",      value: formatNumber(sumWeeks(weeks, "interceptions")),  chartable: true  },
    { key: "passingEpa",    label: "PASS EPA", value: formatSigned(averageWeeks(weeks, "passingEpa")), chartable: true  },
  ], [player]);

  return (
    <StatRow
      cells={cells}
      selectedKey={QB_PRIMARY_KEY}
      onSelectStat={() => {}}
    />
  );
}

export default OverviewQB;
