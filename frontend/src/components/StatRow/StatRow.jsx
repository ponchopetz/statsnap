import { useRef } from "react";
import "./StatRow.css";

function StatRow({ cells, selectedKey, onSelectStat }) {
  const rowRef = useRef(null);
  const chartableKeys = cells.filter((c) => c.chartable).map((c) => c.key);

  const onKeyDown = (e) => {
    const currentIndex = chartableKeys.indexOf(selectedKey);
    if (currentIndex === -1) return;

    let nextIndex = null;
    if (e.key === "ArrowRight") nextIndex = (currentIndex + 1) % chartableKeys.length;
    else if (e.key === "ArrowLeft") nextIndex = (currentIndex - 1 + chartableKeys.length) % chartableKeys.length;
    else if (e.key === "Home") nextIndex = 0;
    else if (e.key === "End") nextIndex = chartableKeys.length - 1;

    if (nextIndex !== null) {
      e.preventDefault();
      const nextKey = chartableKeys[nextIndex];
      onSelectStat(nextKey);
      rowRef.current?.querySelector(`[data-cell-key="${nextKey}"]`)?.focus();
    }
  };

  return (
    <div className="stat-row" ref={rowRef} onKeyDown={onKeyDown}>
      {cells.map((cell) => {
        const isSelected = cell.key === selectedKey;
        const Tag = cell.chartable ? "button" : "div";
        const extraProps = cell.chartable
          ? {
              type: "button",
              onClick: () => onSelectStat(cell.key),
              tabIndex: isSelected ? 0 : -1,
              "data-cell-key": cell.key,
            }
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
