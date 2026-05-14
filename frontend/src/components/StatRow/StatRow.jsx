import "./StatRow.css";

function StatRow({ cells, selectedKey, onSelectStat }) {
  return (
    <div className="stat-row">
      {cells.map((cell) => {
        const isSelected = cell.key === selectedKey;
        const Tag = cell.chartable ? "button" : "div";
        const extraProps = cell.chartable
          ? { type: "button", onClick: () => onSelectStat(cell.key) }
          : {};

        return (
          <Tag
            key={cell.key}
            className={
              "stat-cell" +
              (isSelected ? " stat-cell--selected" : "") +
              (cell.chartable ? " stat-cell--chartable" : "")
            }
            {...extraProps}
          >
            <span className="stat-cell-label">{cell.label}</span>
            <span className="stat-cell-value">{cell.value}</span>
          </Tag>
        );
      })}
    </div>
  );
}

export default StatRow;
