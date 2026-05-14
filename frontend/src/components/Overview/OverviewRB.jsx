import { useMemo } from "react";
import StatRow from "../StatRow/StatRow.jsx";
import { sumWeeks, totalTouchdowns } from "../../utils/stats.js";
import { formatNumber } from "../../utils/format.js";

const RB_PRIMARY_KEY = "rushingYards";

function OverviewRB({ player }) {
  const weeks = player.weeks ?? [];

  const cells = useMemo(() => [
    { key: "gamesPlayed",    label: "GP",       value: formatNumber(player.gamesPlayed),               chartable: false },
    { key: "carries",        label: "CARRIES",  value: formatNumber(sumWeeks(weeks, "carries")),        chartable: true  },
    { key: "rushingYards",   label: "RUSH YDS", value: formatNumber(sumWeeks(weeks, "rushingYards")),   chartable: true  },
    { key: "totalTds",       label: "TOTAL TD", value: formatNumber(totalTouchdowns(weeks)),            chartable: true  },
    { key: "receptions",     label: "REC",      value: formatNumber(sumWeeks(weeks, "receptions")),     chartable: true  },
    { key: "receivingYards", label: "REC YDS",  value: formatNumber(sumWeeks(weeks, "receivingYards")), chartable: true  },
  ], [player]);

  return (
    <StatRow
      cells={cells}
      selectedKey={RB_PRIMARY_KEY}
      onSelectStat={() => {}}
    />
  );
}

export default OverviewRB;
