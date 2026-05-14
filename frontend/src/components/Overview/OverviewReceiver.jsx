import { useMemo } from "react";
import StatRow from "../StatRow/StatRow.jsx";
import { sumWeeks, averageWeeks, totalTouchdowns } from "../../utils/stats.js";
import { formatNumber, formatPercent } from "../../utils/format.js";

const RECEIVER_PRIMARY_KEY = "receivingYards";

function OverviewReceiver({ player }) {
  const weeks = player.weeks ?? [];

  const cells = useMemo(() => [
    { key: "gamesPlayed",    label: "GP",        value: formatNumber(player.gamesPlayed),                    chartable: false },
    { key: "targets",        label: "TGT",       value: formatNumber(sumWeeks(weeks, "targets")),             chartable: true  },
    { key: "receptions",     label: "REC",       value: formatNumber(sumWeeks(weeks, "receptions")),          chartable: true  },
    { key: "receivingYards", label: "REC YDS",   value: formatNumber(sumWeeks(weeks, "receivingYards")),      chartable: true  },
    { key: "totalTds",       label: "TOTAL TD",  value: formatNumber(totalTouchdowns(weeks)),                 chartable: true  },
    { key: "targetShare",    label: "TGT SHARE", value: formatPercent(averageWeeks(weeks, "targetShare")),    chartable: true  },
  ], [player]);

  return (
    <StatRow
      cells={cells}
      selectedKey={RECEIVER_PRIMARY_KEY}
      onSelectStat={() => {}}
    />
  );
}

export default OverviewReceiver;
