import { useState, useMemo } from "react";
import StatRow from "../StatRow/StatRow.jsx";
import SparkBlock from "../Sparkline/SparkBlock.jsx";
import ByWeekRail from "../ByWeekRail/ByWeekRail.jsx";
import FormLine from "../FormLine/FormLine.jsx";
import { HEADLINE_CONFIG, primaryKey } from "../../utils/headline.js";
import { isFlagEnabled } from "../../utils/flags.js";

// One Overview panel for every position. The six headline cells and their
// sparkline series come from utils/headline.js, so the same list feeds the
// Compare page; only the row list varies by position, never the structure.
function OverviewPanel({ player }) {
  const rows = HEADLINE_CONFIG[player.position];
  const weeks = useMemo(() => player.weeks ?? [], [player.weeks]);
  const [selectedKey, setSelectedKey] = useState(() => primaryKey(player.position));

  const cells = useMemo(
    () =>
      rows.map((r) => ({
        key: r.key,
        label: r.label,
        value: r.format(r.value(weeks, player)),
        chartable: r.chartable,
      })),
    [rows, player, weeks]
  );

  const selectedRow = rows.find((r) => r.key === selectedKey && r.chartable) ?? rows.find((r) => r.primary);
  const series = useMemo(() => selectedRow.series(weeks), [selectedRow, weeks]);

  return (
    <>
      <StatRow cells={cells} selectedKey={selectedRow.key} onSelectStat={setSelectedKey} />
      {isFlagEnabled("form") && <FormLine player={player} />}
      <SparkBlock
        label={selectedRow.label}
        data={series}
        weeks={weeks.map((w) => w.week)}
        formatValue={selectedRow.formatSeries}
        avgLabel={selectedRow.avgLabel ?? "AVG"}
      />
      <ByWeekRail player={player} />
    </>
  );
}

export default OverviewPanel;
